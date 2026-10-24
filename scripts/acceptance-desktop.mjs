import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { digest } from '../src/schema.js';
import { hashTree,readJson,json } from '../src/files.js';
import { verifyProof } from '../src/proof.js';

// This acceptance invokes the product through UI controls. It never injects a plan,
// substitutes provider output, or calls the repair engine directly.
const root=path.resolve('benchmarks/desktop-holdout');
const output=path.resolve('artifacts/quality-ui');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const tick=()=>page.waitForTimeout(140);
const source=path.join(root,'original');
const finished=async()=>{await page.waitForFunction(()=>document.querySelector('#project-verdict').textContent!=='RUNNING',null,{timeout:300000});return await page.evaluate(()=>localStorage.getItem('tabstitch.projectRun'));};
try{
 await page.goto('http://127.0.0.1:4317/project.html');
 await page.locator('#original-files').setInputFiles(source);
 await page.locator('#project-mode').selectOption('nebius');
 await page.locator('#open-capture').click();
 await page.locator('#start-capture').click();
 const frame=page.frameLocator('#capture-frame');
 await frame.locator('h1').click();
 for(const key of ['Tab','ControlOrMeta+A','Backspace']){await page.keyboard.press(key);await tick();}
 await page.keyboard.type('2');await tick();
 for(const key of ['Tab','Space','Tab','Enter']){await page.keyboard.press(key);await tick();}
 await page.locator('#stop-capture').click();
 await page.locator('#capture-profile').selectOption('pointer');
 await page.locator('#start-capture').click();
 await frame.locator('#seats').click();await tick();
 await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('2');await tick();
 await frame.locator('#community').click();await tick();
 await frame.locator('#generate').click();await tick();
 await page.locator('#stop-capture').click();
 for(const kind of ['text','attribute','visible']){
  await page.locator('#pick-result').click();await frame.locator('#estimate').click();
  await page.locator('#assertion-kind').selectOption(kind);
  if(kind==='attribute')await page.locator('#attribute-name').selectOption('data-rate');
  await page.locator('#save-assertion').click();
 }
 const confirmed=page.waitForResponse(r=>r.url().endsWith('/api/project-task')&&r.request().method()==='POST');
 await page.locator('#freeze-task').click();
 const contract=await (await confirmed).json();assert.ok(contract.hash);
 await page.waitForFunction(()=>document.querySelector('#freeze-status').textContent.startsWith('Confirmed'));
 const implementation={};for(const f of ['src/diff.js','src/engine.js','src/nebius.js','src/project.js','src/repair.js','src/runner.js','src/schema.js','src/server.js','src/static.js','src/verifier.js','public/project.html','public/project.js','public/project.css','public/recorder.js'])implementation[f]=digest(await fs.readFile(f));
 const commitment={fixedAt:new Date().toISOString(),case:'Seatwise annual community-rate estimate',provenance:'New author-created browser app fixed after implementation. Not an external production case. No model runs or implementation tuning used this case before this commitment.',sourceHashes:await hashTree(source),implementation,taskHash:contract.hash,journey:contract.journey,functionalJourney:contract.functionalJourney,callsBefore:(await readJson('artifacts/inference/budget.json')).calls};
 // Exclusive creation prevents silently rewriting an existing commitment.
 await fs.writeFile(path.join(root,'commitment.json'),JSON.stringify(commitment,null,2),{flag:'wx'});
 console.log(JSON.stringify({committed:true,taskHash:contract.hash,sourceHash:digest(commitment.sourceHashes),keyboardSteps:contract.journey.steps.length,pointerSteps:contract.functionalJourney.steps.length}));
 await page.locator('#verify-project').click();
 const positiveId=await finished(),positive=await readJson(`artifacts/runs/${positiveId}/run.json`);
 await page.screenshot({path:path.join(output,'holdout-nemotron.png'),fullPage:true});
 await json(path.join(root,'positive-result.json'),{id:positive.id,model:positive.model,verification:positive.verification,attempts:positive.attempts.map(a=>({attempt:a.attempt,category:a.category,failure:a.failure,verified:a.verified,patchValidation:a.patchValidation}))});
 console.log(JSON.stringify({positiveId,verdict:positive.verification,model:positive.model,attempts:positive.attempts.map(a=>({attempt:a.attempt,category:a.category,verified:a.verified}))}));
 assert.equal(positive.verification.verdict,'VERIFIED_PASS');assert.equal(positive.model.cacheHit,false);assert.ok(positive.model.requestId);assert.match(positive.model.model,/nemotron/i);
 const attempt=positive.attempts.find(a=>a.verified);assert.equal(attempt.patchValidation.gitApplyCheck,true);assert.equal(attempt.patchValidation.candidateBytesMatch,true);
 assert.equal((await verifyProof(`artifacts/runs/${positiveId}`)).pass,true);
 const bad=path.join(root,'broken-result');await fs.cp(`artifacts/runs/${positiveId}/candidate-${attempt.attempt}`,bad,{recursive:true,errorOnExist:true,force:false});
 const app=path.join(bad,'app.js');await fs.appendFile(app,"\n// Deliberate human-authored negative control: corrupt the business result.\ndocument.addEventListener('click', event => {\n  if (event.target.closest('#generate')) document.querySelector('#estimate').dataset.rate = 'standard';\n});\n");
 await page.locator('#project-mode').selectOption('reference');await page.locator('#edited-files').setInputFiles(bad);
 const reconfirmed=page.waitForResponse(r=>r.url().endsWith('/api/project-task')&&r.request().method()==='POST');await page.locator('#freeze-task').click();const unchanged=await (await reconfirmed).json();assert.equal(unchanged.hash,contract.hash,'Negative control must use identical frozen acceptance');
 await page.locator('#verify-project').click();const negativeId=await finished(),negative=await readJson(`artifacts/runs/${negativeId}/run.json`);
 await page.screenshot({path:path.join(output,'holdout-rejected.png'),fullPage:true});
 assert.equal(negative.verification.verdict,'VERIFIED_FAIL');assert.ok(negative.verification.reasons.includes('Functional output changed'));assert.equal(negative.functionalAfter.verdict,'VERIFIED_FAIL');assert.equal((await verifyProof(`artifacts/runs/${negativeId}`)).pass,true);
 assert.deepEqual(await hashTree(source),commitment.sourceHashes,'Original project must stay unchanged');
 for(const [f,hash]of Object.entries(implementation))assert.equal(digest(await fs.readFile(f)),hash,'Holdout cannot tune implementation: '+f);
 assert.deepEqual(errors,[]);
 const summary={completedAt:new Date().toISOString(),scope:commitment.provenance,taskHash:contract.hash,sourceHash:digest(commitment.sourceHashes),positive:{runId:positiveId,model:positive.model,verdict:positive.verification.verdict,keyboard:positive.after.verdict,functional:positive.functionalAfter.verdict,patchValidation:attempt.patchValidation,proofIntegrity:true,attempts:positive.attempts.length,url:`http://127.0.0.1:4317/project.html?run=${positiveId}`},negative:{runId:negativeId,provenance:'Human-authored corruption appended to the model candidate; no inference for this control.',verdict:negative.verification.verdict,keyboard:negative.after.verdict,functional:negative.functionalAfter.verdict,reasons:negative.verification.reasons,failedAssertions:negative.functionalAfter.functional.filter(a=>!a.pass),proofIntegrity:true,url:`http://127.0.0.1:4317/project.html?run=${negativeId}`},originalUnchanged:true,implementationUnchangedSinceCommitment:true,browserErrors:errors};
 await json('benchmarks/desktop-acceptance.json',summary);console.log(JSON.stringify(summary));
}finally{await browser.close();}
