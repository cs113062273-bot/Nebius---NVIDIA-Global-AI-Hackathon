import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '../src/catalog.js';
import { readJson, json, hashTree } from '../src/files.js';
import { runRepair } from '../src/engine.js';
import { liveCases, openCases, loadCase, LIVE_MODELS, entryCost } from '../src/live.js';
import { Journey } from '../src/schema.js';
import { publishRun } from '../src/publish.js';

// A fresh, budget-capped Nemotron repair made in GitHub Actions. Two triggers:
// - .github/workflows/daily-live.yml: one run per day during judging, the case rotating by date;
// - .github/workflows/judge-live.yml: anyone opens a "[live run] <case-id>" issue and gets the run
//   on that case, with the verdict posted back on the issue. The case id must name a screened case
//   directory; nothing else from the issue is used.
// Each run writes its own public/live-runs/runs/<date>-<run>.json, so concurrent runs never edit the
// same file; build-demo.js merges them into live-runs/index.json for the site.
const MAX_USD = process.env.TABSTITCH_MAX_USD || '0.5';
const DAILY_CAP = Number(process.env.TABSTITCH_DAILY_CAP || 12), PER_PERSON_CAP = Number(process.env.TABSTITCH_PERSON_CAP || 3);
const day = new Date().toISOString().slice(0, 10), dayIndex = Math.floor(Date.parse(day) / 86400000);
const issue = process.env.TABSTITCH_ISSUE ? { number: Number(process.env.TABSTITCH_ISSUE), by: String(process.env.TABSTITCH_REQUESTER || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 39) } : null;
const runsDir = path.join(ROOT, 'public', 'live-runs', 'runs'), resultFile = path.join(ROOT, 'artifacts', 'live-result.json');
const pool = [...(await liveCases()).map(c => ({ kind: 'real', id: c.id, title: c.title, library: c.library })), ...(await openCases()).map(c => ({ kind: 'open', id: c.id, title: c.title, library: c.library }))];
if (!pool.length) throw new Error('No screened cases');

async function finish(result) { await fs.mkdir(path.dirname(resultFile), { recursive: true }); await json(resultFile, result); console.log(JSON.stringify(result)); }
async function earlier() { const out = []; for (const f of await fs.readdir(runsDir).catch(() => [])) if (f.endsWith('.json')) out.push(await readJson(path.join(runsDir, f)).catch(() => null)); return out.filter(Boolean); }

let pick;
if (issue) {
  // The title wins over the form's dropdown. Ids are matched whole, so one cannot match inside another.
  const named = text => pool.find(c => new RegExp(`(^|[^a-z0-9-])${c.id}($|[^a-z0-9-])`).test(text));
  pick = named(process.env.TABSTITCH_ISSUE_TITLE || '') || named(process.env.TABSTITCH_ISSUE_BODY || '');
  if (!pick) { await finish({ status: 'NO_CASE', cases: pool.map(c => c.id) }); process.exit(0); }
  const today = (await earlier()).filter(x => x.date === day && x.trigger === 'issue');
  if (today.length >= DAILY_CAP) { await finish({ status: 'DAILY_CAP', cap: DAILY_CAP, case: pick.id }); process.exit(0); }
  if (issue.by && today.filter(x => x.requester === issue.by).length >= PER_PERSON_CAP) { await finish({ status: 'PERSON_CAP', cap: PER_PERSON_CAP, case: pick.id }); process.exit(0); }
} else pick = pool[dayIndex % pool.length];

async function openCase(id) {
  const root = path.join(ROOT, 'benchmarks', 'openbugs', id), commitment = await readJson(path.join(root, 'commitment.json')), original = path.join(root, 'original');
  if (commitment.screen?.verdict !== 'REPRODUCED') throw new Error('Case is not reproduced');
  if (JSON.stringify(await hashTree(original)) !== JSON.stringify(commitment.sourceHashes)) throw new Error('Case source changed after screening');
  const raw = await readJson(path.join(root, 'tasks.json')), meta = await readJson(path.join(root, 'case.json'));
  return { meta, original, journey: Journey.parse(raw.journey), functionalJourney: Journey.parse(raw.functionalJourney), guards: (raw.guards || []).map(g => Journey.parse(g)) };
}
const c = pick.kind === 'real' ? await loadCase(pick.id) : await openCase(pick.id);

// Per-run ceilings from catalog prices, in a scope of its own; the CI ledger starts empty.
const scope = issue ? `issue-${issue.number}` : `daily-${day}`;
Object.assign(process.env, { NEBIUS_BUDGET_SCOPE: scope, NEBIUS_MAX_CREDIT_USD: MAX_USD, NEBIUS_MAX_CALLS: '3', NEBIUS_MAX_TOTAL_TOKENS: '900000', NEBIUS_MAX_OUTPUT_TOKENS: '32000', NEBIUS_TIMEOUT_MS: '300000', LIVE_NEBIUS_TESTS: 'true', NEBIUS_SPONSOR_CREDITS_CONFIRMED: 'true' });
const started = Date.now();
const run = await runRepair({ fixture: 'custom-project', mode: 'nebius', sourceRoot: c.original, journey: c.journey, functionalJourney: c.functionalJourney, guards: c.guards, maxAttempts: 3, freshInference: true, models: LIVE_MODELS,
  sourceMetadata: { kind: 'source', name: `${issue ? `Live run requested in issue #${issue.number}` : 'Daily live run'} · ${pick.title}`, originalRoot: c.original, scope: `Fresh Nemotron run on ${day} in GitHub Actions; ${pick.kind === 'real' ? 'blind to the maintainers’ fix' : 'bug still unfixed upstream'}.` } });

const dir = path.join(ROOT, 'artifacts', 'runs', run.id), target = path.join(ROOT, 'public', 'evidence', 'runs', run.id);
await publishRun(dir, target, { proof: true });
const ledger = await readJson(path.join(ROOT, 'artifacts', 'inference', 'budget.json')).catch(() => ({ entries: [] }));
const costUsd = +ledger.entries.filter(e => e.budgetScope === scope).reduce((s, e) => s + entryCost(e), 0).toFixed(4);
const passed = run.attempts.find(a => a.verified);
const entry = { date: day, at: new Date().toISOString(), run: run.id, kind: pick.kind, case: pick.id, title: pick.title, library: pick.library, verdict: run.verification?.verdict || 'INCONCLUSIVE', passedOn: passed?.attempt || null,
  models: run.attempts.map(a => a.provenance?.model?.split('/')[1] || null), failures: run.attempts.map(a => a.verified ? null : String(a.failure || a.verification?.reasons?.[0] || '').slice(0, 240)), costUsd, seconds: Math.round((Date.now() - started) / 1000),
  trigger: issue ? 'issue' : 'schedule', ...(issue ? { issue: issue.number, requester: issue.by } : {}),
  actionsRun: process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null };
await fs.mkdir(runsDir, { recursive: true }); await json(path.join(runsDir, `${day}-${run.id}.json`), entry);
await finish({ status: 'RAN', ...entry });
