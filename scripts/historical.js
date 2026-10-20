import path from 'node:path';
import { ROOT } from '../src/catalog.js';
import { fixtureServer } from '../src/static.js';
import { launchBrowser,executeJourney } from '../src/runner.js';
import { json,readJson } from '../src/files.js';

export async function historicalBenchmark() {
  const root=path.join(ROOT,'benchmarks','historical','a11y-dialog-restore'),browser=await launchBrowser();const outputs={};
  const journey={version:1,id:'historical-dialog-restore',title:'Dismiss notice and restore focus',source:'benchmark',goal:'Return keyboard focus to the opener after dismissing an opacity-hidden dialog',profile:'keyboard',path:'/',steps:[{title:'Reach notice trigger',action:{kind:'seek',selector:'#open'}},{title:'Open notice',action:{kind:'press',key:'Enter'},assertions:[{kind:'focus',selector:'#dialog'}]},{title:'Dismiss and restore focus',action:{kind:'press',key:'Escape'},assertions:[{kind:'focus',selector:'#open'}]}],success:[{kind:'focus',selector:'#open'}],functional:[{kind:'attribute',selector:'#dialog',name:'aria-hidden',value:'true'}],forbidden:[]};
  try{for(const phase of ['before','after']){const server=await fixtureServer(path.join(root,phase));try{outputs[phase]=await executeJourney({browser,origin:server.origin,journey,dir:path.join(ROOT,'artifacts','historical',phase)});}finally{await server.close();}}}finally{await browser.close();}
  const result={cases:1,reproduced:outputs.before.verdict==='VERIFIED_FAIL'?1:0,humanFixReplayed:outputs.after.verdict==='VERIFIED_PASS'?1:0,autonomousRepairs:0,holdout:false,provenance:await readJson(path.join(root,'provenance.json')),before:outputs.before.verdict,after:outputs.after.verdict};await json(path.join(ROOT,'benchmarks','historical-results.json'),result);return result;
}
if(process.argv[1]?.endsWith('historical.js'))console.log(JSON.stringify(await historicalBenchmark(),null,2));
