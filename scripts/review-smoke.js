import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import axe from 'axe-core';
import { ROOT } from '../src/catalog.js';
import { serveFile } from '../src/static.js';
import { launchBrowser } from '../src/runner.js';

// Exercise the delivered static build under a project subpath, without an API server.
const root=path.join(ROOT,'artifacts','judge-demo');
const server=http.createServer((req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\/judge-demo\//,'')||'index.html';
 void serveFile(res,root,name,{fixture:name.startsWith('previews/')});
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await launchBrowser();const errors=[],failures=[];
await fs.mkdir(path.join(ROOT,'artifacts','review'),{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin!==origin||route.request().method()!=='GET'){failures.push(u.pathname);return route.abort();}
  return route.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)failures.push(r.url().replace(origin,''));});
 await page.goto(origin+'/judge-demo/',{waitUntil:'networkidle'});await page.waitForFunction(()=>!document.querySelector('#play').disabled);
 assert.equal(await page.locator('#before-focus').innerText(),'#dialog');assert.equal(await page.locator('#after-focus').innerText(),'#open');
 await page.locator('#verify-proof').click();await page.getByText('Archive SHA-256 matches.',{exact:false}).waitFor();
 await page.screenshot({path:path.join(ROOT,'artifacts/review/judge-desktop.png'),fullPage:true});
 for(const a of await page.locator('.evidence-files a').all()){const r=await fetch(await a.getAttribute('href'));assert.equal(r.status,200);}
 for(const phase of ['original','repaired']){
  const preview=await context.newPage();await preview.goto(origin+`/judge-demo/previews/a11y-dialog/${phase}/index.html`);
  await preview.keyboard.press('Tab');await preview.keyboard.press('Enter');await preview.keyboard.press('Escape');
  assert.equal(await preview.evaluate(()=>document.activeElement.id),phase==='original'?'dialog':'open');await preview.close();
 }
 await page.getByRole('button',{name:'Synthetic checkout',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#after-focus').textContent==='#field');
 await page.locator('#step-next').click();assert.equal(await page.locator('#after-focus').innerText(),'#close');
 await page.locator('#show-result').click();assert.equal(await page.locator('#after-status').innerText(),'Task completed');assert.match(await page.locator('#before-status').innerText(),/Stopped/);
 await page.locator('#play').click();assert.equal(await page.locator('#play').innerText(),'Pause journey');await page.locator('#play').click();assert.equal(await page.locator('#play').innerText(),'Play journey');
 await page.evaluate(axe.source);let result=await page.evaluate(()=>axe.run());assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await page.screenshot({path:path.join(ROOT,'artifacts/review/judge-mobile.png'),fullPage:true});
 await page.goto(origin+'/judge-demo/cases.html#case-wrong-fix',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#case-title').textContent.includes('broken result'));
 assert.match(await page.locator('#case-facts').innerText(),/Rejected/);
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 console.log(JSON.stringify({staticSubpath:'PASS',historicalKeyboardBeforeAfter:'PASS',recordingSwitchAndPlayback:'PASS',proofDownloadHash:'PASS',mobileWidths:[390,320],axeViolations:result.violations.length,consoleErrors:errors,failedRequests:failures,inferenceCalls:0},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
