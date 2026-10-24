import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '../src/catalog.js';
import { hashTree, json, listFiles } from '../src/files.js';
import { digest } from '../src/schema.js';

// A self-contained, read-only judge site: recordings, case studies and every published run.
// No backend, secrets or paid runtime. project.html detects the missing API and shows evidence only.
const out=path.join(ROOT,'artifacts','judge-demo');await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
const localOnly=new Set(['workbench.html','app.js','recorder.js']);
for(const entry of await fs.readdir(path.join(ROOT,'public'))){
 if(localOnly.has(entry))continue;
 await fs.cp(path.join(ROOT,'public',entry),path.join(out,entry),{recursive:true});
}
await fs.copyFile(path.join(ROOT,'LICENSE'),path.join(out,'LICENSE'));
await fs.writeFile(path.join(out,'.nojekyll'),'');
// Fail closed if an environment file, credential-like text or a local path enters the public build.
for(const file of await listFiles(out,'',10000)){
 if(/(^|\/)\.env($|\.)/.test(file))throw new Error('Environment file in public build');
 if(!/\.(html|js|json|css|md|txt|patch)$/.test(file))continue;
 const content=await fs.readFile(path.join(out,file),'utf8');
 if(/(?:Bearer\s+[A-Za-z0-9._-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|v1\.[A-Za-z0-9_-]{60,}\.[A-Za-z0-9_-]{30,})/.test(content))throw new Error('Credential-like text in public build: '+file);
 if(/C:[\\/]+Users[\\/]/i.test(content))throw new Error('Local path in public build: '+file);
}
const files=await hashTree(out,['manifest.json'],10000),manifest={version:1,algorithm:'sha256',files,rootHash:digest(files)};
await json(path.join(out,'manifest.json'),manifest);
console.log(JSON.stringify({directory:'artifacts/judge-demo',files:Object.keys(files).length,rootHash:manifest.rootHash,modelCalls:0,requiresBackend:false}));
