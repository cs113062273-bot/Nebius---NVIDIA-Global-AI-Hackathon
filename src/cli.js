#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { Journey } from './schema.js';
import { readJson } from './files.js';
import { fixtureServer } from './static.js';
import { launchBrowser, executeJourney } from './runner.js';
import { runRepair } from './engine.js';
import { proofArchive } from './archive.js';
import { verifyProof } from './proof.js';
import { LIVE_MODELS } from './live.js';

// CI entry point. `check` replays a project's frozen keyboard task, pointer path and guards
// against a static build; `repair` asks Nemotron (Super, then Ultra on rejection) for a patch
// and keeps it only if the browser accepts it. Both write Markdown for a PR comment.
const { positionals, values } = parseArgs({ allowPositionals: true, options: { tasks: { type: 'string', default: '.tabstitch/tasks.json' }, out: { type: 'string', default: 'tabstitch-out' }, label: { type: 'string' } } });
const [command, source] = positionals;
if (!['check', 'repair'].includes(command) || !source) { console.error('Usage: tabstitch check|repair <static-dir> [--tasks file] [--out dir]'); process.exit(2); }
const root = path.resolve(source), out = path.resolve(values.out);
const raw = await readJson(path.resolve(values.tasks));
const tasks = { journey: Journey.parse(raw.journey), functionalJourney: Journey.parse(raw.functionalJourney), guards: (raw.guards || []).map(g => Journey.parse(g)) };
const label = values.label || tasks.journey.title;
await fs.mkdir(out, { recursive: true });
const MODEL = { 'nemotron-3-super-120b-a12b': 'Nemotron 3 Super', 'Nemotron-3-Ultra-550b-a55b': 'Nemotron 3 Ultra' };
const modelName = id => MODEL[String(id || '').split('/').pop()] || String(id || 'Nemotron');
function failureText(result) {
  const step = result.steps?.find(s => s.result !== 'VERIFIED_PASS'), fail = step?.assertions?.find(a => !a.pass) || [...(result.checks || []), ...(result.functional || [])].find(a => !a.pass), a = fail?.assertion;
  const what = !a ? (result.failure?.message || 'the expected state did not occur') : a.kind === 'focus' ? `focus should be on \`${a.selector}\`, but it is on \`${step?.after?.selector || 'nothing'}\`` : a.kind === 'form-data' ? `the form should submit \`${a.name}=${JSON.stringify(a.value)}\`, but submits \`${JSON.stringify(fail.observed)}\`` : `\`${a.selector || a.kind}\` ${a.name || a.kind} expected ${JSON.stringify(a.value ?? true)}, observed ${JSON.stringify(fail.observed)}`;
  return step ? `step ${step.index + 1}, “${step.title}”: ${what}` : what;
}
const write = async (name, text) => { await fs.writeFile(path.join(out, name), text); if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, text + '\n'); };

if (command === 'check') {
  const browser = await launchBrowser(), server = await fixtureServer(root), results = [];
  try {
    for (const [name, j] of [['Keyboard task', tasks.journey], ['Pointer path', tasks.functionalJourney], ...tasks.guards.map(g => [`Guard · ${g.title}`, g])])
      results.push([name, j, await executeJourney({ browser, origin: server.origin, journey: j, dir: path.join(out, 'check', j.id) })]);
  } finally { await server.close(); await browser.close(); }
  const failed = results.filter(([, , r]) => r.verdict !== 'VERIFIED_PASS');
  const lines = [`### ↹ Tabstitch · ${label}`, '', ...results.map(([name, , r]) => `- ${r.verdict === 'VERIFIED_PASS' ? '✅' : '❌'} **${name}**${r.verdict === 'VERIFIED_PASS' ? '' : ': ' + failureText(r)}`), ''];
  await write('check.md', lines.join('\n'));
  await fs.writeFile(path.join(out, 'check.json'), JSON.stringify({ pass: !failed.length, repairable: failed.length > 0 && results[0][2].verdict === 'VERIFIED_FAIL' && results[1][2].verdict === 'VERIFIED_PASS' && results.slice(2).every(([, , r]) => r.verdict === 'VERIFIED_PASS'), results: results.map(([name, , r]) => ({ name, verdict: r.verdict })) }, null, 2));
  console.log(lines.join('\n'));
  process.exit(failed.length ? 1 : 0);
}

// repair: the budget is per CI run and enforced before every call from catalog prices.
Object.assign(process.env, { NEBIUS_BUDGET_SCOPE: 'ci', NEBIUS_MAX_CREDIT_USD: process.env.TABSTITCH_MAX_USD || '0.5', NEBIUS_MAX_CALLS: '3', NEBIUS_MAX_TOTAL_TOKENS: '900000', NEBIUS_MAX_OUTPUT_TOKENS: process.env.NEBIUS_MAX_OUTPUT_TOKENS || '32000', LIVE_NEBIUS_TESTS: 'true', NEBIUS_SPONSOR_CREDITS_CONFIRMED: process.env.NEBIUS_SPONSOR_CREDITS_CONFIRMED || 'true' });
const run = await runRepair({ fixture: 'custom-project', mode: 'nebius', sourceRoot: root, journey: tasks.journey, functionalJourney: tasks.functionalJourney, guards: tasks.guards, maxAttempts: 3, freshInference: true, models: LIVE_MODELS, artifactRoot: path.join(out, 'runs'), sourceMetadata: { kind: 'source', name: label, originalRoot: root, scope: 'CI repair of a pull request build' } });
const dir = path.join(out, 'runs', run.id), ok = run.verification?.verdict === 'VERIFIED_PASS', win = run.attempts.find(a => a.verified);
if ((await verifyProof(dir)).pass) await fs.writeFile(path.join(out, 'proof.tar.gz'), await proofArchive(dir, run.manifest));
if (win) await fs.copyFile(path.join(dir, win.diff), path.join(out, 'fix.patch'));
const lines = [`### ↹ Tabstitch · ${label}`, '', run.before ? `❌ **Keyboard task fails on this build**: ${failureText(run.before)}.` : `⚠️ ${run.verification?.reasons?.[0] || 'The baseline could not be reproduced.'}`, ''];
for (const a of run.attempts) {
  const p = a.provenance || {}, tokens = p.usage?.total_tokens;
  lines.push(`**Attempt ${a.attempt} · ${modelName(p.model)}**${p.latencyMs ? ` · ${(p.latencyMs / 1000).toFixed(1)} s` : ''}${tokens ? ` · ${tokens.toLocaleString('en-US')} tokens` : ''}`);
  if (a.plan) lines.push(`> ${a.plan.root_cause.replace(/\n+/g, ' ')}`);
  lines.push(a.verified ? '✅ The browser accepted it: keyboard task and pointer path pass' + (tasks.guards.length ? `, ${tasks.guards.length}/${tasks.guards.length} guards pass` : '') + ', no new axe findings, no console errors.' : a.category === 'APPLICATION' ? `↩️ Rejected before running: ${a.failure}. Sent back to the next attempt.` : a.category === 'VERIFICATION' ? `↩️ Rejected by the browser: ${(a.verification?.reasons || []).slice(0, 1).join('; ')}. Sent back to the next attempt.` : `⚠️ ${a.category}: ${a.failure || ''}`, '');
}
if (win) lines.push('<details open><summary>Verified patch</summary>', '', '```diff', (await fs.readFile(path.join(dir, win.diff), 'utf8')).trim(), '```', '</details>', '', `Apply it with \`git apply --directory=${path.relative(process.cwd(), root).replaceAll('\\', '/')} fix.patch\` (from the \`tabstitch\` run artifact).`, '');
else lines.push('No patch passed every gate, so nothing is suggested.', '');
lines.push('<sub>Model output is untrusted; Chromium replayed the frozen tasks and decided. Verified only for these tasks and conditions. Full captures, raw model request and response: <code>proof.tar.gz</code> in the run artifact.</sub>');
await write('repair.md', lines.join('\n'));
console.log(lines.join('\n'));
process.exit(ok ? 0 : 1);
