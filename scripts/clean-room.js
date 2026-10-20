import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { ROOT } from '../src/catalog.js';
import { json } from '../src/files.js';

const dir=path.join(ROOT,'artifacts','clean-room-'+randomUUID());await fs.mkdir(dir,{recursive:true});
for(const name of ['package.json','package-lock.json','src','scripts','tests','public','fixtures','benchmarks','README.md','LICENSE','docs'])await fs.cp(path.join(ROOT,name),path.join(dir,name),{recursive:true});
const browserPath=path.join(os.tmpdir(),'tabstitch-clean-browser-'+randomUUID());
const env={...process.env,LIVE_NEBIUS_TESTS:'false',NEBIUS_SPONSOR_CREDITS_CONFIRMED:'false',PLAYWRIGHT_BROWSERS_PATH:browserPath,npm_config_cache:path.join(dir,'.npm-cache')};delete env.NEBIUS_API_KEY;delete env.DEMO_TOKEN;
const npm=process.env.npm_execpath;if(!npm)throw new Error('Invoke with npm run clean-room so npm CLI is resolved without a shell');
const checks=[];
async function command(label,args){const start=performance.now();let output='';const status=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:dir,env,stdio:['ignore','pipe','pipe'],windowsHide:true});const timeout=setTimeout(()=>{child.kill();reject(new Error(label+' timed out'));},240000);child.stdout.on('data',b=>{output+=b.toString();});child.stderr.on('data',b=>{output+=b.toString();});child.on('error',reject);child.on('exit',code=>{clearTimeout(timeout);resolve(code);});});await fs.writeFile(path.join(dir,label+'.log'),output);checks.push({label,pass:status===0,exitCode:status,elapsedMs:Math.round(performance.now()-start)});console.log(label,status===0?'PASS':'FAIL');if(status!==0)throw new Error(output.slice(-10000));}
try{
  await command('fresh-dependencies',[npm,'ci','--ignore-scripts','--no-audit','--no-fund']);
  await command('fresh-chromium',[path.join(dir,'node_modules','playwright','cli.js'),'install','chromium','--only-shell']);
  await command('syntax',[npm,'run','check']);await command('unit-security',[npm,'test']);await command('browser-e2e',[npm,'run','test:browser']);await command('adversarial',[npm,'run','test:adversarial']);
  await command('sample-benchmark',[npm,'run','journey','--','--fixture','checkout','--reference']);
  await command('historical-benchmark',[npm,'run','benchmark:historical']);
  const {createApp}=await import(pathToFileURL(path.join(dir,'src','server.js')).href);const app=await createApp();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));try{const response=await fetch(`http://127.0.0.1:${app.server.address().port}/api/config`);checks.push({label:'start-http',pass:response.ok});if(!response.ok)throw new Error('Clean HTTP smoke failed');}finally{await app.close();}
  await json(path.join(ROOT,'benchmarks','clean-room-results.json'),{at:new Date().toISOString(),pass:checks.every(c=>c.pass),directory:path.relative(ROOT,dir),freshDependencies:true,freshBrowserBinaries:true,credentials:false,checks});
  console.log('Clean-room install, checks, browser tests, start, sample and historical replay passed.');
}catch(error){await json(path.join(ROOT,'benchmarks','clean-room-results.json'),{at:new Date().toISOString(),pass:false,directory:path.relative(ROOT,dir),checks,error:error.message.slice(-3000)});throw error;}
