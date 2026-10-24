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
import {extractJson} from '../src/nebius.js';

const root=path.resolve('benchmarks/native-form'),original=path.join(root,'original');
const json=async(file,data)=>fs.writeFile(file,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
const implementationFiles=['src/engine.js','src/nebius.js','src/repair.js','src/runner.js','src/schema.js','src/verifier.js'];
function task(billing=false,pointer=false){
 const field=billing?'billing':'shipping',label=billing?'Italy':'France';
 const checks=[{kind:'form-data',selector:'#preferences',name:'shipping_country',value:[billing?'gb':pointer?'fr':'']},{kind:'form-data',selector:'#preferences',name:'billing_country',value:[billing?(pointer?'it':''):'de']}];
 const steps=pointer?[{title:`Edit ${field} country`,action:{kind:'click',selector:`#${field}-country`}},{title:`Choose ${label}`,action:{kind:'type',text:label,replace:true}},{title:'Confirm the suggested country',action:{kind:'click',selector:`#${field}-country__option--0`}},{title:'Save preferences',action:{kind:'click',selector:'#save'}}]:[{title:`Reach saved ${field} country`,action:{kind:'seek',selector:`#${field}-country`,maxTabs:24}},{title:'Clear the optional saved country',action:{kind:'type',text:'',replace:true}},{title:'Leave the country field',action:{kind:'seek',selector:'#save',maxTabs:24}},{title:'Save preferences',action:{kind:'press',key:'Enter'}}];
 return Journey.parse({version:1,id:`native-${field}-${pointer?'pointer':'keyboard'}`,title:pointer?`Preserve the selected ${field} country in native form data`:`Clearing ${field} must clear its actual form value`,goal:'Native form data must match the visible country choices; preserve the other country.',source:'authored',profile:pointer?'pointer':'keyboard',path:'/',steps,success:checks,functional:checks,forbidden:[]});
}
async function frozen(){const c=await readJson(path.join(root,'commitment.json'));assert.deepEqual(await hashTree(original),c.sourceHashes);for(const [f,h]of Object.entries(c.implementation))assert.equal(digest(await fs.readFile(f)),h,'Changed frozen implementation: '+f);return c;}
if(process.argv.includes('--prepare')){
 try{await fs.access(path.join(root,'commitment.json'));throw new Error('Already committed; use a new directory for another experiment.');}catch(e){if(e.code!=='ENOENT')throw e;}
 await fs.mkdir(root,{recursive:true});await fs.cp('benchmarks/autocomplete-countries/original',original,{recursive:true,errorOnExist:true,force:false});
 // Remove the authored receipt: the verifier reads the browser form, with no result instrumentation.
 let html=await fs.readFile(path.join(original,'index.html'),'utf8');html=html.replace(/<output\b[^>]*>[\s\S]*?<\/output>/,'');await fs.writeFile(path.join(original,'index.html'),html);
 await fs.writeFile(path.join(original,'app.js'),"for(const id of ['shipping-country','billing-country'])accessibleAutocomplete.enhanceSelectElement({selectElement:document.getElementById(id)});\ndocument.getElementById('preferences').addEventListener('submit',event=>event.preventDefault());\n");
 const prior=await readJson('benchmarks/autocomplete-countries/commitment.json');for(const f of ['accessible-autocomplete.js','autocomplete.css','LICENSE.txt'])assert.equal(digest(await fs.readFile(path.join(original,f))),prior.sourceHashes[f]);
 const tasks={journey:task(),functionalJourney:task(false,true),withheldJourney:task(true),withheldFunctionalJourney:task(true,true)};await json(path.join(root,'tasks.json'),tasks);
 const browser=await launchBrowser(),server=await fixtureServer(original),baseline={};try{for(const [key,journey]of Object.entries(tasks))baseline[key]=await executeJourney({browser,origin:server.origin,journey,dir:path.join(root,'baseline',key)});}finally{await server.close();await browser.close();}
 for(const name of ['journey','withheldJourney'])assert.equal(baseline[name].verdict,'VERIFIED_FAIL',name);for(const name of ['functionalJourney','withheldFunctionalJourney'])assert.equal(baseline[name].verdict,'VERIFIED_PASS',name);
 const implementation={};for(const file of implementationFiles)implementation[file]=digest(await fs.readFile(file));
 const commitment={fixedAt:new Date().toISOString(),repository:prior.repository,revision:prior.revision,issue:prior.issue,sourceHashes:await hashTree(original),taskHash:digest({journey:tasks.journey,functionalJourney:tasks.functionalJourney}),withheldTaskHash:digest({journey:tasks.withheldJourney,functionalJourney:tasks.withheldFunctionalJourney}),implementation,provenance:'Author-created consumer of unmodified pinned GOV.UK component; publicly reported stale-select bug. No receipt/output instrumentation. Browser FormData at the final checkpoint, not a network/server persistence claim. Billing acceptance steps are committed before inference, omitted from model task requirements, but billing markup is visible in source. Not a blind evaluation.',baseline:Object.fromEntries(Object.entries(baseline).map(([key,r])=>[key,{verdict:r.verdict,checks:r.checks}]))};
 await json(path.join(root,'commitment.json'),commitment);console.log(JSON.stringify({prepared:true,fixedAt:commitment.fixedAt,baseline:Object.fromEntries(Object.entries(baseline).map(([key,r])=>[key,r.verdict]))}));
}else if(process.argv.includes('--repair')){
 Object.assign(process.env,parseEnv(await fs.readFile('.env','utf8')));const ledger=await readJson('artifacts/inference/budget.json');process.env.NEBIUS_MAX_CALLS=String(ledger.calls+3);process.env.NEBIUS_MAX_TOTAL_TOKENS=String(ledger.reservedTokens+250000);process.env.NEBIUS_MAX_CREDIT_USD='1';process.env.NEBIUS_BUDGET_SCOPE='usefulness-20261021';
 const c=await frozen(),t=await readJson(path.join(root,'tasks.json'));
 const sourceMetadata={kind:'source',name:'Native form data: an empty country must not retain its old code',scope:c.provenance,originalRoot:original};
 const args={fixture:'custom-project',sourceRoot:original,sourceMetadata,journey:t.journey,functionalJourney:t.functionalJourney};
 const run=await runRepair({...args,mode:'nebius',maxAttempts:3,freshInference:true});
 const result={completedAt:new Date().toISOString(),modelRun:run.id,verification:run.verification,attempts:run.attempts.map(a=>({attempt:a.attempt,verified:a.verified,category:a.category,failure:a.failure,provenance:a.provenance})),transferRun:null,negativeRun:null};
 for(const a of run.attempts)if(a.plan)assert.deepEqual(extractJson((await readJson(`artifacts/runs/${run.id}/model-response-${a.attempt}.json`)).content),a.plan);
 const a=run.attempts.find(a=>a.verified);
 if(a){
  const candidate=path.resolve(`artifacts/runs/${run.id}/candidate-${a.attempt}`);
  const transfer=await runRepair({...args,mode:'reference',referenceRoot:candidate,journey:t.withheldJourney,functionalJourney:t.withheldFunctionalJourney,sourceMetadata:{...sourceMetadata,name:'Same patch: precommitted billing task',execution:'fresh-browser-recheck',reusedFrom:run.id,reusedAttempt:a.attempt}});result.transferRun=transfer.id;result.transferVerification=transfer.verification;assert.equal((await verifyProof(`artifacts/runs/${transfer.id}`)).pass,true);
  const negativeSource=path.join(root,'human-wrong-country');await fs.cp(candidate,negativeSource,{recursive:true,errorOnExist:true,force:false});
  await fs.appendFile(path.join(negativeSource,'app.js'),"\n// Author-added negative control: visible France, wrong form code.\ndocument.getElementById('preferences').addEventListener('submit',()=>{if(document.getElementById('shipping-country').value==='France')document.getElementById('shipping-country-select').value='gb';});\n");
  const negative=await runRepair({...args,mode:'reference',referenceRoot:negativeSource,sourceMetadata:{...sourceMetadata,name:'Human negative control: visible France, form code gb',execution:'human-negative-control',reusedFrom:run.id,reusedAttempt:a.attempt}});result.negativeRun=negative.id;result.negativeVerification=negative.verification;assert.equal((await verifyProof(`artifacts/runs/${negative.id}`)).pass,true);assert.equal(negative.after.verdict,'VERIFIED_PASS');assert.equal(negative.functionalAfter.verdict,'VERIFIED_FAIL');
 }
 assert.equal((await verifyProof(`artifacts/runs/${run.id}`)).pass,true);await frozen();await json(path.join(root,'result.json'),result);console.log(JSON.stringify(result,null,2));
}else console.log('Use --prepare to freeze the native-form case; --repair makes up to three sponsor-credit calls and records transfer/negative controls.');
