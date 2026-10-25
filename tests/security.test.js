import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { contained } from '../src/files.js';
import { allowedSource,applyPlan } from '../src/repair.js';
import { createApp } from '../src/server.js';
import { validateProjectFiles } from '../src/project.js';

test('Project imports reject hidden paths, duplicate files and embedded credentials before staging',()=>{
 const index={path:'index.html',content:'<!doctype html><html><body></body></html>'};
 for(const extra of [{path:'../app.js',content:''},{path:'.env.js',content:''},{path:'src/CON.js',content:''},{path:'INDEX.html',content:''},{path:'app.js',content:'Bearer '+'x'.repeat(30)}])assert.throws(()=>validateProjectFiles([index,extra]));
 assert.ok(validateProjectFiles([index,{path:'src/app.js',content:'export const ready=true;'}])>0);
});
import { fixtureServer } from '../src/static.js';
import { digest,Journey } from '../src/schema.js';
import { journeyFor } from '../src/catalog.js';
import { temp,cleanup } from './helpers.js';

test('Path traversal, Windows drive/ADS and alternate separators are rejected',async()=>{const dir=await temp();try{for(const candidate of ['../secret','a/../../secret','C:/Windows/win.ini','C:\\Windows\\win.ini','index.html:secret','a\\..\\secret','/etc/passwd','a//b','./app.js','a/./b','\0','a/..'])await assert.rejects(contained(dir,candidate),/Unsafe|escapes/);}finally{await cleanup(dir);}});
test('Sensitive and infrastructure paths are not editable',()=>{for(const file of ['.env','.git/config','src/.secret.js','package.json','package-lock.json','scripts/deploy.js','tests/oracle.js','node_modules/a.js','next.config.js','credentials/key.js'])assert.equal(allowedSource(file),false,file);for(const file of ['src/Dialog.tsx','index.html','style.css'])assert.equal(allowedSource(file),true);});
test('Model cannot add an unlocalized file or a no-op',async()=>{const dir=await temp();try{const source='const x = 1;';await fs.writeFile(path.join(dir,'app.js'),source);const plan={root_cause:'x',repair_strategy:'x',edits:[{path:'app.js',sha256:digest(source),before:source,after:source}],expected_accessibility_effect:'x',functional_risks:[],verification_requirements:['replay']};await assert.rejects(applyPlan(dir,plan,[]),/allowlist/);await assert.rejects(applyPlan(dir,plan,['app.js']),/No-op/);}finally{await cleanup(dir);}});
test('Journey schemas bound actions, data and navigation paths',()=>{const j=journeyFor('account');for(const modified of [{...j,path:'//evil.example/'},{...j,path:'http://evil.example'},{...j,steps:Array(41).fill(j.steps[0])},{...j,steps:[{title:'Flood',action:{kind:'seek',selector:'#action',maxTabs:999999}}]},{...j,steps:[{title:'Inject',action:{kind:'type',text:'x'.repeat(501)}}]}])assert.throws(()=>Journey.parse(modified));});
test('Public service rejects a short judge token and, without one, blocks everything but the live runner',async()=>{const dir=await temp();try{await assert.rejects(createApp({artifactRoot:dir,publicMode:true,token:'short'}),/DEMO_TOKEN/);
  const app=await createApp({artifactRoot:dir,publicMode:true,token:''});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  try{const res=await fetch(`http://127.0.0.1:${app.server.address().port}/api/runs`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(res.status,403);}finally{await app.close();}}finally{await cleanup(dir);}});
test('Static application server excludes hidden files and serves selected JSON assets',async()=>{const dir=await temp();let server;try{await fs.writeFile(path.join(dir,'.env'),'SAMPLE_SECRET=not-real');await fs.writeFile(path.join(dir,'data.json'),'{"items":[]}');server=await fixtureServer(dir);assert.equal((await fetch(server.origin+'/.env')).status,404);assert.equal((await fetch(server.origin+'/data.json')).status,200);}finally{if(server)await server.close();await cleanup(dir);}});
test('API rejects cross-origin writes, arbitrary repositories, traversal and remote Host',async()=>{const dir=await temp(),app=await createApp({artifactRoot:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${app.server.address().port}`;try{
  assert.equal((await fetch(origin+'/api/runs',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(origin+'/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fixture:'checkout',mode:'reference',repo:'https://evil.example/repo'})})).status,400);
  const hostileHostStatus=await new Promise((resolve,reject)=>{const req=http.get(origin+'/api/config',{headers:{Host:'evil.example'}},response=>{response.resume();resolve(response.statusCode);});req.on('error',reject);});
  assert.equal(hostileHostStatus,403);
  assert.equal((await fetch(origin+'/%2e%2e%5c.env')).status,404);
  assert.equal((await fetch(origin+'/api/runs',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})).status,415);
  assert.equal((await fetch(origin+'/api/config')).status,200);
  const config=await(await fetch(origin+'/api/config')).text();assert.ok(!config.includes('NEBIUS_API_KEY'));assert.ok(!config.includes('DEMO_TOKEN'));
}finally{await app.close();await cleanup(dir);}});
test('Public API authentication fails closed before parsing a run',async()=>{const dir=await temp(),app=await createApp({artifactRoot:dir,publicMode:true,token:'a'.repeat(32)});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));try{const origin=`http://127.0.0.1:${app.server.address().port}`;assert.equal((await fetch(origin+'/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);assert.equal((await fetch(origin+'/api/runs',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer wrong'},body:'{}'})).status,401);}finally{await app.close();await cleanup(dir);}});
