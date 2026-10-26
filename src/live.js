import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './catalog.js';
import { readJson, json, hashTree } from './files.js';
import { checkedDiff } from './diff.js';
import { Journey } from './schema.js';

// Public live runner. A visitor picks a screened real upstream bug; Nemotron repairs it blind
// (Super first, Ultra on rejection) and the same browser gates decide. Spend is capped in USD,
// per day and in total, from the provider-reported usage, and the ledger survives restarts.
export const CASES = path.join(ROOT, 'benchmarks', 'realbugs');
// Where a passing patch made its change: in the library's own files (upstreamFiles), or only in the
// author-built page around it. A page-only patch passes the task by working around the library bug.
export async function patchScope(runId, attempt, upstreamFiles = []) {
  if (!runId || !attempt) return null;
  const read = dir => fs.readFile(path.join(ROOT, dir, runId, `diff-${attempt}.patch`), 'utf8');
  const patch = await read(path.join('artifacts', 'runs')).catch(() => read(path.join('public', 'evidence', 'runs'))).catch(() => null);
  if (patch === null) return null;
  const files = [...patch.matchAll(/^diff --git a\/(\S+)/mg)].map(m => m[1]), upstream = new Set(upstreamFiles);
  return files.some(f => upstream.has(f)) ? 'library' : files.length ? 'page' : null;
}
export const LIVE_SCOPE = 'live-judge';
export const LIVE_MODELS = ['nvidia/nemotron-3-super-120b-a12b', 'nvidia/Nemotron-3-Ultra-550b-a55b', 'nvidia/Nemotron-3-Ultra-550b-a55b'];
// Worst case for one run: three calls at the output ceiling plus a large prompt, at Ultra prices.
export const WORST_RUN_USD = 0.5;

const byRunNumber = (a, b) => a.localeCompare(b, undefined, { numeric: true });
// Every auto run on the frozen engine, first to last; the first is the scored one, the rest are repeats.
const engineShown = (results, frozen) => results.some(r => r.implementation === frozen) ? frozen : results.at(-1)?.implementation || null;
const frozenRuns = (results, frozen, upstream) => Promise.all(results.filter(r => frozen && r.implementation === frozen && (r.policy || 'auto') === 'auto').map(async r => { const passedOn = r.attempts.find(a => a.verified)?.attempt || null; return { run: r.modelRun, verdict: r.verdict, passedOn, scope: await patchScope(r.modelRun, passedOn, upstream) }; }));
export async function liveCases() {
  const out = [], frozen = (await readJson(path.join(CASES, 'summary.json')).catch(() => null))?.implementation;
  for (const entry of await fs.readdir(CASES, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory()) continue;
    const root = path.join(CASES, entry.name);
    const meta = await readJson(path.join(root, 'case.json')).catch(() => null), commitment = await readJson(path.join(root, 'commitment.json')).catch(() => null);
    if (!meta || commitment?.screen?.verdict !== 'VERIFIED_PASS') continue;
    const results = [];
    // Numeric order, so auto-10 follows auto-9 and the first run on an engine stays the first.
    for (const f of (await fs.readdir(path.join(root, 'results')).catch(() => [])).sort(byRunNumber)) results.push(await readJson(path.join(root, 'results', f)));
    // Same rule as the benchmark scoreboard: the first auto run on the frozen implementation.
    // The engine shown is the frozen one, or, before it has runs, the newest engine that has; its first run is the scored one.
    const auto = results.filter(r => r.policy === 'auto'), shown = engineShown(auto, frozen), recorded = auto.find(r => r.implementation === shown) || results.at(-1) || null;
    out.push({ id: entry.name, title: meta.title, summary: meta.summary, library: meta.library, category: meta.category || null, repository: meta.repository, issue: meta.issue, fixUrl: meta.fixUrl || null, fixCommit: meta.fixCommit, buggyCommit: meta.buggyCommit, split: meta.split || 'holdout', screenRun: commitment.screen.run,
      recorded: recorded && { run: recorded.modelRun, verdict: recorded.verdict, passedOn: recorded.attempts.find(a => a.verified)?.attempt || null, models: recorded.attempts.map(a => a.model?.split('/')[1] || null), scope: await patchScope(recorded.modelRun, recorded.attempts.find(a => a.verified)?.attempt, meta.upstreamFiles) },
      frozenRuns: await frozenRuns(results, shown, meta.upstreamFiles) });
  }
  return out.sort((a, b) => a.library.localeCompare(b.library) || a.id.localeCompare(b.id));
}
// Open upstream bugs: reproduced on the library's current head, with no maintainers' fix to compare.
export const OPEN_CASES = path.join(ROOT, 'benchmarks', 'openbugs');
export async function openCases() {
  const out = [], frozen = (await readJson(path.join(CASES, 'summary.json')).catch(() => null))?.implementation;
  for (const entry of await fs.readdir(OPEN_CASES, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory()) continue;
    const root = path.join(OPEN_CASES, entry.name), meta = await readJson(path.join(root, 'case.json')).catch(() => null), commitment = await readJson(path.join(root, 'commitment.json')).catch(() => null);
    if (!meta || commitment?.screen?.verdict !== 'REPRODUCED') continue;
    const results = [];
    const files = (await fs.readdir(path.join(root, 'results')).catch(() => [])).sort(byRunNumber), replays = [];
    for (const f of files) if (f.startsWith('auto-')) results.push(await readJson(path.join(root, 'results', f)));
    // Earlier model patches replayed against this stricter task in the browser, without inference.
    for (const f of files) if (f.startsWith('replay-')) { const r = await readJson(path.join(root, 'results', f)); replays.push({ run: r.replayRun, verdict: r.verdict, fromCase: r.fromCase, fromRun: r.fromRun, attempt: r.attempt, engine: r.engine }); }
    // First run on the frozen implementation; runs on earlier engines stay in results/ as history.
    const shown = engineShown(results, frozen), recorded = results.find(r => r.implementation === shown) || results.at(-1) || null;
    out.push({ id: entry.name, title: meta.title, summary: meta.summary, library: meta.library, category: meta.category || null, repository: meta.repository, issue: meta.issue, pinnedCommit: meta.pinnedCommit, status: meta.status, derivedFrom: meta.derivedFrom || null, addedAfterReview: meta.addedAfterReview || null, replays, pendingHumanFix: meta.pendingHumanFix || null, pendingHumanCheck: await readJson(path.join(root, 'pending-human-check.json')).catch(() => null), review: await readJson(path.join(root, 'review.json')).catch(() => null), expectedBehaviour: meta.expectedBehaviour || null,
      recorded: recorded && { run: recorded.modelRun, verdict: recorded.verdict, passedOn: recorded.attempts.find(a => a.verified)?.attempt || null, models: recorded.attempts.map(a => a.model?.split('/')[1] || null), scope: await patchScope(recorded.modelRun, recorded.attempts.find(a => a.verified)?.attempt, meta.upstreamFiles) },
      frozenRuns: await frozenRuns(results, shown, meta.upstreamFiles) });
  }
  return out.sort((a, b) => a.library.localeCompare(b.library) || a.id.localeCompare(b.id));
}
// Score of every frozen engine version, with the author's note on what changed.
export async function benchmarkVersions() {
  const summary = await readJson(path.join(CASES, 'summary.json')).catch(() => null), notes = await readJson(path.join(CASES, 'versions.json')).catch(() => ({}));
  return { note: notes.note || null, versions: (summary?.versions || []).map(v => ({ id: v.implementation.slice(0, 8), current: v.current, runs: v.autoRuns, verified: v.autoVerified, libraryVerified: v.libraryVerified ?? null, eligible: summary.eligible, note: notes.versions?.[v.implementation] || null,
    ...(v.maxRunsPerCase > 1 ? { repeats: { runs: v.allRuns, verified: v.allVerified, libraryVerified: v.allLibraryVerified, casesRepairedOnce: v.casesRepairedOnce, perCase: v.maxRunsPerCase } } : {}) })) };
}
export async function loadCase(id) {
  if (!/^[a-z0-9-]{1,80}$/.test(id)) throw new Error('Unknown case');
  const root = path.join(CASES, id), commitment = await readJson(path.join(root, 'commitment.json'));
  if (commitment.screen?.verdict !== 'VERIFIED_PASS') throw new Error('Case is not screened');
  const original = path.join(root, 'original');
  if (JSON.stringify(await hashTree(original)) !== JSON.stringify(commitment.sourceHashes)) throw new Error('Case source changed after screening');
  const raw = await readJson(path.join(root, 'tasks.json')), meta = await readJson(path.join(root, 'case.json'));
  return { meta, original, fix: path.join(root, 'human-fix'), commitment, journey: Journey.parse(raw.journey), functionalJourney: Journey.parse(raw.functionalJourney), guards: (raw.guards || []).map(g => Journey.parse(g)) };
}
// The maintainers' published change, as a diff over the pinned files. Shown after a run, never sent to the model.
export async function humanPatch(id) {
  const c = await loadCase(id), changes = [];
  for (const file of c.commitment.humanFixFiles) changes.push({ path: file, before: await fs.readFile(path.join(c.original, file)).catch(() => null), after: await fs.readFile(path.join(c.fix, file)).catch(() => null) });
  return (await checkedDiff(changes)).patch;
}

const rate = (e, kind) => Number(e.pricing?.[kind] ?? NaN);
// Provider-reported usage when present; otherwise the full pre-call reservation.
export function entryCost(e) {
  const u = e.usage;
  if (u && Number.isFinite(u.prompt_tokens) && Number.isFinite(u.completion_tokens) && Number.isFinite(rate(e, 'prompt')) && Number.isFinite(rate(e, 'completion'))) return u.prompt_tokens * rate(e, 'prompt') + u.completion_tokens * rate(e, 'completion') + (Number(e.pricing?.request) || 0);
  return Number.isFinite(Number(e.reservedCreditUsd)) ? Number(e.reservedCreditUsd) : WORST_RUN_USD;
}
export function spend(ledger, now = new Date()) {
  const day = now.toISOString().slice(0, 10), entries = (ledger?.entries || []).filter(e => e.budgetScope === LIVE_SCOPE);
  const total = entries.reduce((s, e) => s + entryCost(e), 0), today = entries.filter(e => String(e.at).startsWith(day)).reduce((s, e) => s + entryCost(e), 0);
  return { totalUsd: +total.toFixed(4), todayUsd: +today.toFixed(4), calls: entries.length };
}

// Ledger persistence. On a public host the container disk is ephemeral, so the ledger is
// mirrored to a private Hugging Face dataset; if that store is unreachable, live runs stay off.
export class LiveLedger {
  constructor({ dir, env = process.env, transport = fetch }) { this.file = path.join(dir, 'budget.json'); this.env = env; this.transport = transport; this.repo = env.LIVE_LEDGER_REPO || ''; this.token = env.HF_TOKEN || ''; }
  remote() { return !!(this.repo && this.token); }
  async pull() {
    if (!this.remote()) return readJson(this.file).catch(e => { if (e.code === 'ENOENT') return { calls: 0, reservedTokens: 0, entries: [] }; throw e; });
    const res = await this.transport(`https://huggingface.co/datasets/${this.repo}/resolve/main/budget.json`, { headers: { Authorization: 'Bearer ' + this.token }, signal: AbortSignal.timeout(15000) });
    let ledger;
    if (res.status === 404) ledger = { calls: 0, reservedTokens: 0, entries: [] };
    else if (!res.ok) throw new Error(`Ledger store HTTP ${res.status}`);
    else ledger = await res.json();
    if (!Array.isArray(ledger.entries)) throw new Error('Ledger store returned an invalid ledger');
    await fs.mkdir(path.dirname(this.file), { recursive: true }); await json(this.file, ledger);
    return ledger;
  }
  async push() {
    const ledger = await readJson(this.file);
    if (!this.remote()) return ledger;
    const lines = [{ key: 'header', value: { summary: `Live ledger · ${ledger.entries.length} calls` } }, { key: 'file', value: { path: 'budget.json', encoding: 'base64', content: Buffer.from(JSON.stringify(ledger)).toString('base64') } }];
    const res = await this.transport(`https://huggingface.co/api/datasets/${this.repo}/commit/main`, { method: 'POST', headers: { Authorization: 'Bearer ' + this.token, 'Content-Type': 'application/x-ndjson' }, body: lines.map(l => JSON.stringify(l)).join('\n'), signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`Ledger store HTTP ${res.status}`);
    return ledger;
  }
}

export function liveLimits(env = process.env) {
  return { totalUsd: Math.min(10, Number(env.LIVE_TOTAL_USD || 10)), dailyUsd: Math.min(10, Number(env.LIVE_DAILY_USD || 1)), perVisitorMs: Number(env.LIVE_VISITOR_INTERVAL_MS || 300000) };
}
export function liveConfigured(env = process.env) {
  return !!env.NEBIUS_API_KEY && env.LIVE_NEBIUS_TESTS === 'true' && env.NEBIUS_SPONSOR_CREDITS_CONFIRMED === 'true' && env.LIVE_REPAIR === 'true';
}
