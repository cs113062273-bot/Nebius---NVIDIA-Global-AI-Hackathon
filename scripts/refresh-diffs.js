import fs from 'node:fs/promises';
import path from 'node:path';
import { checkedDiff } from '../src/diff.js';
import { ROOT,fixturePath } from '../src/catalog.js';
import { listFiles,json,readJson } from '../src/files.js';

// Add review derivatives; never rewrite archived plans, patches or proof manifests.
for(const item of (await readJson('public/recordings/index.json')).records){
 const record=await readJson(path.join('public',item.path)),base=fixturePath(item.id),candidate=path.join(ROOT,'artifacts','runs',record.runId,'candidate-1'),changes=[];
 for(const file of await listFiles(candidate)){const before=await fs.readFile(path.join(base,file)),after=await fs.readFile(path.join(candidate,file));if(!before.equals(after))changes.push({path:file,before,after});}
 const model=await checkedDiff(changes),dir=path.join('public','recordings',item.id);await fs.writeFile(path.join(dir,'review-model.patch'),model.patch);
 const comparison={model:{path:`recordings/${item.id}/review-model.patch`,...model.patchValidation},provenance:'New contextual review diff derived from original source and the recorded candidate. Original exported diff and complete proof remain unchanged.'};
 if(item.id==='a11y-dialog'){
  for(const [label,file]of [['human-runtime','src/a11y-dialog.js'],['upstream-typescript','src/a11y-dialog.ts']]){const before=await fs.readFile(path.join(base,file)),after=await fs.readFile(path.join(fixturePath(item.id,'reference'),file)),diff=await checkedDiff([{path:file,before,after}]);await fs.writeFile(path.join(dir,label+'.patch'),diff.patch);comparison[label]={path:`recordings/${item.id}/${label}.patch`,...diff.patchValidation};}
  comparison.humanSource=record.source.fix;comparison.humanScope='Published human TypeScript change and its type-stripped runtime reconstruction. Neither is a model repair.';
 }
 await json(path.join(dir,'diff-comparison.json'),comparison);
}
console.log('Contextual review diffs checked; original archives preserved.');
