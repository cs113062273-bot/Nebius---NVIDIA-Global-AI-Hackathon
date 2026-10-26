import fs from 'node:fs/promises';
import path from 'node:path';
import { readJson, json } from '../src/files.js';

// Per-model observations of Nemotron on Nebius Token Factory, for docs/nebius_feedback.md and
// docs/nvidia_feedback.md. No inference: it reads the local call ledger (gitignored) and the run
// records, and publishes only aggregates. Costs use the catalog prices recorded with each call.
const ROOT = path.resolve('.'), out = path.join(ROOT, 'public', 'inference-stats.json');
const ledger = await readJson(path.join(ROOT, 'artifacts', 'inference', 'budget.json'));
const q = (list, p) => { const s = list.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const short = m => String(m || '').split('/').pop();
const models = {};
for (const e of ledger.entries) {
  const m = models[short(e.model)] ??= { calls: 0, completed: 0, truncated: 0, unusable: 0, noOutcome: 0, other: 0, latencyMs: [], promptTokens: [], completionTokens: [], reasoningTokens: [], usd: 0, first: e.at, last: e.at };
  m.calls++; m.last = e.at;
  if (e.status === 'COMPLETED') m.completed++;
  else if (e.finishReason === 'length') m.truncated++;
  else if (/Invalid\/failed model completion/.test(e.error || '')) m.unusable++;
  else if (e.status === 'RESERVED') m.noOutcome++;
  else m.other++;
  if (e.usage) {
    m.latencyMs.push(e.latencyMs); m.promptTokens.push(e.usage.prompt_tokens); m.completionTokens.push(e.usage.completion_tokens);
    m.reasoningTokens.push(e.usage.completion_tokens_details?.reasoning_tokens ?? null);
    m.usd += (e.usage.prompt_tokens || 0) * Number(e.pricing?.prompt || 0) + (e.usage.completion_tokens || 0) * Number(e.pricing?.completion || 0);
  }
}
// What happened to each model's proposals in the browser-verified repair runs.
const outcomes = {};
for (const id of await fs.readdir(path.join(ROOT, 'artifacts', 'runs'))) {
  const run = await readJson(path.join(ROOT, 'artifacts', 'runs', id, 'run.json')).catch(() => null);
  if (run?.mode !== 'nebius') continue;
  for (const a of run.attempts || []) {
    const m = short(a.provenance?.model); if (!m) continue;
    const o = outcomes[m] ??= { attempts: 0, verified: 0, byCategory: {} };
    o.attempts++; if (a.verified) o.verified++;
    else { const c = a.category || 'OTHER'; o.byCategory[c] = (o.byCategory[c] || 0) + 1; }
  }
}
const summary = Object.fromEntries(Object.entries(models).map(([name, m]) => [name, {
  calls: m.calls, completed: m.completed, truncatedAtOutputLimit: m.truncated, unusableOutput: m.unusable, noRecordedOutcome: m.noOutcome, otherFailures: m.other,
  latencySeconds: { p50: +(q(m.latencyMs, .5) / 1000).toFixed(1), p90: +(q(m.latencyMs, .9) / 1000).toFixed(1) },
  promptTokensP50: q(m.promptTokens, .5), completionTokensP50: q(m.completionTokens, .5), reasoningTokensP50: q(m.reasoningTokens, .5),
  catalogUsd: +m.usd.toFixed(2), usdPerCompletedCall: m.completed ? +(m.usd / m.completed).toFixed(4) : null,
  firstCall: m.first.slice(0, 10), lastCall: m.last.slice(0, 10), repairAttempts: outcomes[name] || null,
}]));
const stats = {
  generatedAt: new Date().toISOString(),
  note: 'Every call made from this project\'s local machine to Nebius Token Factory, from the call ledger; GitHub Actions live runs keep their own ledgers and are not included. No recorded outcome: reserved but never completed (in flight, or the process stopped). Unusable output: a completion that ended normally but was not valid JSON for the repair schema. Repair attempts: what Chromium and the gates decided about each model\'s parsed proposals.',
  calls: ledger.entries.length, catalogUsd: +Object.values(summary).reduce((s, m) => s + m.catalogUsd, 0).toFixed(2), models: summary,
};
await json(out, stats);
console.log(JSON.stringify(stats, null, 1));
