import path from 'node:path';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { ROOT } from '../src/catalog.js';
import { hashTree,json } from '../src/files.js';
import { digest } from '../src/schema.js';
import { proofArchive } from '../src/archive.js';
import { verifyProof } from '../src/proof.js';
const revision=spawnSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8',windowsHide:true}).stdout?.trim()||'uncommitted';
const out=path.join(ROOT,'artifacts','releases'),source=path.join(out,'source-'+randomUUID());await fs.mkdir(source,{recursive:true});
const tracked=spawnSync('git',['ls-files','-z'],{cwd:ROOT,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
if(tracked.status!==0)throw new Error('Cannot list tracked release files');
for(const file of tracked.stdout.split('\0').filter(Boolean)){
 const target=path.join(source,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(ROOT,file),target);
}
await json(path.join(source,'release.json'),{tool:'Tabstitch',sourceRevision:revision,createdAt:new Date().toISOString(),liveInference:'NOT_RUN_DURING_PACKAGING',scope:'Source archive and recorded runs; see README.md',credentialsIncluded:false});
const files=await hashTree(source),manifest={version:1,algorithm:'sha256',files,rootHash:digest(files)};await json(path.join(source,'manifest.json'),manifest);
if(!(await verifyProof(source)).pass)throw new Error('Release source integrity failed');
const archive=await proofArchive(source,manifest),name=`tabstitch-local-${revision.slice(0,8)}.tar.gz`;await fs.writeFile(path.join(out,name),archive);await fs.writeFile(path.join(out,name+'.sha256'),digest(archive)+'  '+name+'\n');
console.log(JSON.stringify({archive:path.relative(ROOT,path.join(out,name)),bytes:archive.length,sha256:digest(archive),files:Object.keys(files).length},null,2));
