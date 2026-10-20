import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
export async function temp() { return fs.mkdtemp(path.join(os.tmpdir(),'tabstitch-test-')); }
export async function cleanup(dir) { const resolved=await fs.realpath(dir);const root=await fs.realpath(os.tmpdir());if(!resolved.startsWith(root+path.sep+'tabstitch-test-'))throw new Error('Refusing cleanup outside test workspace');await fs.rm(resolved,{recursive:true,force:true}); }
export async function copyFixture(source) { const dir=await temp();await fs.cp(source,dir,{recursive:true});return dir; }
