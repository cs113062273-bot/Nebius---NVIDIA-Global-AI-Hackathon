import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './catalog.js';
import { listFiles, readJson } from './files.js';
import { digest } from './schema.js';
import { verifyProof } from './proof.js';
import { proofArchive } from './archive.js';

// Publishes one recorded run into a read-only evidence folder. Every copied artifact must match its
// run manifest hash; run.json is a reduced, path-sanitized view. Shared by the full evidence export
// and the daily live run, so both publish runs the same way.
const textFile = /\.(json|patch|md)$/;
const keep = file => !/^candidate-/.test(file) && !/\.(dom\.html|ax\.json|axe\.json|aria\.yml|focus\.json)$/.test(file) && file !== 'provenance.json' && !file.endsWith('/result.json') && (file.endsWith('.png') || !file.includes('/'));
export const credential = /(?:Bearer\s+[A-Za-z0-9._-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|v1\.[A-Za-z0-9_-]{60,}\.[A-Za-z0-9_-]{30,})/;
// Reduced journey result: the viewer needs captures, focus and assertions, not DOM inventories.
const slim = result => result && {
 ...result,
 checkpoints: result.checkpoints?.map(c => ({ id: c.id, screenshot: c.screenshot, state: { focus: c.state?.focus && { selector: c.state.focus.selector, tag: c.state.focus.tag, bbox: c.state.focus.bbox }, dialogs: c.state?.dialogs }, axe: c.axe && { violations: c.axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })) } })),
 steps: result.steps?.map(s => ({ ...s, before: s.before && { selector: s.before.selector }, after: s.after && { selector: s.after.selector } })),
 focusGraph: result.focusGraph && { findings: result.focusGraph.findings, note: result.focusGraph.note }
};
const slimAll = list => list?.map(slim);
const sanitize = text => text.split(ROOT.replaceAll('\\', '\\\\')).join('.').split(ROOT.replaceAll('\\', '/')).join('.').split(ROOT).join('.');

export async function publishRun(dir, target, { proof = false } = {}) {
  const id = path.basename(dir);
  if (!(await verifyProof(dir)).pass) throw new Error(`Proof integrity failed for ${id}`);
  const run = await readJson(path.join(dir, 'run.json')), manifest = await readJson(path.join(dir, 'manifest.json'));
  let bytes = 0;
  for (const file of await listFiles(dir)) {
    if (!keep(file)) continue;
    const buffer = await fs.readFile(path.join(dir, file));
    if (file !== 'manifest.json' && file !== 'run.json' && manifest.files[file] !== digest(buffer)) throw new Error(`Manifest mismatch ${id}/${file}`);
    if (file === 'run.json') continue;
    if (textFile.test(file) && credential.test(buffer.toString('utf8'))) throw new Error(`Credential-like text in ${id}/${file}`);
    await fs.mkdir(path.dirname(path.join(target, file)), { recursive: true }); await fs.writeFile(path.join(target, file), buffer); bytes += buffer.length;
  }
  const view = { ...run, before: slim(run.before), after: slim(run.after), functionalBefore: slim(run.functionalBefore), functionalAfter: slim(run.functionalAfter), ...(run.guardsBefore ? { guardsBefore: slimAll(run.guardsBefore) } : {}),
    attempts: run.attempts.map(a => ({ ...a, after: slim(a.after), functionalAfter: slim(a.functionalAfter), ...(a.guardsAfter ? { guardsAfter: slimAll(a.guardsAfter) } : {}) })),
    evidenceView: { reduced: true, removed: ['checkpoint DOM inventories', 'axe pass lists', 'focus event logs'], proof: !!proof } };
  const text = sanitize(JSON.stringify(view));
  if (/C:[\\/]+Users|chinh/i.test(text) || credential.test(text)) throw new Error(`Local path or credential in ${id}/run.json`);
  await fs.writeFile(path.join(target, 'run.json'), text); bytes += text.length;
  if (proof) { const archive = await proofArchive(dir, manifest); await fs.writeFile(path.join(target, 'proof.tar.gz'), archive); bytes += archive.length; }
  const models = [...new Set(run.attempts.map(a => a.provenance?.model).filter(Boolean))];
  return { run, manifest, bytes, models };
}
