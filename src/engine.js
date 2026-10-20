import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Journey, digest, transition } from './schema.js';
import { json, hashTree } from './files.js';
import { getFixture, fixturePath, journeyFor, ROOT } from './catalog.js';
import { fixtureServer } from './static.js';
import { launchBrowser, executeJourney } from './runner.js';
import { localize, referencePlan, applyPlan, buildStatic } from './repair.js';
import { verifyRepair } from './verifier.js';
import { createProof } from './proof.js';
import { NebiusClient } from './nebius.js';
import { compareInitialScreenshots } from './visual.js';

export async function runRepair({fixture='checkout',mode='reference',artifactRoot=path.join(ROOT,'artifacts','runs'),id=randomUUID(),onUpdate=()=>{},planProvider,journey:customJourney,maxAttempts=2}={}) {
  getFixture(fixture);if(!['reference','nebius','provided'].includes(mode))throw new Error('Unsupported repair provider');
  if(!/^[a-z0-9-]{1,80}$/.test(id))throw new Error('Invalid run ID');
  await fs.mkdir(artifactRoot,{recursive:true});
  const dir=path.join(artifactRoot,id);await fs.mkdir(dir,{recursive:false});
  const journey=Journey.parse(customJourney || journeyFor(fixture));
  const functionalJourney=Journey.parse(journeyFor(fixture,'pointer'));
  const run={id,fixture,mode,state:'CREATED',events:[{state:'CREATED',at:new Date().toISOString()}],journeyHash:digest(journey),journey,functionalJourney,attempts:[],verification:null,startedAt:new Date().toISOString()};
  const started=performance.now();let browser,server,stageStarted=started;run.stageTimings=[];
  const persist=async()=>{await json(path.join(dir,'run.json'),run);onUpdate(run);};
  const move=async(state,detail)=>{const now=performance.now();run.stageTimings.push({stage:run.state,elapsedMs:Math.round(now-stageStarted)});stageStarted=now;transition(run,state,detail);await persist();};
  await fs.mkdir(artifactRoot,{recursive:true});
  await json(path.join(dir,'journey.json'),journey);await json(path.join(dir,'functional-journey.json'),functionalJourney);
  try {
    await move('PREPARING','Clean browser contexts; allowlisted synthetic application');
    const original=fixturePath(fixture);run.sourceHashes=await hashTree(original);
    browser=await launchBrowser();server=await fixtureServer(original);
    await move('BASELINE_RUNNING','Reproduce task and independent pointer functional baseline');
    const before=await executeJourney({browser,origin:server.origin,journey,dir:path.join(dir,'before')});run.before=before;
    const functionalBefore=await executeJourney({browser,origin:server.origin,journey:functionalJourney,dir:path.join(dir,'functional-before')});run.functionalBefore=functionalBefore;
    await server.close();server=null;
    if(before.verdict!=='VERIFIED_FAIL' || functionalBefore.verdict!=='VERIFIED_PASS') {
      run.verification={verdict:before.verdict==='VERIFIED_PASS'?'NOT_TESTED':'INCONCLUSIVE',reasons:['No reproducible keyboard failure with a passing functional baseline']};
      await move(before.verdict==='VERIFIED_PASS'?'FAILED':'INCONCLUSIVE','Baseline did not qualify for repair');
    } else {
      await move('FAILURE_CONFIRMED',before.failure?.message||'Postcondition failure');
      await move('LOCALIZING','Rank source candidates from selector/name evidence');
      const candidates=await localize(original,before);run.candidates=candidates.map(({source,...c})=>c);await json(path.join(dir,'localization.json'),run.candidates);
      const client=new NebiusClient({dir:path.join(artifactRoot,'..','inference')});
      const history=[];
      const cap=mode==='reference'?1:Math.min(3,Math.max(1,maxAttempts));
      for(let attempt=1;attempt<=cap;attempt++) {
        await move('PLANNING_REPAIR',mode==='reference'?'Author-provided reference patch; no inference':'NVIDIA Nemotron proposes bounded edits via Nebius');
        let plan,provenance;
        if(mode==='reference'){plan=await referencePlan(original,fixturePath(fixture,'reference'));provenance={provider:'fixture-author',status:'REFERENCE_NOT_AI',calls:0};}
        else if(mode==='provided' && planProvider) {plan=await planProvider({candidates,before,history});provenance={provider:'injected-test-plan',status:'TEST_ONLY',calls:0};}
        else {
          const latest=history.at(-1);
          ({plan,provenance}=await client.propose({candidates,evidence:{title:journey.title,goal:journey.goal,failure:latest?.failure || before.failure,observed:latest?.observed || before.checkpoints.at(-1)?.state,functional:journey.functional,requirements:journey.steps.map(s=>({action:s.action,assertions:s.assertions}))},history}));
        }
        run.model=provenance;await json(path.join(dir,`plan-${attempt}.json`),plan);
        const candidate=path.join(dir,`candidate-${attempt}`);await fs.cp(original,candidate,{recursive:true,errorOnExist:true,force:false});
        await move('PATCHING','Validate allowlist, hashes, unique preimages and change bounds in isolated copy');
        const patch=await applyPlan(candidate,plan,candidates.map(c=>c.path));
        await fs.writeFile(path.join(dir,`diff-${attempt}.patch`),patch.patch);
        await move('BUILDING','Validate static JavaScript syntax and HTML structure');
        const build=await buildStatic(candidate);await json(path.join(dir,`build-${attempt}.json`),build);
        if(!build.pass){run.attempts.push({attempt,category:'BUILD',verified:false});history.push({failure:'Build failed',observed:build});if(attempt<cap)continue;await move('FAILED','Build check failed');break;}
        await move('REPLAYING','Same frozen journey, fresh browser context');
        server=await fixtureServer(candidate);
        const after=await executeJourney({browser,origin:server.origin,journey,dir:path.join(dir,`after-${attempt}`)});run.after=after;run.afterDir=`after-${attempt}`;
        const functionalAfter=await executeJourney({browser,origin:server.origin,journey:functionalJourney,dir:path.join(dir,`functional-after-${attempt}`)});run.functionalAfter=functionalAfter;
        await server.close();server=null;
        await move('VERIFYING','Deterministic task + functional + oracle + regression gate');
        const visual=await compareInitialScreenshots(path.join(dir,'before','initial.png'),path.join(dir,`after-${attempt}`,'initial.png'));await json(path.join(dir,`visual-${attempt}.json`),visual);run.visual=visual;
        run.verification=verifyRepair({before,after,functionalBefore,functionalAfter,patchChanged:patch.changed>0,build,visual,oracleHash:run.journeyHash});
        const record={attempt,verified:run.verification.verdict==='VERIFIED_PASS',category:run.verification.reasons.length?'VERIFICATION':null,verification:run.verification,provenance};run.attempts.push(record);
        history.push({failure:run.verification.reasons.join('; ') || after.failure,observed:{focus:after.checkpoints.at(-1)?.state.focus,checks:after.checks,functional:after.functional}});
        if(record.verified){await move('VERIFIED','Verified only for the tested journey and conditions');break;}
        if(attempt===cap){await move(run.verification.verdict==='INCONCLUSIVE'?'INCONCLUSIVE':'FAILED','Repair attempt limit reached');break;}
      }
    }
  } catch(error) {
    if(error.provenance)run.model=error.provenance;
    run.error=error.message.slice(0,1000);run.verification={verdict:'INCONCLUSIVE',reasons:[run.error]};
    if(!['VERIFIED','FAILED','INCONCLUSIVE'].includes(run.state)) {
      // Unexpected infrastructure errors are terminal and never imply a repair verdict.
      run.state='INCONCLUSIVE';run.events.push({state:'INCONCLUSIVE',detail:run.error,at:new Date().toISOString()});
    }
  } finally {
    if(server)await server.close();if(browser)await browser.close();
    run.elapsedMs=Math.round(performance.now()-started);run.completedAt=new Date().toISOString();
    await persist();run.manifest=await createProof(dir,run);await persist();
  }
  return run;
}
