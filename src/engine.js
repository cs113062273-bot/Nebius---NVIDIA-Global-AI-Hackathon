import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Journey, digest, transition } from './schema.js';
import { json, hashTree, readJson } from './files.js';
import { getFixture, fixturePath, journeyFor, ROOT } from './catalog.js';
import { fixtureServer } from './static.js';
import { launchBrowser, executeJourney } from './runner.js';
import { localize, applyReference, applyPlan, buildStatic } from './repair.js';
import { verifyRepair } from './verifier.js';
import { createProof } from './proof.js';
import { NebiusClient } from './nebius.js';
import { compareInitialScreenshots } from './visual.js';

export const repairEvidence=(journey,before,latest)=>({title:journey.title,goal:journey.goal,environment:{timezone:before.environment?.timezoneId||'UTC',locale:before.environment?.locale||'en-US'},failure:latest?.failure || before.failure,observed:latest?.observed || before.checkpoints.at(-1)?.state,functional:journey.functional,requirements:journey.steps.map(s=>({action:s.action,assertions:s.assertions}))});
export async function runRepair({fixture='checkout',mode='reference',artifactRoot=path.join(ROOT,'artifacts','runs'),id=randomUUID(),onUpdate=()=>{},planProvider,journey:customJourney,functionalJourney:customFunctional,sourceRoot,referenceRoot,sourceMetadata,maxAttempts=2,freshInference=false,guards:customGuards=[]}={}) {
  const fixtureInfo=sourceRoot?{kind:'custom'}:getFixture(fixture);if(!['reference','nebius','provided','recorded'].includes(mode))throw new Error('Unsupported repair provider');
  if(sourceRoot&&mode==='recorded')throw new Error('Recorded model patches are tied to their original source snapshots');
  if(sourceRoot&&(!customJourney||!customFunctional||mode==='reference'&&!referenceRoot))throw new Error('A project requires frozen keyboard and functional journeys, plus edited source for patch verification');
  if(!/^[a-z0-9-]{1,80}$/.test(id))throw new Error('Invalid run ID');
  await fs.mkdir(artifactRoot,{recursive:true});
  const dir=path.join(artifactRoot,id);await fs.mkdir(dir,{recursive:false});
  const journey=Journey.parse(customJourney || journeyFor(fixture));
  const functionalJourney=Journey.parse(customFunctional||journeyFor(fixture,'pointer'));
  // Regression guards already pass on the original and must still pass after every candidate.
  if(customGuards.length>6)throw new Error('At most six regression guards');const guards=customGuards.map(g=>Journey.parse(g));
  const run={id,fixture,mode,source:sourceMetadata||null,state:'CREATED',events:[{state:'CREATED',at:new Date().toISOString()}],journeyHash:digest(journey),functionalJourneyHash:digest(functionalJourney),journey,functionalJourney,...(guards.length?{guards,guardsHash:digest(guards)}:{}),attempts:[],verification:null,startedAt:new Date().toISOString()};
  const started=performance.now();let browser,server,stageStarted=started;run.stageTimings=[];
  const persist=async()=>{await json(path.join(dir,'run.json'),run);onUpdate(run);};
  const move=async(state,detail)=>{const now=performance.now();run.stageTimings.push({stage:run.state,elapsedMs:Math.round(now-stageStarted)});stageStarted=now;transition(run,state,detail);await persist();};
  await fs.mkdir(artifactRoot,{recursive:true});
  await json(path.join(dir,'journey.json'),journey);await json(path.join(dir,'functional-journey.json'),functionalJourney);
  try {
    await move('PREPARING',sourceRoot?'Clean browser contexts; user-selected static source snapshot':fixtureInfo.kind==='historical'?'Clean browser contexts; pinned open-source snapshot and reconstructed journey':'Clean browser contexts; allowlisted synthetic application');
    const original=sourceRoot||fixturePath(fixture);run.sourceHashes=await hashTree(original);
    browser=await launchBrowser();server=await fixtureServer(original);
    await move('BASELINE_RUNNING','Reproduce task and independent pointer functional baseline');
    const before=await executeJourney({browser,origin:server.origin,journey,dir:path.join(dir,'before')});run.before=before;
    const functionalBefore=await executeJourney({browser,origin:server.origin,journey:functionalJourney,dir:path.join(dir,'functional-before')});run.functionalBefore=functionalBefore;
    const guardsBefore=[];for(const [i,guard]of guards.entries())guardsBefore.push(await executeJourney({browser,origin:server.origin,journey:guard,dir:path.join(dir,`guard-before-${i}`)}));if(guards.length)run.guardsBefore=guardsBefore;
    await server.close();server=null;
    if(before.verdict!=='VERIFIED_FAIL' || functionalBefore.verdict!=='VERIFIED_PASS' || guardsBefore.some(r=>r.verdict!=='VERIFIED_PASS')) {
      run.verification={verdict:before.verdict==='VERIFIED_PASS'?'NOT_TESTED':'INCONCLUSIVE',reasons:[guardsBefore.some(r=>r.verdict!=='VERIFIED_PASS')?'A regression guard does not pass on the original source':'No reproducible keyboard failure with a passing functional baseline']};
      await move(before.verdict==='VERIFIED_PASS'?'FAILED':'INCONCLUSIVE','Baseline did not qualify for repair');
    } else {
      await move('FAILURE_CONFIRMED',before.failure?.message||'Postcondition failure');
      await move('LOCALIZING','Rank source candidates from selector/name evidence');
      // Historical snapshots ship type-stripped browser ESM alongside verbatim TS.
      // Give the model the runtime files only; do not imply that editing TS rebuilt JS.
      const candidates=(await localize(original,before)).filter(c=>fixtureInfo.kind!=='historical'||c.path==='src/a11y-dialog.js');run.candidates=candidates.map(({source,...c})=>c);await json(path.join(dir,'localization.json'),run.candidates);
      const client=new NebiusClient({dir:path.join(artifactRoot,'..','inference')});
      const history=[];
      const cap=mode==='reference'||mode==='recorded'?1:Math.min(3,Math.max(1,maxAttempts));
      for(let attempt=1;attempt<=cap;attempt++) {
        const attemptStarted=performance.now(),record={attempt,startedAt:new Date().toISOString(),verified:false,category:null};run.attempts.push(record);
        // Every proposal targets the same immutable original, never a partly applied failed patch.
        try {
        await move('PLANNING_REPAIR',mode==='reference'?'Human-supplied patch; no inference':mode==='recorded'?'Replay an archived model-authored plan; no new inference':'NVIDIA Nemotron proposes bounded edits via Nebius');
        let plan,provenance;
        if(mode==='reference'){plan={root_cause:'Human-supplied edited files; no model diagnosis.',repair_strategy:'Verify added, removed and modified static files in isolation.'};provenance={provider:sourceRoot?'user-supplied-edited-source':fixtureInfo.kind==='historical'?'published-human-fix':'fixture-author',status:'REFERENCE_NOT_AI',calls:0};}
        else if(mode==='recorded'){
          const recorded=await readJson(path.join(ROOT,'public','recordings',fixture,'data.json'));
          if(recorded.id!==fixture||recorded.verification?.verdict!=='VERIFIED_PASS'||recorded.model?.cacheHit!==false)throw new Error('No verified recorded model patch for this source');
          plan=recorded.plan;provenance={...recorded.model,provider:'recorded-Nebius-model-plan',status:'RECORDED_PLAN_REPLAY',originalRequestId:recorded.model.requestId,cacheHit:true,recorded:true,originalLatencyMs:recorded.model.latencyMs,latencyMs:0,originalUsage:recorded.model.usage,usage:null,calls:0,attemptedCompletions:0};
        }
        else if(mode==='provided' && planProvider) {plan=await planProvider({candidates,before,history});provenance={provider:'injected-test-plan',status:'TEST_ONLY',calls:0};}
        else {
          const latest=history.at(-1);
          ({plan,provenance}=await client.propose({candidates,evidence:{...repairEvidence(journey,before,latest),observed:latest?.observed||{state:before.checkpoints.at(-1)?.state,successChecks:before.checks,functionalChecks:before.functional,failedSteps:before.steps.filter(s=>s.result!=='VERIFIED_PASS')},functional: {keyboard:journey.functional,independent:functionalJourney.functional,...(guards.length?{regression_guards:guards.map(g=>({title:g.title,profile:g.profile,actions:g.steps.map(s=>s.action),must_hold:g.functional}))}:{})}},history,fresh:freshInference}));
        }
        run.model=provenance;Object.assign(record,{plan,provenance});await json(path.join(dir,`plan-${attempt}.json`),plan);await persist();
        const candidate=path.join(dir,`candidate-${attempt}`);await fs.cp(original,candidate,{recursive:true,errorOnExist:true,force:false});
        await move('PATCHING','Validate allowlist, hashes, unique preimages and change bounds in isolated copy');
        const patch=mode==='reference'?await applyReference(candidate,referenceRoot||fixturePath(fixture,'reference'),{staticProject:!!sourceRoot,runtimeOnly:fixtureInfo.kind==='historical'}):await applyPlan(candidate,plan,candidates.map(c=>c.path));
        record.patchValidation=patch.patchValidation;record.changes=patch.changes;record.diff=`diff-${attempt}.patch`;
        await fs.writeFile(path.join(dir,`diff-${attempt}.patch`),patch.patch);
        await move('BUILDING','Validate static JavaScript syntax and HTML structure');
        const build=await buildStatic(candidate);await json(path.join(dir,`build-${attempt}.json`),build);
        if(!build.pass){const error=new Error('Candidate build failed: '+JSON.stringify(build.checks.filter(c=>!c.pass)));error.category='BUILD';throw error;}
        await move('REPLAYING','Same frozen journey, fresh browser context');
        server=await fixtureServer(candidate);
        const after=await executeJourney({browser,origin:server.origin,journey,dir:path.join(dir,`after-${attempt}`)});run.after=after;run.afterDir=`after-${attempt}`;
        const functionalAfter=await executeJourney({browser,origin:server.origin,journey:functionalJourney,dir:path.join(dir,`functional-after-${attempt}`)});run.functionalAfter=functionalAfter;
        const guardsAfter=[];for(const [i,guard]of guards.entries())guardsAfter.push(await executeJourney({browser,origin:server.origin,journey:guard,dir:path.join(dir,`guard-after-${attempt}-${i}`)}));
        await server.close();server=null;
        await move('VERIFYING','Deterministic task + functional + oracle + regression gate');
        const visual=await compareInitialScreenshots(path.join(dir,'before','initial.png'),path.join(dir,`after-${attempt}`,'initial.png'));await json(path.join(dir,`visual-${attempt}.json`),visual);run.visual=visual;
        run.verification=verifyRepair({before,after,functionalBefore,functionalAfter,patchChanged:patch.changed>0,build,visual,oracleHash:run.journeyHash,guards,guardsBefore,guardsAfter});
        Object.assign(record,{verified:run.verification.verdict==='VERIFIED_PASS',category:run.verification.reasons.length?'VERIFICATION':null,verification:run.verification,afterDir:run.afterDir,after,functionalAfter,...(guards.length?{guardsAfter}:{}),elapsedMs:Math.round(performance.now()-attemptStarted)});
        const failedAssertions=[...after.steps.flatMap(s=>s.assertions),...after.checks,...after.functional,...functionalAfter.checks,...functionalAfter.functional,...guardsAfter.flatMap(r=>[...r.checks,...r.functional])].filter(a=>!a.pass);
        history.push({attempt,previous_plan:plan,failure:{category:'VERIFICATION',message:[...run.verification.reasons,...run.verification.uncertain].join('; '),stepFailure:after.failure},observed:{focus:after.checkpoints.at(-1)?.state.focus,failedAssertions,pointerFailure:functionalAfter.failure,...(guards.length?{guardFailures:guardsAfter.map((r,i)=>r.verdict==='VERIFIED_PASS'?null:{guard:guards[i].title,failure:r.failure,consoleErrors:r.consoleErrors.slice(0,3)}).filter(Boolean)}:{})},instruction:'Return a corrected full proposal against ORIGINAL hashes. Preserve both frozen tasks and their exact outcomes.'});
        if(record.verified){await move('VERIFIED','Verified only for the tested journey and conditions');break;}
        if(attempt===cap){await move(run.verification.verdict==='INCONCLUSIVE'?'INCONCLUSIVE':'FAILED','Repair attempt limit reached');break;}
        }catch(error){
          if(server){await server.close();server=null;}
          const category=error.category||(run.state==='PLANNING_REPAIR'?(error.provenance?.finishReason==='length'?'TRUNCATED':'PROPOSAL'):run.state==='PATCHING'?'APPLICATION':'INFRA');
          if(error.provenance){run.model=error.provenance;record.provenance=error.provenance;}
          const message=error.name==='ZodError'?'Invalid proposal schema: '+error.issues.map(i=>i.path.join('.')+': '+i.message).join('; ').slice(0,1200):error.message.slice(0,1500);
          Object.assign(record,{category,failure:message,elapsedMs:Math.round(performance.now()-attemptStarted)});
          history.push({attempt,previous_plan:record.plan,failure:{category,message},instruction:category==='TRUNCATED'?'Output was discarded; return concise minimal edits and diagnosis within the same output budget.':'Fix the reported error. Return a complete replacement proposal targeting the immutable original allowlist and hashes.'});
          // Retry only actual proposal/application/build failures. Never retry uncertain transport or exhausted budgets.
          const recoverable=['TRUNCATED','APPLICATION','BUILD'].includes(category)||category==='PROPOSAL'&&(error.name==='ZodError'||error.name==='SyntaxError'||/JSON|Model returned|Incomplete or unsupported model/.test(message));
          if(attempt===cap||!recoverable){const rejected=['APPLICATION','BUILD'].includes(category);run.verification={verdict:rejected?'VERIFIED_FAIL':'INCONCLUSIVE',reasons:[category+': '+message]};await move(rejected?'FAILED':'INCONCLUSIVE','Stopped: '+category);break;}
        }finally{record.elapsedMs=Math.round(performance.now()-attemptStarted);if(record.provenance?.responseFile){const raw=path.join(artifactRoot,'..','inference',record.provenance.responseFile);await fs.copyFile(raw,path.join(dir,`model-response-${attempt}.json`));}if(record.provenance?.requestFile)await fs.copyFile(path.join(artifactRoot,'..','inference',record.provenance.requestFile),path.join(dir,`model-request-${attempt}.json`));await persist();}
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
