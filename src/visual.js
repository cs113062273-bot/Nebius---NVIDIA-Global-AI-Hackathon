import fs from 'node:fs/promises';
import { PNG } from 'pngjs';
export async function compareInitialScreenshots(beforeFile, afterFile, maximumChangedRatio = 0.15) {
  const before = PNG.sync.read(await fs.readFile(beforeFile)), after = PNG.sync.read(await fs.readFile(afterFile));
  if(before.width!==after.width || before.height!==after.height)return{pass:false,reason:'Screenshot dimensions changed',maximumChangedRatio};
  let changed=0;
  for(let i=0;i<before.data.length;i+=4)if(Math.max(Math.abs(before.data[i]-after.data[i]),Math.abs(before.data[i+1]-after.data[i+1]),Math.abs(before.data[i+2]-after.data[i+2]))>32)changed++;
  const changedRatio=changed/(before.width*before.height);
  return{pass:changedRatio<=maximumChangedRatio,changedRatio,maximumChangedRatio,width:before.width,height:before.height,scope:'Coarse initial-page pixel change gate. Allows legitimate small accessibility changes. Does not establish visual equivalence at every state.'};
}
