import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '../src/catalog.js';
import { readJson,json,contained } from '../src/files.js';
import { digest } from '../src/schema.js';

const measured=await readJson(path.join(ROOT,'benchmarks','results.json'));
const benchmarkRoot=await contained(ROOT,measured.artifactRoot.replaceAll('\\','/')).catch(()=>null);
const out=path.join(ROOT,'public','casebook');await fs.mkdir(out,{recursive:true});
const cases=[];
async function add({id,title,kicker,impact,explanation,before,after,beforeRoot,afterRoot,provenance,patch,gate}) {
  const images={};
  for(const [phase,result,root]of [['before',before,beforeRoot],['after',after,afterRoot]]) {
    const checkpoint=result.checkpoints.at(-1);if(!checkpoint)throw new Error('Casebook requires executed checkpoint evidence');
    const image=await fs.readFile(await contained(root,checkpoint.screenshot));const name=id+'-'+phase+'.png';await fs.writeFile(path.join(out,name),image);
    images[phase]={src:'/casebook/'+name,sha256:digest(image),checkpoint:checkpoint.id,verdict:result.verdict,
      focus:checkpoint.state.focus?.selector||'document',focusPath:checkpoint.state.focusEvents.map(e=>e.to),
      axe:checkpoint.axe?{violations:checkpoint.axe.violations.length,incomplete:checkpoint.axe.incomplete.length}:null,
      failure:result.failure,assertions:result.steps.at(-1)?.assertions||[],functional:result.functional};
  }
  cases.push({id,title,kicker,impact,explanation,images,provenance,patch,gate,journeyHash:before.journeyHash});
}
const latestLive=await readJson(path.join(ROOT,'benchmarks','live-status.json'));
const checkoutRecording=await readJson(path.join(ROOT,'public','recordings','checkout','data.json')).catch(()=>null);
const live=latestLive.fixture==='checkout'?latestLive:checkoutRecording?{status:'VERIFIED_PASS',runId:checkoutRecording.runId,evidence:'benchmarks/live/'+checkoutRecording.runId}:latestLive;
if(live.status==='VERIFIED_PASS'&&live.runId){
  const liveRoot=path.join(ROOT,'artifacts','runs',live.runId),lr=await readJson(path.join(liveRoot,'run.json'));
  if(lr.verification?.verdict!=='VERIFIED_PASS'||lr.model?.cacheHit!==false)throw new Error('Live case must be an uncached, verified Nemotron run');
  const plan=await readJson(path.join(liveRoot,'plan-1.json'));
  await add({id:'live-repair',title:'Nemotron wrote the fix. The same task proved it.',kicker:'LIVE NVIDIA NEMOTRON REPAIR',
    impact:'The scanner reports zero violations, yet Enter opens a checkout dialog that keyboard focus never enters. A keyboard user cannot place the order.',
    explanation:'NVIDIA Nemotron on Nebius Token Factory read the failed journey and the source, then proposed this patch: '+plan.repair_strategy+' Tabstitch applied it in a disposable copy and replayed the identical keyboard journey plus the pointer functional check.',
    before:lr.before,after:lr.after,beforeRoot:path.join(liveRoot,'before'),afterRoot:path.join(liveRoot,lr.afterDir),
    provenance:{kind:'Synthetic application · live NVIDIA Nemotron proposal',isAI:true,recorded:true,runId:lr.id,recordedAt:lr.completedAt,model:lr.model.model,requestId:lr.model.requestId,latencyMs:lr.model.latencyMs,usage:lr.model.usage,evidence:live.evidence},
    patch:await fs.readFile(path.join(liveRoot,'diff-1.patch'),'utf8'),gate:lr.verification});
}
if(benchmarkRoot && await fs.access(path.join(ROOT,'artifacts','historical')).then(()=>true,()=>false)) {
const positive=measured.reference.rows.find(r=>r.fixture==='account'&&r.verdict==='VERIFIED_PASS');
if(!positive)throw new Error('No executed account evidence available');
const positiveRoot=path.join(benchmarkRoot,positive.runId),run=await readJson(path.join(positiveRoot,'run.json'));
await add({id:'scanner-blindspot',title:'The scan is clear. The person is stuck.',kicker:'01 / WHAT A SCANNER MISSES',
  impact:'The email field works, but Tab never reaches the mouse-only account action. The person can enter their details and still cannot submit this keyboard task.',
  explanation:'Tabstitch checks what happened to the person’s interaction, then replays the same task after the source repair. The receipt and submitted input must still match.',
  before:run.before,after:run.after,beforeRoot:path.join(positiveRoot,'before'),afterRoot:path.join(positiveRoot,run.afterDir),
  provenance:{kind:'Synthetic application · author reference patch',isAI:false,recorded:true,runId:run.id,recordedAt:run.completedAt,source:'Common Ground account creation',originalArtifactRoot:path.relative(ROOT,positiveRoot).replaceAll('\\','/')},
  patch:await fs.readFile(path.join(positiveRoot,'diff-1.patch'),'utf8'),gate:run.verification});
const negative=measured.negative.rows.find(r=>r.type==='functional-regression'&&r.runId);
if(!negative)throw new Error('No executed functional-regression evidence available');
const negativeRoot=path.join(benchmarkRoot,negative.runId),bad=await readJson(path.join(negativeRoot,'run.json'));
await add({id:'wrong-fix',title:'A reachable button. A broken result.',kicker:'02 / REJECT THE CONVINCING WRONG FIX',
  impact:'The replacement button can now be activated with the keyboard. But its confirmation changes to “Wrong account”. Calling that a successful repair would hide a functional regression.',
  explanation:'The repair gate rejects the candidate because the original functional contract fails. Better keyboard behavior alone cannot authorize a broken application.',
  before:bad.before,after:bad.after,beforeRoot:path.join(negativeRoot,'before'),afterRoot:path.join(negativeRoot,bad.afterDir),
  provenance:{kind:'Synthetic application · deliberately wrong candidate',isAI:false,recorded:true,runId:bad.id,recordedAt:bad.completedAt,source:'Account creation negative control',originalArtifactRoot:path.relative(ROOT,negativeRoot).replaceAll('\\','/')},
  patch:await fs.readFile(path.join(negativeRoot,'diff-1.patch'),'utf8'),gate:bad.verification});
const historical=await readJson(path.join(ROOT,'benchmarks','historical-results.json'));
const historicalRoot=path.join(ROOT,'benchmarks','historical','a11y-dialog-restore');
const context=async phase=>{const text=await fs.readFile(path.join(historicalRoot,phase,'src','a11y-dialog.ts'),'utf8');const lines=text.split('\n');const index=lines.findIndex(l=>l.includes('this.previouslyFocused?.focus?.()'));return lines.slice(Math.max(0,index-9),index+10).join('\n');};
await add({id:'real-focus-loss',title:'The dialog closes. Focus is left behind.',kicker:'03 / A REAL OPEN-SOURCE DEFECT',
  impact:'After Escape hides an opacity-based dialog, focus is pulled back into invisible content. The page looks ready; the keyboard user has lost their place.',
  explanation:'This historical a11y-dialog change removes the focus listeners before restoring the opener. We reproduced the original failure and replayed the published human fix on the same task.',
  before:await readJson(path.join(ROOT,'artifacts','historical','before','result.json')),after:await readJson(path.join(ROOT,'artifacts','historical','after','result.json')),
  beforeRoot:path.join(ROOT,'artifacts','historical','before'),afterRoot:path.join(ROOT,'artifacts','historical','after'),
  provenance:{kind:'Historical defect · published human repair',isAI:false,recorded:true,source:'KittyGiraudel/a11y-dialog',url:historical.provenance.fix,revisions:historical.provenance.revisions,license:'MIT; source excerpts retain upstream attribution',sourceHashes:historical.provenance.sourceHashes},
  patch:'BEFORE\n'+await context('before')+'\n\nAFTER\n'+await context('after'),
  gate:{verdict:historical.before==='VERIFIED_FAIL'&&historical.after==='VERIFIED_PASS'?'VERIFIED_PASS':'INCONCLUSIVE',scope:'Historical failure and human-fix task replay only. No autonomous repair or full regression claim.'}});
} else {
  // Source artifacts for the earlier recordings live on the machine that measured them; keep their published entries unchanged.
  const previous=await readJson(path.join(out,'data.json'));cases.push(...previous.cases.filter(c=>c.id!=='live-repair'));
}
await json(path.join(out,'data.json'),{version:1,generatedAt:new Date().toISOString(),measuredAt:measured.at,recorded:true,liveInference:cases.some(c=>c.provenance.isAI),cases});
console.log(`Published ${cases.length} actual recorded case studies into the local workbench. No inference or new test suite.`);
