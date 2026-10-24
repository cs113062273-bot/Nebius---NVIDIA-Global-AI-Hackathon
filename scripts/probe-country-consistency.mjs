import fs from 'node:fs/promises';
import path from 'node:path';
import {fixtureServer} from '../src/static.js';
import {launchBrowser} from '../src/runner.js';

// Reviewer probe, not a gate: after each interaction, does browser FormData match the text each country field shows?
// Usage: node scripts/probe-country-consistency.mjs <output.json> <label=source-dir>...
const [output,...targets]=process.argv.slice(2);
if(!output||!targets.length){console.log('Usage: node scripts/probe-country-consistency.mjs <output.json> <label=source-dir>...');process.exit(1);}
const codes={'':'','united kingdom':'gb','france':'fr','germany':'de','italy':'it','no saved country':''};
const edit=(field,text,keys)=>async page=>{await page.focus(field);await page.keyboard.press('ControlOrMeta+A');if(text==='')await page.keyboard.press('Backspace');else await page.keyboard.type(text);for(const key of keys)await page.keyboard.press(key);};
const scenarios={
 'Save without editing':async()=>{},
 'Type "france", Enter inside the field':edit('#shipping-country','france',['Enter','Enter']),
 'Type "France " (trailing space), Enter inside the field':edit('#shipping-country','France ',['Enter','Enter']),
 'Type unlisted "Atlantis", Enter inside the field':edit('#shipping-country','Atlantis',['Enter','Enter']),
 'Clear shipping, Enter inside the field':edit('#shipping-country','',['Enter']),
 'Clear billing, Enter inside the field':edit('#billing-country','',['Enter']),
 'Type "Fra", Tab away':edit('#shipping-country','Fra',['Tab']),
 'Type "Fra", Escape, Tab away':edit('#shipping-country','Fra',['Escape','Tab']),
 'Type "It", ArrowDown, Enter':edit('#billing-country','It',['ArrowDown','Enter']),
 'Type "Ita", Enter inside the field':edit('#billing-country','Ita',['Enter','Enter']),
 'Choose France, then retype unlisted "Germ"':async page=>{await edit('#shipping-country','France',['Enter'])(page);await edit('#shipping-country','Germ',['Tab'])(page);}
};
const browser=await launchBrowser(),results=[];
try{
 for(const target of targets){
  const [label,dir]=target.split('=');
  for(const [name,act] of Object.entries(scenarios)){
   const server=await fixtureServer(path.resolve(dir)),context=await browser.newContext({timezoneId:'UTC',locale:'en-US'}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message.slice(0,200)));
   try{
    await page.goto(server.origin+'/');await act(page);await page.waitForTimeout(150);
    const visible={shipping:(await page.inputValue('#shipping-country')).trim(),billing:(await page.inputValue('#billing-country')).trim()};
    if(!await page.evaluate(()=>document.activeElement?.id==='save'))await page.focus('#save');
    await page.keyboard.press('Enter');await page.waitForTimeout(100);
    const submitted=await page.evaluate(()=>{const data=new FormData(document.querySelector('#preferences'));return {shipping:data.get('shipping_country'),billing:data.get('billing_country')};});
    const expected={shipping:codes[visible.shipping.toLowerCase()]??'',billing:codes[visible.billing.toLowerCase()]??''};
    results.push({source:label,scenario:name,visible,submitted,consistent:expected.shipping===submitted.shipping&&expected.billing===submitted.billing&&!errors.length,errors});
   }finally{await context.close();await server.close();}
  }
 }
}finally{await browser.close();}
const summary=Object.fromEntries(targets.map(t=>t.split('=')[0]).map(label=>[label,`${results.filter(r=>r.source===label&&r.consistent).length}/${Object.keys(scenarios).length} consistent`]));
await fs.writeFile(output,JSON.stringify({at:new Date().toISOString(),inferenceCalls:0,method:'Fresh Chromium context per scenario (UTC, en-US). Visible text is the trimmed input value after the interaction; the expected code maps that text to the listed option (unlisted or empty text maps to no saved country). Submission uses Enter on Save, or the implicit submission already triggered from inside the field.',summary,results},null,2)+'\n');
console.log(JSON.stringify(summary,null,1));
for(const r of results.filter(r=>!r.consistent))console.log('MISMATCH',r.source,'·',r.scenario,JSON.stringify(r.visible),'→',JSON.stringify(r.submitted));
