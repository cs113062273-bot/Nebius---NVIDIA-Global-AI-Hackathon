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
export const LIVE_SCOPE = 'live-judge';
export const LIVE_MODELS = ['nvidia/nemotron-3-super-120b-a12b', 'nvidia/Nemotron-3-Ultra-550b-a55b', 'nvidia/Nemotron-3-Ultra-550b-a55b'];
// Worst case for one run: three calls at the output ceiling plus a large prompt, at Ultra prices.
export const WORST_RUN_USD = 0.3;

export async function liveCases() {
  const out = [];
  for (const entry of await fs.readdir(CASES, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory()) continue;
    const root = path.join(CASES, entry.name);
    const meta = await readJson(path.join(root, 'case.json')).catch(() => null), commitment = await readJson(path.join(root, 'commitment.json')).catch(() => null);
    if (!meta || commitment?.screen?.verdict !== 'VERIFIED_PASS') continue;
    const results = [];
    for (const f of (await fs.readdir(path.join(root, 'results')).catch(() => [])).sort()) results.push(await readJson(path.join(root, 'results', f)));
    const recorded = results.filter(r => r.policy === 'auto').at(-1) || results.at(-1) || null;
    out.push({ id: entry.name, title: meta.title, summary: meta.summary, library: meta.library, category: meta.category || null, repository: meta.repository, issue: meta.issue, fixUrl: meta.fixUrl || null, fixCommit: meta.fixCommit, buggyCommit: meta.buggyCommit, split: meta.split || 'holdout', screenRun: commitment.screen.run,
      recorded: recorded && { run: recorded.modelRun, verdict: recorded.verdict, passedOn: recorded.attempts.find(a => a.verified)?.attempt || null, models: recorded.attempts.map(a => a.model?.split('/')[1] || null) } });
  }
  return out.sort((a, b) => a.library.localeCompare(b.library) || a.id.localeCompare(b.id));
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
