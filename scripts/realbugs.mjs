import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseEnv} from 'node:util';
import {runRepair} from '../src/engine.js';
import {hashTree,readJson} from '../src/files.js';
import {Journey,digest} from '../src/schema.js';
import {verifyProof} from '../src/proof.js';

// Real-bug benchmark. Each case pins an upstream library at the commit before a published
// maintainer fix, wraps it in an author-written consumer page and freezes a browser task.
// `screen` proves the task fails on the buggy source and passes with the maintainers' own
// fix (no inference). `run` gives Nemotron only the buggy source; the human fix is never sent.
const BASE=path.resolve('benchmarks','realbugs'),SCOPE='realbugs-20261025',USD_CEILING='15';
const ROUTE={super:'nvidia/nemotron-3-super-120b-a12b',ultra:'nvidia/Nemotron-3-Ultra-550b-a55b'};
// Everyday calls go to Super; a rejected patch escalates to Ultra with the browser's failure attached.
const POLICIES={auto:[ROUTE.super,ROUTE.ultra,ROUTE.ultra],super:[ROUTE.super,ROUTE.super,ROUTE.super],ultra:[ROUTE.ultra,ROUTE.ultra,ROUTE.ultra]};
const implementationFiles=['src/engine.js','src/nebius.js','src/repair.js','src/runner.js','src/schema.js','src/verifier.js'];
const [mode,id,policy='auto']=process.argv.slice(2);
const write=async(file,value,flag='wx')=>fs.writeFile(file,JSON.stringify(value,null,2)+'\n',{flag});
// Run settings are part of the frozen implementation: changing a limit is a new scoreboard, not a retry.
const CONFIG={maxOutputTokens:32000,maxPromptChars:240000,timeoutMs:300000,policies:POLICIES};
const implementation=async()=>({...Object.fromEntries(await Promise.all(implementationFiles.map(async f=>[f,digest(await fs.readFile(f))]))),config:digest(CONFIG)});

async function load(caseId){
  const root=path.join(BASE,caseId),meta=await readJson(path.join(root,'case.json')),raw=await readJson(path.join(root,'tasks.json'));
  const tasks={journey:Journey.parse(raw.journey),functionalJourney:Journey.parse(raw.functionalJourney),guards:(raw.guards||[]).map(g=>Journey.parse(g))};
  for(const key of ['title','library','repository','issue','buggyCommit','fixCommit','summary'])assert.ok(meta[key],`case.json needs ${key}`);
  return {root,meta,tasks,original:path.join(root,'original'),fix:path.join(root,'human-fix')};
}
const taskHash=t=>digest({journey:t.journey,functionalJourney:t.functionalJourney,guards:t.guards});
async function committed(c){
  const commitment=await readJson(path.join(c.root,'commitment.json'));
  assert.equal(commitment.screen.verdict,'VERIFIED_PASS','Case did not pass screening; it is not eligible for inference');
  assert.deepEqual(await hashTree(c.original),commitment.sourceHashes,'Buggy source changed after screening');
  assert.equal(taskHash(c.tasks),commitment.taskHash,'Tasks changed after screening');
  return commitment;
}
async function nextFile(dir,prefix){await fs.mkdir(dir,{recursive:true});for(let n=1;;n++){const file=path.join(dir,`${prefix}-${n}.json`);try{await fs.access(file);}catch{return file;}}}

if(mode==='screen'){
  const c=await load(id);
  try{await fs.access(path.join(c.root,'results'));throw new Error('Inference results exist; the commitment is frozen');}catch(e){if(e.code!=='ENOENT')throw e;}
  // The maintainers' fix may only touch upstream library files, never the consumer page or tasks.
  const before=await hashTree(c.original),after=await hashTree(c.fix),changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(f=>before[f]!==after[f]);
  assert.ok(changed.length,'human-fix is identical to original');
  for(const f of changed)assert.ok((c.meta.upstreamFiles||[]).includes(f),`human-fix changes ${f}, which is not a listed upstream file`);
  const run=await runRepair({fixture:'custom-project',mode:'reference',sourceRoot:c.original,referenceRoot:c.fix,journey:c.tasks.journey,functionalJourney:c.tasks.functionalJourney,guards:c.tasks.guards,maxAttempts:1,
    sourceMetadata:{kind:'source',name:`Screening · maintainers' fix · ${c.meta.title}`,originalRoot:c.original,scope:`Published upstream fix ${c.meta.fixCommit} replayed against the frozen task. No inference.`}});
  assert.equal((await verifyProof(`artifacts/runs/${run.id}`)).pass,true);
  const screen={run:run.id,verdict:run.verification.verdict,reasons:run.verification.reasons,baseline:{keyboard:run.before?.verdict,pointer:run.functionalBefore?.verdict,guards:(run.guardsBefore||[]).map(g=>g.verdict)}};
  await write(path.join(c.root,'commitment.json'),{fixedAt:new Date().toISOString(),sourceHashes:before,humanFixHashes:after,humanFixFiles:changed,taskHash:taskHash(c.tasks),implementation:await implementation(),screen},'w');
  console.log(JSON.stringify(screen,null,1));
}else if(mode==='run'){
  const c=await load(id),commitment=await committed(c),models=POLICIES[policy];assert.ok(models,'Policy must be auto, super or ultra');
  Object.assign(process.env,parseEnv(await fs.readFile('.env','utf8')));
  const ledger=await readJson('artifacts/inference/budget.json');
  Object.assign(process.env,{NEBIUS_MAX_CALLS:String(ledger.calls+3),NEBIUS_MAX_TOTAL_TOKENS:String(ledger.reservedTokens+900000),NEBIUS_MAX_CREDIT_USD:USD_CEILING,NEBIUS_BUDGET_SCOPE:SCOPE,NEBIUS_MAX_OUTPUT_TOKENS:String(CONFIG.maxOutputTokens),NEBIUS_TIMEOUT_MS:String(CONFIG.timeoutMs)});
  const run=await runRepair({fixture:'custom-project',mode:'nebius',sourceRoot:c.original,journey:c.tasks.journey,functionalJourney:c.tasks.functionalJourney,guards:c.tasks.guards,maxAttempts:3,freshInference:true,models,
    sourceMetadata:{kind:'source',name:c.meta.title,originalRoot:c.original,scope:`Real upstream bug (${c.meta.issue}) at ${c.meta.buggyCommit}. Blind to the maintainers' fix ${c.meta.fixCommit}; routing ${policy}.`}});
  assert.equal((await verifyProof(`artifacts/runs/${run.id}`)).pass,true);await committed(c);
  // The request must not contain any line the maintainers added.
  const requests=(await Promise.all(run.attempts.filter(a=>a.provenance?.requestFile).map(a=>fs.readFile(`artifacts/runs/${run.id}/model-request-${a.attempt}.json`,'utf8')))).join('\n');
  const added=[];for(const f of commitment.humanFixFiles){const b=new Set((await fs.readFile(path.join(c.original,f),'utf8').catch(()=>'')).split('\n').map(l=>l.trim()));for(const l of (await fs.readFile(path.join(c.fix,f),'utf8').catch(()=>'')).split('\n').map(l=>l.trim()))if(l.length>24&&!b.has(l))added.push(l);}
  const leaked=added.filter(l=>requests.includes(JSON.stringify(l).slice(1,-1)));
  const result={completedAt:new Date().toISOString(),policy,modelRun:run.id,verdict:run.verification.verdict,reasons:run.verification.reasons,humanFixLinesInRequest:leaked.length,implementation:digest(await implementation()),
    attempts:run.attempts.map(a=>({attempt:a.attempt,verified:a.verified,category:a.category,failure:a.failure?.slice(0,400),model:a.provenance?.model,requestId:a.provenance?.requestId,usage:a.provenance?.usage,latencyMs:a.provenance?.latencyMs,reservedCreditUsd:a.provenance?.reservedCreditUsd}))};
  await write(await nextFile(path.join(c.root,'results'),policy),result);
  console.log(JSON.stringify({run:run.id,verdict:result.verdict,attempts:result.attempts.map(a=>[a.attempt,a.model?.split('/')[1],a.verified,a.category,a.failure?.slice(0,140)])},null,1));
}else if(mode==='summary'){
  const rows=[];
  for(const caseId of (await fs.readdir(BASE,{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name).sort()){
    if(!await Promise.all(['case.json','tasks.json'].map(f=>fs.access(path.join(BASE,caseId,f)))).then(()=>true,()=>false))continue;
    const c=await load(caseId),commitment=await readJson(path.join(c.root,'commitment.json')).catch(()=>null);
    const results=[];for(const f of (await fs.readdir(path.join(c.root,'results')).catch(()=>[])).sort())results.push({file:f,...await readJson(path.join(c.root,'results',f))});
    rows.push({id:caseId,title:c.meta.title,library:c.meta.library,issue:c.meta.issue,fixCommit:c.meta.fixCommit,screen:commitment?.screen?.verdict||'NOT_SCREENED',screenRun:commitment?.screen?.run||null,
      results:results.map(r=>({file:r.file,policy:r.policy,implementation:r.implementation||null,run:r.modelRun,verdict:r.verdict,passedOn:r.attempts.find(a=>a.verified)?.attempt||null,passedModel:r.attempts.find(a=>a.verified)?.model||null,attempts:r.attempts.length,tokens:r.attempts.reduce((s,a)=>s+(a.usage?.total_tokens||0),0),leaked:r.humanFixLinesInRequest}))});
  }
  // The scoreboard counts one run per case with the current, frozen implementation; earlier runs stay listed as history.
  const current=digest(await implementation()),eligible=rows.filter(r=>r.screen==='VERIFIED_PASS'),first=eligible.map(r=>r.results.filter(x=>x.policy==='auto'&&x.implementation===current).at(0)).filter(Boolean);
  // Every earlier frozen implementation keeps its own score, so a rerun never hides the previous result.
  const hashes=[...new Set(eligible.flatMap(r=>r.results.filter(x=>x.policy==='auto'&&x.implementation).map(x=>x.implementation)))];
  const versions=hashes.map(h=>{const runs=eligible.map(r=>r.results.find(x=>x.policy==='auto'&&x.implementation===h)).filter(Boolean);return {implementation:h,current:h===current,autoRuns:runs.length,autoVerified:runs.filter(r=>r.verdict==='VERIFIED_PASS').length,firstRun:runs.map(r=>r.run).sort()[0]};});
  const summary={generatedAt:new Date().toISOString(),implementation:current,cases:rows.length,eligible:eligible.length,autoRuns:first.length,autoVerified:first.filter(r=>r.verdict==='VERIFIED_PASS').length,versions,rows};
  await write(path.join(BASE,'summary.json'),summary,'w');
  console.log(JSON.stringify({cases:summary.cases,eligible:summary.eligible,autoRuns:summary.autoRuns,autoVerified:summary.autoVerified},null,1));
  for(const r of rows)console.log(r.id.padEnd(34),r.screen.padEnd(14),r.results.map(x=>`${x.policy}:${x.verdict}${x.passedOn?'@'+x.passedOn:''}`).join(' '));
}else{console.log('Usage: node scripts/realbugs.mjs screen|run|summary <case-id> [auto|super|ultra]');process.exit(1);}
