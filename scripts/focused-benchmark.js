import path from 'node:path';
import { launchBrowser } from '../src/runner.js';
import { ROOT } from '../src/catalog.js';
import { json } from '../src/files.js';

const labels=['Continue','Send request','儲存設定','Réserver','確認 ✓','حفظ','Apply filter','Next step','Export report','Create workspace'];
const families=['enter-activation','space-activation','input-name','checkbox-space','tabs-arrow','disclosure','dialog-entry','dialog-escape','focus-restore','status-semantics','reduced-motion','reflow'];
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
async function probe(page,family,fixed,label){
  const name=escape(label);let html='',script='',check;
  if(family==='enter-activation'||family==='space-activation'||family==='disclosure'){
    html=`<${fixed?'button':'div'} id="action" ${fixed?'':'role="button" tabindex="0"'}>${name}</${fixed?'button':'div'}><p id="out"></p>`;script="document.querySelector('#action').onclick=()=>document.querySelector('#out').textContent='done';";
    check=async()=>{await page.keyboard.press('Tab');await page.keyboard.press(family==='space-activation'?'Space':'Enter');return await page.locator('#out').textContent()==='done';};
  }else if(family==='input-name'){
    html=`<label ${fixed?'for="field"':''}>${name}</label><input id="field">`;check=async()=>await page.getByRole('textbox',{name:label,exact:true}).count()===1;
  }else if(family==='checkbox-space'){
    html=fixed?`<label><input id="action" type="checkbox">${name}</label>`:`<div id="action" role="checkbox" aria-checked="false" tabindex="0">${name}</div>`;
    check=async()=>{await page.keyboard.press('Tab');await page.keyboard.press('Space');return fixed?await page.locator('#action').isChecked():await page.locator('#action').getAttribute('aria-checked')==='true';};
  }else if(family==='tabs-arrow'){
    html=`<div role="tablist" aria-label="Views"><button role="tab" id="first" aria-selected="true">Overview</button><button id="second" role="tab" aria-selected="false" tabindex="-1">${name}</button></div>`;
    if(fixed)script="document.querySelector('#first').onkeydown=e=>{if(e.key==='ArrowRight'){document.querySelector('#second').focus();document.querySelector('#second').setAttribute('aria-selected','true');document.querySelector('#first').setAttribute('aria-selected','false');}};";
    check=async()=>{await page.keyboard.press('Tab');await page.keyboard.press('ArrowRight');return await page.locator('#second').evaluate(el=>el===document.activeElement&&el.getAttribute('aria-selected')==='true');};
  }else if(['dialog-entry','dialog-escape','focus-restore'].includes(family)){
    html=`<button id="open">${name}</button><section id="dialog" hidden role="dialog" aria-label="Notice"><button id="close">Close</button></section>`;
    script=`const dialog=document.querySelector('#dialog'),open=document.querySelector('#open'),close=document.querySelector('#close');open.onclick=()=>{dialog.hidden=false;${fixed||family!=='dialog-entry'?'close.focus();':''}};close.onclick=()=>{dialog.hidden=true;${fixed?'open.focus();':''}};${fixed?"document.addEventListener('keydown',e=>{if(e.key==='Escape')close.click();});":''}`;
    check=async()=>{await page.keyboard.press('Tab');await page.keyboard.press('Enter');if(family==='dialog-entry')return await page.locator('#close').evaluate(el=>el===document.activeElement);if(family==='dialog-escape'){await page.keyboard.press('Escape');return !await page.locator('#dialog').isVisible();}await page.keyboard.press('Enter');return await page.locator('#open').evaluate(el=>el===document.activeElement);};
  }else if(family==='status-semantics'){
    html=`<p id="out" ${fixed?'role="status" aria-live="polite"':''}>${name}</p>`;check=async()=>await page.getByRole('status').count()===1;
  }else if(family==='reduced-motion'){
    html=`<style>@keyframes move{to{transform:translateX(50px)}}#out{animation:move 5s infinite}${fixed?'@media(prefers-reduced-motion:reduce){#out{animation:none}}':''}</style><p id="out">${name}</p>`;check=async()=>await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length===0);
  }else{
    html=`<style>body{margin:0}#out{${fixed?'max-width:100%;overflow-wrap:anywhere':'width:900px;min-width:900px'}}</style><div id="out">${name}</div>`;check=async()=>await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=2);
  }
  await page.setContent(`<!doctype html><html lang="en"><head><title>Focused browser fixture</title></head><body>${html}<script>${script}</script></body></html>`);
  return check();
}
export async function focusedBenchmark(){const browser=await launchBrowser(),rows=[];try{for(const family of families)for(let i=0;i<labels.length;i++){const results=[];for(const fixed of [false,true]){const context=await browser.newContext({viewport:{width:320,height:800},reducedMotion:'reduce'});try{const page=await context.newPage();results.push(await probe(page,family,fixed,labels[i]));}finally{await context.close();}}rows.push({family,variant:i,brokenSatisfied:results[0],referenceSatisfied:results[1],pass:!results[0]&&results[1]});}}finally{await browser.close();}
  const result={pairs:rows.length,families:families.length,metamorphicVariants:labels.length,passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.pass),note:'Focused assertion fixtures. Ten label variants per family are correlated, not 120 independent real defects. These are author reference states, not generated repairs.',rows};await json(path.join(ROOT,'benchmarks','focused-results.json'),result);return result;
}
if(process.argv[1]?.endsWith('focused-benchmark.js')){const result=await focusedBenchmark();console.log(JSON.stringify({...result,rows:undefined},null,2));if(result.failed.length)process.exitCode=1;}
