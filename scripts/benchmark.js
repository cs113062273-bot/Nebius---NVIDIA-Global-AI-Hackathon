import path from 'node:path';
import fs from 'node:fs/promises';
import { ROOT,fixtures,fixturePath } from '../src/catalog.js';
import { runRepair } from '../src/engine.js';
import { referencePlan } from '../src/repair.js';
import { verifyRepair } from '../src/verifier.js';
import { digest } from '../src/schema.js';
import { json } from '../src/files.js';
import { historicalBenchmark } from './historical.js';
import { focusedBenchmark } from './focused-benchmark.js';

const root=path.join(ROOT,'artifacts','benchmark',new Date().toISOString().replaceAll(':','-'));
const runs=[];const reference=[];
for(const fixture of fixtures.filter(f=>f.kind!=='historical')){const run=await runRepair({fixture:fixture.id,artifactRoot:root,mode:'reference'});runs.push(run);reference.push({fixture:fixture.id,runId:run.id,before:run.before?.verdict,after:run.after?.verdict,verdict:run.verification?.verdict,elapsedMs:run.elapsedMs,category:run.before?.failure?.category});console.log(fixture.id,run.verification?.verdict,run.elapsedMs+'ms');}
const sourceNegatives=[];
for(const type of ['cosmetic-only','functional-regression']){
  const run=await runRepair({fixture:'account',artifactRoot:root,mode:'provided',maxAttempts:1,planProvider:async({candidates})=>{
    if(type==='cosmetic-only'){const c=candidates.find(c=>c.path==='index.html');return{root_cause:'Negative control',repair_strategy:'Cosmetic change only',edits:[{path:c.path,sha256:c.sha256,before:'<h1>Create an account</h1>',after:'<h1>Create your account</h1>'}],expected_accessibility_effect:'None',functional_risks:[],verification_requirements:['Original oracle']};}
    const plan=await referencePlan(fixturePath('account'),fixturePath('account','reference'));const source=await fs.readFile(path.join(fixturePath('account'),'app.js'),'utf8');plan.edits.push({path:'app.js',sha256:digest(source),before:'Account created · judge@example.com',after:'Wrong account'});return plan;
  }});sourceNegatives.push({type,runId:run.id,verdict:run.verification?.verdict,rejected:run.verification?.verdict!=='VERIFIED_PASS'});console.log(type,run.verification?.verdict);
}
const good=runs.find(r=>r.verification?.verdict==='VERIFIED_PASS');if(!good)throw new Error('No positive control; cannot evaluate verifier mutations');
const base={before:good.before,after:good.after,functionalBefore:good.functionalBefore,functionalAfter:good.functionalAfter,patchChanged:true,build:{pass:true},visual:{pass:true},oracleHash:good.journeyHash};
const mutations={
  'oracle-drift':s=>s.after.journeyHash='different', 'environment-drift':s=>s.after.environment.viewport.width=321,
  'browser-drift':s=>s.after.browser='other', 'missing-build':s=>s.build=null,
  'missing-visual-check':s=>s.visual=null,
  'no-op':s=>s.patchChanged=false,'baseline-not-reproduced':s=>s.before.verdict='VERIFIED_PASS',
  'missing-functional-baseline':s=>s.functionalBefore=null,'functional-output-drift':s=>s.functionalAfter.functional[0].observed='Wrong item',
  'missing-task-evidence':s=>s.after.checks=[],'incomplete-replay':s=>s.after.verdict='INCONCLUSIVE',
  'runtime-error':s=>s.after.consoleErrors.push('crashed'),'network-failure':s=>s.after.networkFailures.push({reason:'timeout'}),
  'new-axe-finding':s=>s.after.checkpoints.push({axe:{violations:[{id:'button-name',nodes:[{target:['#new']}]}]}})
};
const gateNegatives=Object.entries(mutations).map(([type,mutate])=>{const sample=structuredClone(base);mutate(sample);const verification=verifyRepair(sample);return{type,verdict:verification.verdict,rejected:verification.verdict!=='VERIFIED_PASS'};});
const focused=await focusedBenchmark();console.log('Focused browser pairs:',focused.passed+'/'+focused.pairs);
const historical=await historicalBenchmark();console.log('Historical reproduction:',historical.before,'->',historical.after);
const latencies=reference.map(r=>r.elapsedMs).sort((a,b)=>a-b),quantile=q=>latencies[Math.ceil(q*latencies.length)-1];
const negatives=[...sourceNegatives,...gateNegatives];
const result={at:new Date().toISOString(),environment:{platform:process.platform,node:process.version,browser:good.before.browser},reference:{cases:reference.length,reproduced:reference.filter(r=>r.before==='VERIFIED_FAIL').length,verified:reference.filter(r=>r.verdict==='VERIFIED_PASS').length,rows:reference,p50Ms:quantile(.5),p95Ms:quantile(.95),bugFamilies:2},negative:{cases:negatives.length,rejected:negatives.filter(n=>n.rejected).length,falseVerified:negatives.filter(n=>!n.rejected).length,sourcePatchCases:sourceNegatives.length,verifierMutations:gateNegatives.length,rows:negatives},focused:{pairs:focused.pairs,families:focused.families,passed:focused.passed,failed:focused.failed},historical,live:{cases:0,calls:0,tokens:0,status:'NOT_TESTED'},holdout:{cases:0,status:'NOT_TESTED'},artifactRoot:path.relative(ROOT,root),notes:['All repairs are author reference patches or injected negative controls. No AI repair rate was measured.','Seven apps share two seeded bug families. No statistical generalization or independent holdout is claimed.','p50/p95 describe the seven local reference-replay runs, not inference latency.']};
await json(path.join(ROOT,'benchmarks','results.json'),result);
console.log(JSON.stringify({reference:result.reference.verified+'/'+result.reference.cases,negative:result.negative.rejected+'/'+result.negative.cases,falseVerified:result.negative.falseVerified,focused:result.focused.passed+'/'+result.focused.pairs,historical:historical.before+' -> '+historical.after,p50Ms:result.reference.p50Ms,p95Ms:result.reference.p95Ms},null,2));
if(result.reference.verified!==result.reference.cases || result.negative.falseVerified || focused.failed.length || historical.reproduced!==1 || historical.humanFixReplayed!==1)process.exitCode=1;
