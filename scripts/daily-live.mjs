import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '../src/catalog.js';
import { readJson, json, hashTree } from '../src/files.js';
import { runRepair } from '../src/engine.js';
import { liveCases, openCases, loadCase, LIVE_MODELS, entryCost } from '../src/live.js';
import { Journey } from '../src/schema.js';
import { publishRun } from '../src/publish.js';

// One fresh, budget-capped Nemotron repair per day, run by .github/workflows/daily-live.yml during
// judging. The case rotates through the screened real bugs and the open bugs by date, so the site
// shows a dated run that was made that day, not only the October recordings.
const MAX_USD = process.env.TABSTITCH_MAX_USD || '0.5';
const day = new Date().toISOString().slice(0, 10), dayIndex = Math.floor(Date.parse(day) / 86400000);
const pool = [...(await liveCases()).map(c => ({ kind: 'real', id: c.id, title: c.title, library: c.library })), ...(await openCases()).map(c => ({ kind: 'open', id: c.id, title: c.title, library: c.library }))];
if (!pool.length) throw new Error('No screened cases');
const pick = pool[dayIndex % pool.length];

async function openCase(id) {
  const root = path.join(ROOT, 'benchmarks', 'openbugs', id), commitment = await readJson(path.join(root, 'commitment.json')), original = path.join(root, 'original');
  if (commitment.screen?.verdict !== 'REPRODUCED') throw new Error('Case is not reproduced');
  if (JSON.stringify(await hashTree(original)) !== JSON.stringify(commitment.sourceHashes)) throw new Error('Case source changed after screening');
  const raw = await readJson(path.join(root, 'tasks.json')), meta = await readJson(path.join(root, 'case.json'));
  return { meta, original, journey: Journey.parse(raw.journey), functionalJourney: Journey.parse(raw.functionalJourney), guards: (raw.guards || []).map(g => Journey.parse(g)) };
}
const c = pick.kind === 'real' ? await loadCase(pick.id) : await openCase(pick.id);

// Per-run ceilings from catalog prices, in a scope of its own; the CI ledger starts empty.
Object.assign(process.env, { NEBIUS_BUDGET_SCOPE: `daily-${day}`, NEBIUS_MAX_CREDIT_USD: MAX_USD, NEBIUS_MAX_CALLS: '3', NEBIUS_MAX_TOTAL_TOKENS: '900000', NEBIUS_MAX_OUTPUT_TOKENS: '32000', NEBIUS_TIMEOUT_MS: '300000', LIVE_NEBIUS_TESTS: 'true', NEBIUS_SPONSOR_CREDITS_CONFIRMED: 'true' });
const run = await runRepair({ fixture: 'custom-project', mode: 'nebius', sourceRoot: c.original, journey: c.journey, functionalJourney: c.functionalJourney, guards: c.guards, maxAttempts: 3, freshInference: true, models: LIVE_MODELS,
  sourceMetadata: { kind: 'source', name: `Daily live run · ${pick.title}`, originalRoot: c.original, scope: `Fresh Nemotron run on ${day} in GitHub Actions; ${pick.kind === 'real' ? 'blind to the maintainers’ fix' : 'bug still unfixed upstream'}.` } });

const dir = path.join(ROOT, 'artifacts', 'runs', run.id), target = path.join(ROOT, 'public', 'evidence', 'runs', run.id);
await publishRun(dir, target, { proof: true });
const ledger = await readJson(path.join(ROOT, 'artifacts', 'inference', 'budget.json')).catch(() => ({ entries: [] }));
const costUsd = +ledger.entries.filter(e => e.budgetScope === `daily-${day}`).reduce((s, e) => s + entryCost(e), 0).toFixed(4);
const passed = run.attempts.find(a => a.verified);
const entry = { date: day, at: new Date().toISOString(), run: run.id, kind: pick.kind, case: pick.id, title: pick.title, library: pick.library, verdict: run.verification?.verdict || 'INCONCLUSIVE', passedOn: passed?.attempt || null,
  models: run.attempts.map(a => a.provenance?.model?.split('/')[1] || null), costUsd,
  actionsRun: process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null };
const indexFile = path.join(ROOT, 'public', 'live-runs', 'index.json');
const index = await readJson(indexFile).catch(() => ({ runs: [] }));
index.note = 'Fresh Nemotron runs made by GitHub Actions on the date shown, one per day during judging, each capped at US$' + MAX_USD + '. Earlier October runs are recordings.';
index.runs = [entry, ...index.runs.filter(x => x.run !== run.id)];
await fs.mkdir(path.dirname(indexFile), { recursive: true }); await json(indexFile, index);
console.log(JSON.stringify(entry));
