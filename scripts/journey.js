import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fixturePath,journeyFor,ROOT } from '../src/catalog.js';
import { importJourney,discover } from '../src/discovery.js';
import { fixtureServer } from '../src/static.js';
import { launchBrowser,executeJourney } from '../src/runner.js';
import { json,listFiles } from '../src/files.js';

const args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);return i>=0?args[i+1]:undefined;};
const source=value('--source')?path.resolve(value('--source')):fixturePath(value('--fixture')||'checkout',args.includes('--reference')?'reference':'broken');
// Local static documents only: no package installation, shell or project-server execution.
const files=await listFiles(source);if(files.length>300 || !(await fs.stat(path.join(source,'index.html'))).isFile())throw new Error('Expected a small trusted static application with index.html');
const browser=await launchBrowser(),server=await fixtureServer(source);
try{
  if(args.includes('--discover')){const context=await browser.newContext();try{await context.route('**/*',route=>new URL(route.request().url()).origin===server.origin?route.continue():route.abort());const page=await context.newPage();await page.goto(server.origin);console.log(JSON.stringify(await discover(page),null,2));}finally{await context.close();}}
  else{const journey=value('--journey')?await importJourney(value('--journey')):journeyFor(value('--fixture')||'checkout');const dir=path.join(ROOT,'artifacts','journeys',randomUUID());await json(path.join(dir,'journey.json'),journey);const result=await executeJourney({browser,origin:server.origin,journey,dir});console.log(JSON.stringify({verdict:result.verdict,failure:result.failure,evidence:path.relative(ROOT,dir)},null,2));if(result.verdict!=='VERIFIED_PASS')process.exitCode=1;}
}finally{await server.close();await browser.close();}
