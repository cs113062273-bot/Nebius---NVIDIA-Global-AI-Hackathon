import fs from 'node:fs/promises';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { ROOT } from '../src/catalog.js';
import { digest } from '../src/schema.js';
import { json } from '../src/files.js';

const repo='KittyGiraudel/a11y-dialog';
const restore=process.argv.includes('--restore');
const revisions=restore?{before:'a7718bca32ede3c01c93a67da12f45a274011c4c',after:'6367c03a9a6dfd1edffe9f8132142f61ad0ad9c9'}:{before:'1560000b7dbf56453dae80e4919ab595f0ac1883',after:'79151d8c355dd7c7396014c6889c6189700aad97'};
const root=path.join(ROOT,'benchmarks','historical',restore?'a11y-dialog-restore':'a11y-dialog-empty');
const dependencyVersion=restore?'0.8.0':'0.6.0';
const headers={'User-Agent':'Tabstitch-accessibility-research','Accept':'application/vnd.github+json'};
const metadata={repository:`https://github.com/${repo}`,fix:`https://github.com/${repo}/commit/${revisions.after}`,revisions,sourceHashes:{},evaluation:'Nonblind historical reproduction and published human-fix replay, not autonomous repair or holdout.'};
for(const [phase,revision]of Object.entries(revisions)) {
  const response=await fetch(`https://api.github.com/repos/${repo}/git/trees/${revision}?recursive=1`,{headers,signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('GitHub tree HTTP '+response.status);
  const tree=await response.json();const files=tree.tree.filter(f=>f.path.startsWith('src/')&&f.path.endsWith('.ts')&&!f.path.endsWith('.d.ts')).map(f=>f.path);
  files.push('LICENSE');metadata.sourceHashes[phase]={};
  if(files.length>20)throw new Error('Unexpected source tree');
  for(const file of files){const res=await fetch(`https://raw.githubusercontent.com/${repo}/${revision}/${file}`,{headers,signal:AbortSignal.timeout(20000)});if(!res.ok)throw new Error('Source HTTP '+res.status);const source=await res.text();if(source.length>60000)throw new Error('Source size bound');const target=path.join(root,phase,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,source);metadata.sourceHashes[phase][file]=digest(source);
    if(file.endsWith('.ts')){const js=stripTypeScriptTypes(source,{mode:'strip'}).replace(/from (['"])(\.\/[a-zA-Z0-9-]+)\1/g,'from $1$2.js$1').replace("from 'focusable-selectors'","from './focusable-selectors.js'");await fs.writeFile(target.replace(/\.ts$/,'.js'),js);}
  }
  for(const file of ['index.js','LICENSE']) {
    const url=`https://unpkg.com/focusable-selectors@${dependencyVersion}/${file}`;const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Pinned dependency HTTP '+response.status);const source=await response.text();if(source.length>20000)throw new Error('Dependency size bound');metadata.sourceHashes[phase]['focusable-selectors-'+dependencyVersion+'/'+file]=digest(source);
    await fs.mkdir(path.join(root,phase,'upstream-dependency'),{recursive:true});await fs.writeFile(path.join(root,phase,'upstream-dependency',file),source);
    if(file==='index.js')await fs.writeFile(path.join(root,phase,'src','focusable-selectors.js'),source.replace('module.exports =','export default'));
  }
  await fs.writeFile(path.join(root,phase,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Historical dialog regression</title><style>[aria-hidden="true"]{${restore?'opacity:0;pointer-events:none':'display:none'}}body{font:18px system-ui;padding:40px}#dialog{padding:30px;border:2px solid #333}button{font:inherit;padding:12px}:focus{outline:3px solid blue}</style></head><body><main><h1>Read a notice</h1><button id="open" data-a11y-dialog-show="dialog">Read notice</button><div id="dialog" aria-labelledby="title"><h2 id="title">Notice</h2><p>${restore?'A dialog with opacity-based hiding.':'There are no interactive children. Press Escape to close.'}</p>${restore?'<button id="close" data-a11y-dialog-hide>Close notice</button>':''}</div></main><script type="module">import A11yDialog from './src/a11y-dialog.js';new A11yDialog(document.querySelector('#dialog'));window.__ready=true;</script></body></html>`);
}
await json(path.join(root,'provenance.json'),metadata);console.log('Pinned historical source and MIT license fetched. No dependency scripts executed.');
