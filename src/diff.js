import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { digest } from './schema.js';

// Git owns hunk ranges, context, quoting and the no-final-newline markers.
// Independently apply the exported bytes and compare them with the candidate.
export async function checkedDiff(changes) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'tabstitch-diff-'));
  try {
    for(const dir of ['a','b','check'])await fs.mkdir(path.join(root,dir));
    for(const c of changes)for(const [dir,value]of [['a',c.before],['b',c.after],['check',c.before]]) {
      if(value===null)continue;
      const file=path.join(root,dir,c.path);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,value);
    }
    const config=['-c','core.autocrlf=false','-c','core.quotePath=false','-c','core.safecrlf=false'];
    const result=spawnSync('git',[...config,'diff','--no-index','--no-ext-diff','--no-renames','--binary','--unified=3','--','a','b'],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:16000000});
    if(result.status!==1)throw new Error('Unable to generate a nonempty Git source diff');
    let body=false;
    const patch=result.stdout.split('\n').map(line=>{
      if(line.startsWith('diff --git ')){body=false;return line.replace(/^(diff --git "?a\/)[ab]\//,'$1').replace(/( "?b\/)[ab]\//,'$1');}
      if(line.startsWith('@@ ')||line==='GIT binary patch')body=true;
      return body?line:line.replace(/^(--- "?a\/)[ab]\//,'$1').replace(/^(\+\+\+ "?b\/)[ab]\//,'$1');
    }).join('\n');
    for(const args of [['apply','--check','--whitespace=nowarn','-'],['apply','--whitespace=nowarn','-']]) {
      const r=spawnSync('git',[...config,...args],{cwd:path.join(root,'check'),input:patch,encoding:'utf8',windowsHide:true,maxBuffer:1000000});
      if(r.status!==0)throw new Error('Exported diff failed git '+args.slice(0,2).join(' ')+': '+r.stderr.slice(0,500));
    }
    for(const c of changes){
      const value=await fs.readFile(path.join(root,'check',c.path)).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
      if(c.after===null?value!==null:value===null||digest(value)!==digest(c.after))throw new Error('Exported diff does not reproduce candidate: '+c.path);
    }
    return {patch,patchValidation:{gitApplyCheck:true,candidateBytesMatch:true,contextLines:3},changed:changes.length,changes:changes.map(c=>({path:c.path,beforeHash:c.before===null?null:digest(c.before),afterHash:c.after===null?null:digest(c.after)}))};
  }finally{await fs.rm(root,{recursive:true,force:true});}
}
