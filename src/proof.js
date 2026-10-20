import fs from 'node:fs/promises';
import path from 'node:path';
import { hashTree, json, readJson } from './files.js';
import { digest } from './schema.js';

export async function createProof(dir, run) {
  await json(path.join(dir,'verification.json'),run.verification || {verdict:'NOT_TESTED',reasons:['Repair was not verified']});
  await json(path.join(dir,'provenance.json'),{tool:'Tabstitch',version:'0.1.0',node:process.version,platform:process.platform,mode:run.mode,model:run.model||{status:'NOT_TESTED',calls:0},journeyHash:run.journeyHash,sourceHashes:run.sourceHashes,attempts:run.attempts,revision:run.revision || 'uncommitted-worktree',createdAt:new Date().toISOString()});
  const summary=`# Journey repair evidence\n\nRun: ${run.id}\n\nMode: ${run.mode}\n\nVerdict: ${run.verification?.verdict || 'NOT_TESTED'}\n\n${run.verification?.scope || 'Incomplete run; no verified repair claim.'}\n\n${run.mode==='reference'?'REFERENCE PATCH REPLAY. No AI diagnosis or inference.':''}\n\nThe model may propose. Browser execution must prove. Zero axe violations does not establish full accessibility. AX tree capture is not real screen-reader testing.\n\nInspect journey.json, before/result.json, after-N/result.json, functional-before/result.json, functional-after-N/result.json, plan-N.json and diff-N.patch. Artifact hashes detect accidental edits, not malicious re-signing or publisher identity.\n`;
  await fs.writeFile(path.join(dir,'REPORT.md'),summary);
  const hashes=await hashTree(dir,['manifest.json','run.json']);
  const manifest={version:1,algorithm:'sha256',runId:run.id,journeyHash:run.journeyHash,files:hashes};
  manifest.rootHash=digest(hashes);
  await json(path.join(dir,'manifest.json'),manifest);
  return manifest;
}
export async function verifyProof(dir) {
  const manifest=await readJson(path.join(dir,'manifest.json'));
  const actual=await hashTree(dir,['manifest.json','run.json']);
  const missing=Object.keys(manifest.files).filter(k=>!(k in actual)),extra=Object.keys(actual).filter(k=>!(k in manifest.files));
  const changed=Object.keys(manifest.files).filter(k=>actual[k]!==manifest.files[k]);
  return {pass:manifest.version===1 && manifest.rootHash===digest(manifest.files) && !missing.length && !extra.length && !changed.length,missing,extra,changed};
}
