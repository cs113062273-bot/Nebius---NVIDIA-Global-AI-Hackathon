import fs from 'node:fs/promises';
import path from 'node:path';
import { readJson, json } from '../src/files.js';
import { violationKeys } from '../src/verifier.js';
import { patchScope } from '../src/live.js';

// What each gate contributed, measured over every recorded blind run (real bugs, all engine
// versions) and every open-bug run. No inference: it reads the run records the batches wrote.
// - firstTry: runs whose first patch (Nemotron 3 Super, no browser feedback) passed every gate;
// - withFeedback: runs that passed on any attempt after Chromium's failure report went back;
// - caught: patches that made the frozen keyboard task pass but were rejected by another gate,
//   i.e. patches a check of the reported task alone would have accepted.
const ROOT = path.resolve('.'), out = path.join(ROOT, 'public', 'gate-stats.json');
const benches = [['realbugs', 'real'], ['openbugs', 'open']];
const runs = [];
for (const [bench, kind] of benches) {
  const base = path.join(ROOT, 'benchmarks', bench);
  for (const id of await fs.readdir(base)) {
    const dir = path.join(base, id, 'results');
    for (const f of await fs.readdir(dir).catch(() => [])) {
      if (!/^auto-\d+\.json$/.test(f)) continue;
      const result = await readJson(path.join(dir, f));
      const run = await readJson(path.join(ROOT, 'artifacts', 'runs', result.modelRun, 'run.json')).catch(() => null);
      if (run) runs.push({ kind, case: id, version: (result.implementation || '').slice(0, 8), result, run });
    }
  }
}
const count = (list, test) => list.filter(test).length;
const gatesOf = a => a.verification?.gates || {};
const keyboardPassed = a => gatesOf(a).keyboard === 'VERIFIED_PASS';
const guardFailed = g => typeof g.regressionGuards === 'string' && /^(\d+)\/(\d+)$/.test(g.regressionGuards) && (([, x, y]) => +x < +y)(g.regressionGuards.match(/^(\d+)\/(\d+)$/));
// Engines before v9 compared axe findings with the failing keyboard baseline only, by exact selector.
// A finding counts here only if the corrected check (engine v9: every original path, matched by element
// kind) also calls it new; otherwise the rejection was the gate's error and is listed on its own.
const kind = k => k.replace(/="\d+"/g, '="#"').replace(/:nth-child\(\d+\)/g, ':nth-child(#)');
async function stillNew(runId, attempt) {
  const dir = path.join(ROOT, 'artifacts', 'runs', runId), load = n => readJson(path.join(dir, n, 'result.json')).catch(() => null), names = await fs.readdir(dir);
  const guards = names.filter(n => /^guard-before-\d+$/.test(n));
  const base = await Promise.all(['before', 'functional-before', ...guards].map(load)), cand = await Promise.all([`after-${attempt}`, `functional-after-${attempt}`, ...guards.map(g => g.replace('before', `after-${attempt}`))].map(load));
  const old = new Set(base.filter(Boolean).flatMap(r => [...violationKeys(r)].map(kind)));
  return cand.filter(Boolean).flatMap(r => [...violationKeys(r)]).filter(k => !old.has(kind(k)));
}
const falseRejections = [], MATCH = { functional: /functional/i, guards: /^Regression guard/, rules: /^New automated/ };
const caught = [], reasons = { functional: 0, guards: 0, rules: 0, other: 0 };
let attempts = 0, overfit = 0, unapplied = 0;
for (const r of runs) for (const a of r.run.attempts) {
  attempts++;
  if (a.category === 'OVERFIT') overfit++;
  if (a.category === 'APPLICATION') unapplied++;
  if (a.verified || !keyboardPassed(a)) continue;
  const g = gatesOf(a), why = [];
  if (g.independentFunctional && g.independentFunctional !== 'VERIFIED_PASS' || g.functionalOutputUnchanged === false) why.push('functional');
  if (guardFailed(g)) why.push('guards');
  if (a.verification?.newRules?.length) { if ((await stillNew(r.run.id, a.attempt)).length) why.push('rules'); else if (!why.length) { falseRejections.push({ case: r.case, kind: r.kind, version: r.version, run: r.run.id, attempt: a.attempt, model: a.provenance?.model?.split('/')[1] || null, reason: a.verification.reasons.find(x => /^New automated/.test(x))?.slice(0, 220) }); continue; } }
  if (!why.length) why.push('other');
  for (const w of why) reasons[w]++;
  caught.push({ case: r.case, kind: r.kind, version: r.version, run: r.run.id, attempt: a.attempt, model: a.provenance?.model?.split('/')[1] || null, why, reason: (a.verification?.reasons || []).find(x => MATCH[why[0]]?.test(x) ?? !/^Keyboard candidate/.test(x))?.slice(0, 220) || null });
}
const real = runs.filter(r => r.kind === 'real');
const passedOn = r => r.run.attempts.find(a => a.verified)?.attempt || null;
// Passing runs whose patch changed the library's own files, not only the author-built page.
let libraryFixed = 0;
for (const r of real) if (passedOn(r) && await patchScope(r.run.id, passedOn(r), (await readJson(path.join(ROOT, 'benchmarks', 'realbugs', r.case, 'case.json'))).upstreamFiles) === 'library') libraryFixed++;
const stats = {
  generatedAt: new Date().toISOString(),
  note: 'Fractions: every recorded blind run of the 26 real bugs, across all engine versions; a run is one blind run of one bug on one engine version: Super, then Ultra with the browser failure report, up to three proposals (five from engine v13). Rejected patches: real-bug and open-bug runs.',
  runs: runs.length, realRuns: real.length, attempts,
  firstTry: count(real, r => passedOn(r) === 1), withFeedback: count(real, r => passedOn(r) > 1), notRepaired: count(real, r => !passedOn(r)), libraryFixed,
  caughtAfterKeyboardPass: caught.length, caughtReasons: reasons, falseRejections, overfitRejected: overfit, unappliedPatches: unapplied,
  caught,
};
await json(out, stats);
console.log(JSON.stringify({ ...stats, caught: caught.length, falseRejections: falseRejections.length }, null, 1));
