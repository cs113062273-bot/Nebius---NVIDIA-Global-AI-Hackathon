import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { NebiusClient } from '../src/nebius.js';
import { ROOT, fixtures, journeyFor } from '../src/catalog.js';
import { runRepair, repairEvidence } from '../src/engine.js';
import { json } from '../src/files.js';
const arg=name=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:undefined;};
const fixture=arg('--fixture')||'checkout';
if(!fixtures.some(f=>f.id===fixture))throw new Error(`Unknown fixture; choose one of ${fixtures.map(f=>f.id).join(', ')}`);
const client=new NebiusClient({dir:path.join(ROOT,'artifacts','inference')});
// Keep a small tracked copy of a live run: the model's own plan, raw response, diff and the deterministic verdict.
async function archive(runId){
  const src=path.join(ROOT,'artifacts','runs',runId),dest=path.join(ROOT,'benchmarks','live',runId);await fs.mkdir(dest,{recursive:true});
  for(const f of ['plan-1.json','diff-1.patch','verification.json','provenance.json','manifest.json','REPORT.md'])await fs.copyFile(path.join(src,f),path.join(dest,f)).catch(e=>{if(e.code!=='ENOENT')throw e;});
  const key=(await fs.readFile(path.join(src,'run.json'),'utf8').then(JSON.parse)).model?.requestId;
  const inference=path.join(ROOT,'artifacts','inference');
  for(const f of await fs.readdir(inference)){if(!f.startsWith('response-'))continue;const r=JSON.parse(await fs.readFile(path.join(inference,f),'utf8'));if(r.requestId&&r.requestId===key)await json(path.join(dest,'model-response.json'),r);}
  return path.relative(ROOT,dest).replaceAll('\\','/');
}
if(arg('--archive')){console.log('Archived to',await archive(arg('--archive')));process.exit(0);}
if(process.argv.includes('--dry-run')){
  // Reproduce and localize, then size the exact request against the ledger without any provider call.
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'tabstitch-dry-'));let prepared;
  const run=await runRepair({fixture,mode:'provided',artifactRoot:tmp,maxAttempts:1,planProvider:async({candidates,before})=>{prepared=client.prepare({candidates,evidence:repairEvidence(journeyFor(fixture),before)});prepared.candidates=candidates.map(c=>({path:c.path,bytes:c.source.length}));throw new Error('dry run stops before inference');}});
  await fs.rm(tmp,{recursive:true,force:true});
  if(!prepared){console.log(JSON.stringify({fixture,status:'NOT_PREPARED',reason:run.verification?.reasons},null,2));process.exit(1);}
  const ceiling=Number(process.env.NEBIUS_MAX_TOTAL_TOKENS||30000);
  console.log(JSON.stringify({fixture,inference:'not called',promptChars:prepared.content.length,maxOutput:prepared.maxOutput,reservation:prepared.reservation,ceiling,fits:prepared.reservation<=ceiling,candidates:prepared.candidates},null,2));
}
else if(!client.configured()){const result={status:'NOT_TESTED',reason:'No enabled sponsor-only Nebius credentials',calls:0,at:new Date().toISOString()};await json(path.join(ROOT,'benchmarks','live-status.json'),result);console.log(JSON.stringify(result,null,2));process.exitCode=2;}
else{const models=await client.catalog();console.log('Available NVIDIA Nemotron models:',JSON.stringify(models));if(process.argv.includes('--repair')){const run=await runRepair({fixture,mode:'nebius',maxAttempts:1});const result={status:run.verification?.verdict,fixture,runId:run.id,model:run.model,evidence:await archive(run.id),at:new Date().toISOString()};await json(path.join(ROOT,'benchmarks','live-status.json'),result);console.log(JSON.stringify(result,null,2));if(run.verification?.verdict!=='VERIFIED_PASS')process.exitCode=1;}else console.log('Catalog check only. Set NEBIUS_MODEL to one of these IDs, then add --repair [--fixture <id>] for one bounded repair attempt.');}
