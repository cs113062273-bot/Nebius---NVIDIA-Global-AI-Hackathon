import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseEnv} from 'node:util';
import {runRepair} from '../src/engine.js';
import {hashTree,readJson} from '../src/files.js';
import {Journey,digest} from '../src/schema.js';
import {verifyProof} from '../src/proof.js';
import {fixtureServer} from '../src/static.js';
import {launchBrowser,executeJourney} from '../src/runner.js';

// Open-bug runs. Each case pins a library at its current head, where a reported keyboard bug is
// still unfixed. There is no maintainers' fix to screen against, so `screen` proves the reverse:
// on the unchanged source the keyboard task fails while the pointer path and every guard pass.
// `run` then asks Nemotron for a patch with the same routing and gates as the real-bug benchmark.
const BASE=path.resolve('benchmarks','openbugs'),SCOPE='openbugs-20261026',USD_CEILING='28';
const ROUTE=['nvidia/nemotron-3-super-120b-a12b','nvidia/Nemotron-3-Ultra-550b-a55b','nvidia/Nemotron-3-Ultra-550b-a55b'];
const [mode,id]=process.argv.slice(2);
// Same frozen implementation as the real-bug benchmark, so both scoreboards name one engine version.
const implementationFiles=['src/engine.js','src/nebius.js','src/repair.js','src/runner.js','src/schema.js','src/static.js','src/verifier.js'];
const CONFIG={maxOutputTokens:32000,maxPromptChars:240000,timeoutMs:300000,policies:{auto:ROUTE,super:[ROUTE[0],ROUTE[0],ROUTE[0]],ultra:[ROUTE[1],ROUTE[1],ROUTE[1]]},pageReadOnly:true};
// The library's own files are editable; the author-built page around it is read-only context.
const pageFiles=async(original,upstream=[])=>Object.keys(await hashTree(original)).filter(f=>!upstream.includes(f));

const implementation=async()=>digest({...Object.fromEntries(await Promise.all(implementationFiles.map(async f=>[f,digest(await fs.readFile(f))]))),config:digest(CONFIG)});
const write=async(file,value,flag='wx')=>fs.writeFile(file,JSON.stringify(value,null,2)+'\n',{flag});
async function load(caseId){
  const root=path.join(BASE,caseId),meta=await readJson(path.join(root,'case.json')),raw=await readJson(path.join(root,'tasks.json'));
  for(const key of ['title','library','repository','issue','pinnedCommit','summary'])assert.ok(meta[key],`case.json needs ${key}`);
  return {root,meta,original:path.join(root,'original'),tasks:{journey:Journey.parse(raw.journey),functionalJourney:Journey.parse(raw.functionalJourney),guards:(raw.guards||[]).map(g=>Journey.parse(g))}};
}
const taskHash=t=>digest({journey:t.journey,functionalJourney:t.functionalJourney,guards:t.guards});

if(mode==='screen'){
  const c=await load(id);
  try{await fs.access(path.join(c.root,'results'));throw new Error('Inference results exist; the commitment is frozen');}catch(e){if(e.code!=='ENOENT')throw e;}
  const browser=await launchBrowser(),server=await fixtureServer(c.original),out=path.join('artifacts','openbugs-screen',id),verdicts={};
  try{for(const [name,j] of [['keyboard',c.tasks.journey],['pointer',c.tasks.functionalJourney],...c.tasks.guards.map((g,i)=>[`guard-${i}`,g])])verdicts[name]=(await executeJourney({browser,origin:server.origin,journey:j,dir:path.join(out,j.id)})).verdict;}
  finally{await server.close();await browser.close();}
  const reproduced=verdicts.keyboard==='VERIFIED_FAIL'&&Object.entries(verdicts).every(([k,v])=>k==='keyboard'||v==='VERIFIED_PASS');
  await write(path.join(c.root,'commitment.json'),{fixedAt:new Date().toISOString(),sourceHashes:await hashTree(c.original),taskHash:taskHash(c.tasks),screen:{verdict:reproduced?'REPRODUCED':'NOT_REPRODUCED',verdicts}},'w');
  console.log(JSON.stringify({id,reproduced,verdicts}));
}else if(mode==='run'){
  const c=await load(id),commitment=await readJson(path.join(c.root,'commitment.json'));
  assert.equal(commitment.screen.verdict,'REPRODUCED','The bug was not reproduced on the pinned source');
  assert.deepEqual(await hashTree(c.original),commitment.sourceHashes,'Source changed after screening');
  assert.equal(taskHash(c.tasks),commitment.taskHash,'Tasks changed after screening');
  Object.assign(process.env,parseEnv(await fs.readFile('.env','utf8')));
  const ledger=await readJson('artifacts/inference/budget.json');
  Object.assign(process.env,{NEBIUS_MAX_CALLS:String(ledger.calls+3),NEBIUS_MAX_TOTAL_TOKENS:String(ledger.reservedTokens+900000),NEBIUS_MAX_CREDIT_USD:USD_CEILING,NEBIUS_BUDGET_SCOPE:SCOPE,NEBIUS_MAX_OUTPUT_TOKENS:'32000',NEBIUS_TIMEOUT_MS:'300000'});
  const run=await runRepair({fixture:'custom-project',mode:'nebius',sourceRoot:c.original,readOnly:await pageFiles(c.original,c.meta.upstreamFiles),journey:c.tasks.journey,functionalJourney:c.tasks.functionalJourney,guards:c.tasks.guards,maxAttempts:3,freshInference:true,models:ROUTE,
    sourceMetadata:{kind:'source',name:c.meta.title,originalRoot:c.original,scope:`Open upstream bug (${c.meta.issue}) at ${c.meta.pinnedCommit}, unfixed when pinned. Routing Super, then Ultra.`}});
  assert.equal((await verifyProof(`artifacts/runs/${run.id}`)).pass,true);
  const result={completedAt:new Date().toISOString(),implementation:await implementation(),modelRun:run.id,verdict:run.verification.verdict,reasons:run.verification.reasons,
    attempts:run.attempts.map(a=>({attempt:a.attempt,verified:a.verified,category:a.category,failure:a.failure?.slice(0,400),model:a.provenance?.model,requestId:a.provenance?.requestId,usage:a.provenance?.usage,latencyMs:a.provenance?.latencyMs}))};
  await fs.mkdir(path.join(c.root,'results'),{recursive:true});
  for(let n=1;;n++){const file=path.join(c.root,'results',`auto-${n}.json`);try{await write(file,result);break;}catch(e){if(e.code!=='EEXIST')throw e;}}
  console.log(JSON.stringify({run:run.id,verdict:result.verdict,attempts:result.attempts.map(a=>[a.attempt,a.model?.split('/')[1],a.verified,a.category])}));
}else{
  console.error('Usage: node scripts/openbugs.mjs screen|run <case-id>');process.exit(2);
}
