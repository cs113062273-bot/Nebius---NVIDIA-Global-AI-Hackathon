import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, fixturePath } from '../src/catalog.js';
import { readJson, json, contained, listFiles } from '../src/files.js';
import { digest } from '../src/schema.js';
import { verifyProof } from '../src/proof.js';
import { proofArchive } from '../src/archive.js';
import { NebiusClient, SYSTEM } from '../src/nebius.js';
import { repairEvidence } from '../src/engine.js';

const out=path.join(ROOT,'public','recordings');await fs.mkdir(out,{recursive:true});
const registry=await readJson(path.join(out,'index.json')).catch(()=>({records:[]}));
const status=await readJson(path.join(ROOT,'benchmarks','live-status.json'));
const ids=new Set(registry.records.map(r=>r.runId).filter(Boolean));
for(const item of registry.records){const old=await readJson(path.join(ROOT,'public',item.path));ids.add(old.runId);}
if(status.status==='VERIFIED_PASS')ids.add(status.runId);
const records=[],assets=[];
for(const runId of ids){
 const root=await contained(path.join(ROOT,'artifacts','runs'),runId);
 if(!(await verifyProof(root)).pass)throw new Error('Original recording integrity failed: '+runId);
 const run=await readJson(path.join(root,'run.json'));
 if(run.model?.cacheHit!==false||run.verification?.verdict!=='VERIFIED_PASS')throw new Error('Expected uncached verified model repair');
 const id=run.fixture,dir=path.join(out,id);await fs.mkdir(dir,{recursive:true});
 const publicPath=file=>`recordings/${id}/`+file;
 async function copy(file,name=file){const bytes=await fs.readFile(await contained(root,file));await fs.mkdir(path.dirname(path.join(dir,name)),{recursive:true});await fs.writeFile(path.join(dir,name),bytes);assets.push({path:publicPath(name),sha256:digest(bytes)});return publicPath(name);}
 async function phase(result,prefix){
  const frames=[];
  for(const cp of result.checkpoints)frames.push({id:cp.id,image:await copy(prefix+'/'+cp.screenshot),focus:{selector:cp.state.focus?.selector||'document',name:cp.state.focus?.nameHint?.slice(0,80)||'Document',bbox:cp.state.focus?.bbox||null},dialogs:cp.state.dialogs.map(d=>({containsFocus:d.containsFocus})),assertions:cp.id==='initial'?[]:result.steps[Number(cp.id.replace('step-',''))]?.assertions||[]});
  const scan=result.checkpoints.at(-1)?.axe;
  return {verdict:result.verdict,failure:result.failure,frames,checks:result.checks,functional:result.functional,scan:scan?{violations:scan.violations.length,incomplete:scan.incomplete.length}:null};
 }
 const historical=id==='a11y-dialog';
 const data={version:1,id,title:run.journey.title,kind:historical?'Pinned open-source defect · reconstructed notice task · model-authored repair':'Synthetic checkout · model-authored repair',recordedAt:run.completedAt,runId:run.id,journeyHash:run.journeyHash,journey:run.journey,model:run.model,elapsedMs:run.elapsedMs,verification:run.verification,before:await phase(run.before,'before'),after:await phase(run.after,run.afterDir),functional:{before:run.functionalBefore.verdict,after:run.functionalAfter.verdict,assertions:run.functionalAfter.functional},plan:await readJson(path.join(root,'plan-1.json')),patch:await fs.readFile(path.join(root,'diff-1.patch'),'utf8'),files:{}};
 for(const f of ['journey.json','verification.json','provenance.json','manifest.json','plan-1.json','diff-1.patch'])data.files[f]=await copy(f);
 let raw;
 for(const file of await fs.readdir(path.join(ROOT,'artifacts','inference'))){if(!file.startsWith('response-'))continue;const response=await readJson(path.join(ROOT,'artifacts','inference',file));if(response.requestId===run.model.requestId){raw=response;break;}}
 if(!raw)throw new Error('Missing raw model response for '+run.id);
 await json(path.join(dir,'model-response.json'),raw);data.files['model-response.json']=publicPath('model-response.json');
 if(historical){
  data.source=await readJson(path.join(ROOT,'benchmarks','historical','a11y-dialog-restore','provenance.json'));data.source.evaluation='Nonblind historical reproduction; model patched type-stripped runtime JS from the pinned before revision. Not a new upstream fix or a blind benchmark.';await json(path.join(dir,'source.json'),data.source);data.files['source.json']=publicPath('source.json');
  const candidates=await Promise.all(run.candidates.map(async c=>({...c,source:await fs.readFile(await contained(fixturePath(id),c.path),'utf8')})));
  const prepared=new NebiusClient({env:{NEBIUS_MAX_OUTPUT_TOKENS:'12000'}}).prepare({candidates,evidence:repairEvidence(run.journey,run.before)});
  if(digest(prepared.content)!==run.model.promptHash)throw new Error('Reconstructed historical prompt does not match the recorded prompt hash');
  await json(path.join(dir,'request.json'),{provenance:'Reconstructed from frozen inputs; user-message SHA-256 matches the recorded promptHash. No authorization header included.',promptHash:run.model.promptHash,request:{model:run.model.model,temperature:0,max_tokens:12000,messages:[{role:'system',content:SYSTEM},{role:'user',content:prepared.content}]}});
  data.files['request.json']=publicPath('request.json');
 }
 const bundle=await proofArchive(root,run.manifest);await fs.writeFile(path.join(dir,'proof.tar.gz'),bundle);data.bundle={path:publicPath('proof.tar.gz'),bytes:bundle.length,sha256:digest(bundle)};
 for(const [label,src]of [['original',fixturePath(id)],['repaired',path.join(root,'candidate-1')]]){
  const target=path.join(ROOT,'public','previews',id,label);await fs.mkdir(target,{recursive:true});
  for(const file of await listFiles(src)){if(!(/\.(html|css|js|svg|png)$/.test(file)||/(^|\/)LICENSE$/.test(file))||file.split('/').some(p=>p.startsWith('.')))continue;const dest=path.join(target,file);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(await contained(src,file),dest);}
 }
 data.previews={before:`previews/${id}/original/index.html`,after:`previews/${id}/repaired/index.html`};
 const text=JSON.stringify(data)+JSON.stringify(raw);
 if(/(?:Bearer\s+[A-Za-z0-9._-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|v1\.[A-Za-z0-9_-]{60,}\.[A-Za-z0-9_-]{30,})/.test(text))throw new Error('Credential-like material in export');
 await json(path.join(dir,'data.json'),data);records.push({id,runId:run.id,path:publicPath('data.json'),title:historical?'Real defect · a11y-dialog':'Synthetic checkout',kind:data.kind});
}
const attempts=[];
for(const folder of await fs.readdir(path.join(ROOT,'benchmarks','live'))){
 const p=await readJson(path.join(ROOT,'benchmarks','live',folder,'provenance.json')),v=await readJson(path.join(ROOT,'benchmarks','live',folder,'verification.json'));
 if(!p.model?.requestId)continue;
 const raw=await readJson(path.join(ROOT,'benchmarks','live',folder,'model-response.json'));
 const name='attempt-'+folder+'.json';await json(path.join(out,name),{provenance:p,verification:v,response:raw});
 attempts.push({runId:folder,model:p.model.model,requestId:p.model.requestId,usage:p.model.usage,verdict:v.verdict,reasons:v.reasons,finishReason:raw.finishReason,path:'recordings/'+name});
}
await json(path.join(out,'attempts.json'),{scope:'All four recorded calls in this development sequence; not a blind benchmark or general success rate.',attempts});
await json(path.join(out,'index.json'),{version:1,records:records.sort((a,b)=>a.id==='a11y-dialog'?-1:b.id==='a11y-dialog'?1:0),assets});
console.log(JSON.stringify({recordings:records.map(r=>r.id),recordedAttempts:attempts.length,integrity:'verified',inferenceCalls:0}));
