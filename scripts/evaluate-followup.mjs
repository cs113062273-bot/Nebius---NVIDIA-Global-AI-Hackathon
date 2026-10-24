import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseEnv} from 'node:util';
import {runRepair} from '../src/engine.js';
import {fixtureServer} from '../src/static.js';
import {launchBrowser,executeJourney} from '../src/runner.js';
import {hashTree,readJson} from '../src/files.js';
import {Journey,digest} from '../src/schema.js';
import {verifyProof} from '../src/proof.js';
import {extractJson,normalizeAdvisory} from '../src/nebius.js';

// Follow-ups to the 2026-10-24 independent review. Each case freezes source, task and
// withheld regression checks before any inference; rechecks reuse the model candidate.
const [mode,name]=process.argv.slice(2),root=path.resolve('benchmarks',name||''),original=path.join(root,'original');
const implementationFiles=['src/engine.js','src/nebius.js','src/repair.js','src/runner.js','src/schema.js','src/verifier.js'];
const write=async(file,value)=>fs.writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const form=(selector,values)=>Object.entries(values).map(([field,value])=>({kind:'form-data',selector,name:field,value:[value]}));
const journey=(id,title,goal,profile,steps,checks,timezone)=>Journey.parse({version:1,id,title,goal,source:'authored',profile,path:'/',...(timezone?{timezone}:{}),steps,success:checks,functional:checks,forbidden:[]});
const seek=(selector,title)=>({title,action:{kind:'seek',selector,maxTabs:24}}),press=(key,title)=>({title,action:{kind:'press',key}}),type=(text,title)=>({title,action:{kind:'type',text,replace:true}}),click=(selector,title)=>({title,action:{kind:'click',selector}});

const nativeGoal='Saving must submit exactly what each country field shows. A listed country submits its code. An empty, blank or unrecognized entry submits no saved country (an empty value). Keyboard and pointer selection of listed countries must keep working.';
const nativePointer=journey('native-visible-pointer','Pointer selection of a listed country is preserved',nativeGoal,'pointer',[click('#shipping-country','Edit shipping country'),type('France','Choose France'),click('#shipping-country__option--0','Confirm the suggested country'),click('#save','Save preferences')],form('#preferences',{shipping_country:'fr',billing_country:'de'}));
const bookingGoal='Weekends are closed. Arrow keys move by calendar days (ArrowLeft/Right one day, ArrowUp/Down one week) in the user time zone, including across daylight-saving changes, then skip closed days in the same direction. Preserve pointer selection and the other field.';
const bookingPointer=timezone=>journey('pikaday-dst-pointer','Available weekday selection preserves actual booking dates',bookingGoal,'pointer',[click('#pickup','Open pickup calendar'),click('.pika-single:not(.is-hidden) button[data-pika-year="2026"][data-pika-month="9"][data-pika-day="22"]','Select an available weekday'),click('#save','Save booking dates')],form('#booking',{pickup_date:'2026-10-22',return_date:'2026-10-26'}),timezone);
const bookingKeys=(id,field,key,expected,timezone,title)=>journey(id,title,bookingGoal,'keyboard',[seek('#'+field,`Reach ${field} date`),press(key,`Press ${key}`),seek('#save','Reach Save'),press('Enter','Save booking dates')],form('#booking',expected),timezone);
const upstream='benchmarks/pikaday-booking/original';
const cases={
 'native-form-visible':{
  source:'benchmarks/native-form/original',issue:'https://github.com/alphagov/accessible-autocomplete/issues/777',
  provenance:'Post-hoc task added after an independent review (2026-10-24) showed that model run d2eb947c attempt 1 cleared only an exactly empty input: an unrecognized entry ("Atlantis") or a blank entry still submitted the previous code. Same pinned GOV.UK component and author-created consumer as the original case. Fresh model run against the ORIGINAL source, not the earlier patch. The empty-value rule for unrecognized text is an authored acceptance condition. Withheld checks were frozen before inference and omitted from the model request; billing markup is visible. Not blind or production-customer evidence.',
  tasks:{journey:journey('native-visible-keyboard','Unrecognized or blank countries must not save an old code',nativeGoal,'keyboard',[seek('#shipping-country','Reach shipping country'),type('Atlantis','Enter a country that is not listed'),seek('#billing-country','Reach billing country'),type('   ','Replace billing with blank spaces'),seek('#save','Reach Save'),press('Enter','Save preferences')],form('#preferences',{shipping_country:'',billing_country:''})),functionalJourney:nativePointer},
  withheld:async()=>{const t=await readJson('benchmarks/native-form/tasks.json');return {
   'clear-shipping':[t.journey,t.functionalJourney],'clear-billing':[t.withheldJourney,t.withheldFunctionalJourney],
   'partial-match-confirms':[journey('native-partial-keyboard','A partial match confirmed on blur still saves the listed country',nativeGoal,'keyboard',[seek('#shipping-country','Reach shipping country'),type('Fra','Type the start of France'),seek('#save','Leave the field and reach Save'),press('Enter','Save preferences')],form('#preferences',{shipping_country:'fr',billing_country:'de'})),nativePointer]};}
 },
 'native-form-guarded':{
  source:'benchmarks/native-form/original',issue:'https://github.com/alphagov/accessible-autocomplete/issues/777',
  provenance:'Second post-hoc strengthening. Model run 2b863464 attempt 2 passed the native-form-visible task by editing the component blur handler, but a withheld check frozen before that inference showed typing "Fra" and leaving the field no longer saved France, and a reviewer probe showed the same patch throws on blur in the library standard (non-select) usage. The author added a plain pickup-city autocomplete to the consumer page and made both behaviours regression guards that must pass before and after every candidate. Guards are part of the gate and the model request; clear-shipping and clear-billing remain withheld. Pinned GOV.UK component unchanged. Not blind or production-customer evidence.',
  customize:async dir=>{
   const html=await fs.readFile(path.join(dir,'index.html'),'utf8'),marker='</form></main>';assert.ok(html.includes(marker));
   await fs.writeFile(path.join(dir,'index.html'),html.replace(marker,'</form><form id="search" role="search"><label for="destination">Find a pickup city (optional)</label><div id="destination-field"></div></form></main>'));
   await fs.appendFile(path.join(dir,'app.js'),"accessibleAutocomplete({element:document.getElementById('destination-field'),id:'destination',name:'destination',source:['Paris','Lyon','Berlin','Rome']});\ndocument.getElementById('search').addEventListener('submit',event=>event.preventDefault());\n");
  },
  tasks:{journey:journey('native-visible-keyboard','Unrecognized or blank countries must not save an old code',nativeGoal,'keyboard',[seek('#shipping-country','Reach shipping country'),type('Atlantis','Enter a country that is not listed'),seek('#billing-country','Reach billing country'),type('   ','Replace billing with blank spaces'),seek('#save','Reach Save'),press('Enter','Save preferences')],form('#preferences',{shipping_country:'',billing_country:''})),functionalJourney:nativePointer,
   guards:[journey('native-guard-partial','Guard · a partial match confirmed on blur still saves France',nativeGoal,'keyboard',[seek('#shipping-country','Reach shipping country'),type('Fra','Type the start of France'),seek('#save','Leave the field and reach Save'),press('Enter','Save preferences')],form('#preferences',{shipping_country:'fr',billing_country:'de'})),
    journey('native-guard-plain','Guard · the plain pickup-city autocomplete keeps working',nativeGoal,'keyboard',[seek('#destination','Reach pickup city'),type('zzz','Type a city that is not listed'),seek('#save','Leave the field and reach Save'),press('Enter','Save preferences')],[...form('#preferences',{shipping_country:'gb',billing_country:'de'}),...form('#search',{destination:'zzz'})])]},
  withheld:async()=>{const t=await readJson('benchmarks/native-form/tasks.json');return {'clear-shipping':[t.journey,t.functionalJourney],'clear-billing':[t.withheldJourney,t.withheldFunctionalJourney]};}
 },
 'native-form-submit':{
  source:'benchmarks/native-form-guarded/original',issue:'https://github.com/alphagov/accessible-autocomplete/issues/777',
  provenance:'Third post-hoc strengthening. Ultra run 7746b726 attempt 1 passed every native-form-guarded gate through the documented onConfirm option, but a reviewer probe showed that clearing a country and pressing Enter inside the field submits the form without a blur, so the old code is still sent. The keyboard task now uses that implicit submission for billing after an unrecognized shipping entry. The previous Atlantis/blank task, clear-shipping and clear-billing are withheld; the two regression guards are unchanged. Same consumer page and pinned component as native-form-guarded. Not blind or production-customer evidence.',
  tasks:null,withheld:null
 },
 'pikaday-booking-dst':{
  source:'benchmarks/pikaday-booking/final-model-component',component:['pikaday.js'],issue:'https://github.com/Pikaday/Pikaday/issues/955',
  provenance:'Post-hoc task added after an independent review (2026-10-24) found that, in Europe/London, ArrowDown from Friday 23 October 2026 selected Thursday 29 October: Pikaday adds 24-hour millisecond blocks, so the end of British Summer Time on 25 October shifts the result one day back. The defect exists in the pinned upstream component and was preserved by the earlier model patches. Source is the original consumer with the final model-authored component from run 459ef2eb attempt 3. Withheld UTC, London and closed-range checks were frozen before inference and omitted from the model request. Not blind or production-customer evidence.',
  tasks:{journey:bookingKeys('pikaday-dst-keyboard','pickup','ArrowDown',{pickup_date:'2026-10-30',return_date:'2026-10-26'},'Europe/London','ArrowDown moves one calendar week across the end of daylight saving time'),functionalJourney:bookingPointer('Europe/London')},
  withheld:async()=>{const t=await readJson('benchmarks/pikaday-booking/tasks.json'),b=await readJson('benchmarks/pikaday-booking-boundary/tasks.json');return {
   'utc-forward':[t.journey,t.functionalJourney,upstream],'utc-backward':[t.withheldJourney,t.withheldFunctionalJourney,upstream],
   'london-forward':[bookingKeys('pikaday-london-right','pickup','ArrowRight',{pickup_date:'2026-10-26',return_date:'2026-10-26'},'Europe/London','London: forward selection across the clock change skips the closed weekend'),bookingPointer('Europe/London'),upstream],
   'london-backward':[bookingKeys('pikaday-london-left','return','ArrowLeft',{pickup_date:'2026-10-23',return_date:'2026-10-23'},'Europe/London','London: backward selection across the clock change skips the closed weekend'),bookingPointer('Europe/London'),upstream],
   'london-week-back':[bookingKeys('pikaday-london-up','return','ArrowUp',{pickup_date:'2026-10-23',return_date:'2026-10-19'},'Europe/London','London: ArrowUp moves back one calendar week'),bookingPointer('Europe/London'),upstream],
   'closed-range-boundary':[b.journey,b.functionalJourney,'benchmarks/pikaday-booking-boundary/original']};}
 }
};
{const guarded=cases['native-form-guarded'];Object.assign(cases['native-form-submit'],{
 tasks:{journey:journey('native-submit-keyboard','Unrecognized or cleared countries must not save an old code, even when submitted from the field',nativeGoal,'keyboard',[seek('#shipping-country','Reach shipping country'),type('Atlantis','Enter a country that is not listed'),seek('#billing-country','Reach billing country'),type('','Clear the billing country'),press('Enter','Submit from inside the billing field')],form('#preferences',{shipping_country:'',billing_country:''})),functionalJourney:nativePointer,guards:guarded.tasks.guards},
 withheld:async()=>({...await guarded.withheld(),'unrecognized-or-blank':[guarded.tasks.journey,nativePointer]})});}
{const submit=cases['native-form-submit'];cases['native-form-markup']={
 source:'benchmarks/native-form-submit/original',issue:'https://github.com/alphagov/accessible-autocomplete/issues/777',
  provenance:'Fourth post-hoc strengthening. Ultra run bea9de3c attempt 2 passed every native-form-submit gate by comparing the visible text with option textContent exactly. A reviewer probe (2026-10-24) reformatted the same options the way server templates commonly print them (text on its own indented line): with that patch, saving without touching either field erased both saved countries, and choosing France saved nothing. The original component kept them. This case uses that semantically identical markup and adds a guard: an untouched save must keep both saved countries. The single-line page is withheld as a transfer check. Pinned GOV.UK component unchanged. Not blind or production-customer evidence.',
 customize:async dir=>{const file=path.join(dir,'index.html'),html=await fs.readFile(file,'utf8'),pretty=html.replace(/<option([^>]*)>([^<]+)<\/option>/g,'\n          <option$1>\n            $2\n          </option>');assert.notEqual(pretty,html);await fs.writeFile(file,pretty);},
 tasks:{...submit.tasks,guards:[...submit.tasks.guards,journey('native-guard-untouched','Guard · saving without editing keeps both saved countries',nativeGoal,'keyboard',[seek('#save','Reach Save without editing'),press('Enter','Save preferences')],form('#preferences',{shipping_country:'gb',billing_country:'de'}))]},
 withheld:async()=>({...await submit.withheld(),'single-line-markup':[submit.tasks.journey,nativePointer,'benchmarks/native-form-submit/original']})};}
const spec=cases[name];if(!spec){console.log('Usage: node scripts/evaluate-followup.mjs --prepare|--repair|--recheck '+Object.keys(cases).join('|'));process.exit(1);}
const implementation=async()=>Object.fromEntries(await Promise.all(implementationFiles.map(async f=>[f,digest(await fs.readFile(f))])));
// An amendment may replace the implementation hashes after a recorded failure; source and tasks stay frozen.
async function unchanged(){const c=await readJson(path.join(root,'commitment.json'));assert.deepEqual(await hashTree(original),c.sourceHashes);const amendments=await Promise.all(['amendment.json','amendment-2.json'].map(f=>readJson(path.join(root,f)).catch(()=>null))),current=await implementation();assert.ok([c.implementation,...amendments.map(a=>a?.implementation)].some(i=>JSON.stringify(i)===JSON.stringify(current)),'Repair implementation changed without a recorded amendment');return c;}
const nextResult=async()=>{for(let n=1;;n++){const file=path.join(root,n===1?'result.json':`result-${n}.json`);try{await fs.access(file);}catch{return file;}}};
async function latestVerified(){for(let n=9;n>=1;n--){const r=await readJson(path.join(root,n===1?'result.json':`result-${n}.json`)).catch(()=>null);if(r?.verification?.verdict==='VERIFIED_PASS')return r;}throw new Error('No verified model run to recheck');}
async function baseline(dir,source,pairs){const browser=await launchBrowser(),server=await fixtureServer(source),out={};try{for(const [label,j]of Object.entries(pairs))out[label]=(await executeJourney({browser,origin:server.origin,journey:j,dir:path.join(dir,label)})).verdict;}finally{await server.close();await browser.close();}return out;}
if(mode==='--prepare'){
 await fs.cp(path.resolve(spec.source),original,{recursive:true,errorOnExist:true,force:false});if(spec.customize)await spec.customize(original);
 const tasks=spec.tasks,withheld=await spec.withheld();await write(path.join(root,'tasks.json'),{...tasks,withheld});
 const before=await baseline(path.join(root,'baseline'),original,{journey:tasks.journey,functionalJourney:tasks.functionalJourney,...Object.fromEntries((tasks.guards||[]).map((g,i)=>['guard-'+i,g]))});
 for(const i of (tasks.guards||[]).keys())assert.equal(before['guard-'+i],'VERIFIED_PASS','guard '+i);
 // Withheld tasks run on their own consumer source: a failing baseline becomes a full repair run, a passing one a preservation replay.
 const preserved={};for(const [label,[k,p,consumer]]of Object.entries(withheld)){const b=await baseline(path.join(root,'baseline-withheld',label),consumer?path.resolve(consumer):original,{keyboard:k,pointer:p});assert.equal(b.pointer,'VERIFIED_PASS',label);preserved[label]={...b,kind:b.keyboard==='VERIFIED_FAIL'?'repair':'preservation'};}
 console.log(JSON.stringify({before,preserved},null,1));
 assert.equal(before.journey,'VERIFIED_FAIL');assert.equal(before.functionalJourney,'VERIFIED_PASS');
 await write(path.join(root,'commitment.json'),{fixedAt:new Date().toISOString(),issue:spec.issue,derivedFrom:spec.source,sourceHashes:await hashTree(original),taskHash:digest({journey:tasks.journey,functionalJourney:tasks.functionalJourney,...(tasks.guards?{guards:tasks.guards}:{})}),withheldTaskHash:digest(withheld),baseline:before,withheldBaseline:preserved,implementation:await implementation(),provenance:spec.provenance});
}else if(mode==='--repair'){
 Object.assign(process.env,parseEnv(await fs.readFile('.env','utf8')));
 const ledger=await readJson('artifacts/inference/budget.json');Object.assign(process.env,{NEBIUS_MAX_CALLS:String(ledger.calls+3),NEBIUS_MAX_TOTAL_TOKENS:String(ledger.reservedTokens+400000),NEBIUS_MAX_CREDIT_USD:'1.6',NEBIUS_BUDGET_SCOPE:'review-followup-20261024'});if(process.env.FOLLOWUP_MAX_OUTPUT)process.env.NEBIUS_MAX_OUTPUT_TOKENS=process.env.FOLLOWUP_MAX_OUTPUT;if(process.argv[4])process.env.NEBIUS_MODEL=process.argv[4];
 const c=await unchanged(),t=await readJson(path.join(root,'tasks.json'));
 const run=await runRepair({fixture:'custom-project',mode:'nebius',sourceRoot:original,journey:t.journey,functionalJourney:t.functionalJourney,guards:t.guards||[],maxAttempts:3,freshInference:true,sourceMetadata:{kind:'source',name:t.journey.title,scope:c.provenance,originalRoot:original}});
 for(const a of run.attempts)if(a.plan)assert.deepEqual(normalizeAdvisory(extractJson((await readJson(`artifacts/runs/${run.id}/model-response-${a.attempt}.json`)).content)),a.plan);
 const request=(await Promise.all(run.attempts.filter(a=>a.provenance?.requestFile).map(a=>fs.readFile(`artifacts/runs/${run.id}/model-request-${a.attempt}.json`,'utf8')))).join('\n');
 assert.equal((await verifyProof(`artifacts/runs/${run.id}`)).pass,true);await unchanged();
 await write(await nextResult(),{completedAt:new Date().toISOString(),modelRun:run.id,verification:run.verification,withheldTitlesAbsentFromRequests:Object.values(t.withheld).every(([k])=>!request.includes(k.title)),attempts:run.attempts.map(a=>({attempt:a.attempt,verified:a.verified,category:a.category,failure:a.failure,model:a.provenance?.model,requestId:a.provenance?.requestId,usage:a.provenance?.usage,latencyMs:a.provenance?.latencyMs}))});
 console.log(JSON.stringify({run:run.id,verdict:run.verification.verdict,attempts:run.attempts.map(a=>[a.attempt,a.category,a.failure?.slice(0,160)])},null,1));
}else if(mode==='--challenge'){
 // Replay an earlier model patch against this case's frozen gate. No inference.
 const [runId,attempt]=process.argv.slice(4),c=await unchanged(),t=await readJson(path.join(root,'tasks.json')),old=await readJson(`artifacts/runs/${runId}/run.json`),a=old.attempts.find(a=>a.attempt===Number(attempt));assert.ok(a?.diff,'Attempt has no applied patch');
 const candidate=path.resolve(`artifacts/runs/${runId}/candidate-${a.attempt}`),reference=path.join(root,'challenge-sources',`${runId.slice(0,8)}-${a.attempt}`);await fs.cp(original,reference,{recursive:true,errorOnExist:true,force:false});
 // Replay the model's own edits by unique exact preimage, not whole files, so consumer additions survive.
 for(const edit of (await readJson(`artifacts/runs/${runId}/plan-${a.attempt}.json`)).edits){const file=path.join(reference,edit.path),text=await fs.readFile(file,'utf8');assert.equal(text.split(edit.before).length,2,'Preimage must match exactly once: '+edit.path);await fs.writeFile(file,text.replace(edit.before,()=>edit.after));}
 const changed=Object.entries(await hashTree(reference)).filter(([f,h])=>h!==c.sourceHashes[f]).map(([f])=>f);assert.ok(changed.length,'Recorded diff changed no file');
 const run=await runRepair({fixture:'custom-project',mode:'reference',sourceRoot:original,referenceRoot:reference,journey:t.journey,functionalJourney:t.functionalJourney,guards:t.guards||[],maxAttempts:1,sourceMetadata:{kind:'source',name:`Earlier model patch vs strengthened gate · run ${runId.slice(0,8)} attempt ${a.attempt}`,originalRoot:original,execution:'fresh-browser-recheck',reusedFrom:runId,reusedAttempt:a.attempt,scope:`Browser-only replay of the model-authored change to ${changed.join(', ')} from run ${runId.slice(0,8)} attempt ${a.attempt}, copied byte-for-byte onto this case source. No new inference.`}});
 assert.equal((await verifyProof(`artifacts/runs/${run.id}`)).pass,true);const file=path.join(root,`challenge-${runId.slice(0,8)}-${a.attempt}.json`);await write(file,{at:new Date().toISOString(),challengedRun:runId,attempt:a.attempt,changedFiles:changed,run:run.id,verification:run.verification,inferenceCalls:0});
 console.log(JSON.stringify({run:run.id,verdict:run.verification.verdict,reasons:run.verification.reasons},null,1));
}else if(mode==='--recheck'){
 const c=await unchanged(),t=await readJson(path.join(root,'tasks.json')),result=await latestVerified(),model=await readJson(`artifacts/runs/${result.modelRun}/run.json`),a=model.attempts.find(a=>a.verified);assert.ok(a,'No verified model attempt to recheck');
 const candidate=path.resolve(`artifacts/runs/${model.id}/candidate-${a.attempt}`),rechecks={};
 for(const [label,[k,p,consumer]]of Object.entries(t.withheld)){
  // Another consumer receives the cumulative component plus every file the model changed, byte-for-byte.
  let source=original,reference=candidate;
  if(consumer){source=path.resolve(consumer);reference=path.join(root,'recheck-sources',label);await fs.cp(source,reference,{recursive:true,errorOnExist:true,force:false});const after=await hashTree(candidate);for(const [f,h]of Object.entries(after))if(spec.component?.includes(f)||h!==c.sourceHashes[f])await fs.copyFile(path.join(candidate,f),path.join(reference,f));}
  if(c.withheldBaseline[label].kind==='preservation'){const replay=await baseline(path.join(root,'preservation',label),reference,{keyboard:k,pointer:p});rechecks[label]={kind:'preservation',...replay,verdict:replay.keyboard==='VERIFIED_PASS'&&replay.pointer==='VERIFIED_PASS'?'VERIFIED_PASS':'VERIFIED_FAIL'};continue;}
  const run=await runRepair({fixture:'custom-project',mode:'reference',sourceRoot:source,referenceRoot:reference,journey:k,functionalJourney:p,maxAttempts:1,sourceMetadata:{kind:'source',name:`Withheld recheck · ${k.title}`,originalRoot:source,execution:'fresh-browser-recheck',reusedFrom:model.id,reusedAttempt:a.attempt,scope:`Task frozen before inference and omitted from the model request. Browser-only verification of the model candidate from run ${model.id.slice(0,8)} attempt ${a.attempt}; no new inference.${consumer?' Baseline is this consumer as previously shipped; the candidate copies the model-authored component byte-for-byte into it.':''}`}});
  rechecks[label]={kind:'repair',run:run.id,verdict:run.verification.verdict,reasons:run.verification.reasons,baseline:run.before?.verdict};assert.equal((await verifyProof(`artifacts/runs/${run.id}`)).pass,true);
 }
 await write(path.join(root,'recheck.json'),{at:new Date().toISOString(),modelRun:model.id,attempt:a.attempt,inferenceCalls:0,rechecks});console.log(JSON.stringify(rechecks,null,1));
}
