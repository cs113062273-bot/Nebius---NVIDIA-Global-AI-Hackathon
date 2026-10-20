import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
let count=0;
for(const dir of ['src','scripts','tests','public'])for(const file of await fs.readdir(dir))if(file.endsWith('.js')){const result=spawnSync(process.execPath,['--check',path.join(dir,file)],{encoding:'utf8'});if(result.status!==0){console.error(result.stderr);process.exit(1);}count++;}
console.log(`Syntax checked ${count} JavaScript modules.`);
