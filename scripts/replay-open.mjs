import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { runRepair } from '../src/engine.js';
import { hashTree, readJson } from '../src/files.js';
import { Journey, digest } from '../src/schema.js';
import { verifyProof } from '../src/proof.js';

// Replays an earlier model patch against an open-bug case's frozen tasks, in the browser and without
// inference. Used when a stricter case is added after review: the patch that exposed the gap is
// checked against the new task instead of being judged by hand.
// Usage: node scripts/replay-open.mjs <case-id> <run-id> <attempt>
const BASE = path.resolve('benchmarks', 'openbugs');
const [id, fromRun, attempt] = process.argv.slice(2);
assert.ok(id && fromRun && attempt, 'Usage: node scripts/replay-open.mjs <case-id> <run-id> <attempt>');
const root = path.join(BASE, id), meta = await readJson(path.join(root, 'case.json')), raw = await readJson(path.join(root, 'tasks.json')), commitment = await readJson(path.join(root, 'commitment.json'));
const tasks = { journey: Journey.parse(raw.journey), functionalJourney: Journey.parse(raw.functionalJourney), guards: (raw.guards || []).map(g => Journey.parse(g)) };
assert.equal(commitment.screen.verdict, 'REPRODUCED', 'The bug was not reproduced on the pinned source');
assert.deepEqual(await hashTree(path.join(root, 'original')), commitment.sourceHashes, 'Source changed after screening');
assert.equal(digest({ journey: tasks.journey, functionalJourney: tasks.functionalJourney, guards: tasks.guards }), commitment.taskHash, 'Tasks changed after screening');
const candidate = path.resolve('artifacts', 'runs', fromRun, `candidate-${attempt}`), source = await readJson(path.resolve('artifacts', 'runs', fromRun, 'run.json'));
await fs.access(candidate);
const run = await runRepair({ fixture: 'custom-project', mode: 'reference', sourceRoot: path.join(root, 'original'), referenceRoot: candidate, journey: tasks.journey, functionalJourney: tasks.functionalJourney, guards: tasks.guards, maxAttempts: 1,
  sourceMetadata: { kind: 'source', name: `Replay · ${meta.title}`, originalRoot: path.join(root, 'original'), scope: `Model patch from run ${fromRun}, attempt ${attempt}, replayed against this stricter task. No inference.` } });
assert.equal((await verifyProof(`artifacts/runs/${run.id}`)).pass, true);
const result = { completedAt: new Date().toISOString(), replayRun: run.id, verdict: run.verification.verdict, reasons: run.verification.reasons, fromCase: source.source?.name || null, fromRun, attempt: Number(attempt), engine: 'browser replay, no inference' };
for (let n = 1; ; n++) { const file = path.join(root, 'results', `replay-${n}.json`); try { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); break; } catch (e) { if (e.code !== 'EEXIST') throw e; } }
console.log(JSON.stringify({ replay: run.id, verdict: result.verdict, reasons: result.reasons.slice(0, 2) }));
