// Replays a case's pending upstream human fix (library files under js/src only) against its frozen tasks
// in the browser, without inference. Usage: node scripts/check-pending-human.mjs <open-case-id>
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { runRepair } from '../src/engine.js'; import { readJson } from '../src/files.js'; import { Journey } from '../src/schema.js';
const id = process.argv[2], root = path.join('benchmarks', 'openbugs', id), raw = await readJson(path.join(root, 'tasks.json'));
const ref = await fs.mkdtemp(path.join(os.tmpdir(), 'human-')); await fs.cp(path.join(root, 'original'), ref, { recursive: true });
const r = spawnSync('git', ['apply', '--include=js/src/*', path.resolve(root, 'pending-human-fix.patch')], { cwd: ref, encoding: 'utf8' });
if (r.status) throw new Error(r.stderr);
const run = await runRepair({ fixture: 'custom-project', mode: 'reference', sourceRoot: path.join(root, 'original'), referenceRoot: ref, journey: Journey.parse(raw.journey), functionalJourney: Journey.parse(raw.functionalJourney), guards: (raw.guards || []).map(g => Journey.parse(g)), maxAttempts: 1,
  sourceMetadata: { kind: 'source', name: `Pending human fix · ${id}`, originalRoot: path.join(root, 'original'), scope: 'Pending upstream pull request applied to the pinned source; library files only. No inference.' } });
console.log(JSON.stringify({ run: run.id, verdict: run.verification.verdict, reasons: run.verification.reasons }));
