import fs from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { contained } from './files.js';
export async function proofArchive(root, manifest) {
  const chunks=[];let total=0;
  for(const name of [...Object.keys(manifest.files),'manifest.json']) {
    if(Buffer.byteLength(name)>99) throw new Error('Archive path too long');
    const data=await fs.readFile(await contained(root,name)); total+=data.length;
    if(total>40_000_000)throw new Error('Archive size limit');
    const header=Buffer.alloc(512);header.write(name);header.write('0000644\0',100);header.write('0000000\0',108);header.write('0000000\0',116);header.write(data.length.toString(8).padStart(11,'0')+'\0',124);header.write('00000000000\0',136);header.fill(32,148,156);header.write('0',156);header.write('ustar\0',257);header.write('00',263);
    const sum=header.reduce((a,b)=>a+b,0);header.write(sum.toString(8).padStart(6,'0')+'\0 ',148);
    chunks.push(header,data,Buffer.alloc((512-data.length%512)%512));
  }
  chunks.push(Buffer.alloc(1024));return gzipSync(Buffer.concat(chunks));
}
