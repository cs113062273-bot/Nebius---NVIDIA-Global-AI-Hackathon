import fs from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {execFileSync} from 'node:child_process';

// Publishes the live runner as a Hugging Face Docker Space that builds the pushed GitHub commit.
// Reads HF_TOKEN (write) from .env, creates the Space and a private ledger dataset if missing,
// stores secrets server-side and never prints them.
const env={...parseEnv(await fs.readFile('.env','utf8')),...process.env};
const token=env.HF_TOKEN;if(!token)throw new Error('Add HF_TOKEN (a Hugging Face write token) to .env');
const hf=async(url,options={})=>{const r=await fetch('https://huggingface.co'+url,{...options,headers:{Authorization:'Bearer '+token,...options.headers}});const text=await r.text();if(!r.ok&&!(options.allow||[]).includes(r.status))throw new Error(`${options.method||'GET'} ${url.replace(/secrets.*/,'secrets')} → HTTP ${r.status}: ${text.slice(0,200)}`);try{return {status:r.status,body:JSON.parse(text)};}catch{return {status:r.status,body:text};}};
const user=(await hf('/api/whoami-v2')).body.name;
const space=env.HF_SPACE||`${user}/tabstitch`,ledger=env.LIVE_LEDGER_REPO||`${user}/tabstitch-ledger`;
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const remote=execFileSync('git',['ls-remote','origin','refs/heads/main'],{encoding:'utf8'}).split(/\s/)[0];
if(remote!==commit)throw new Error(`Push main first: the Space builds GitHub ${remote.slice(0,7)}, local HEAD is ${commit.slice(0,7)}`);

const create=async(type,name,extra)=>{const r=await hf('/api/repos/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,name:name.split('/')[1],organization:name.split('/')[0]===user?undefined:name.split('/')[0],...extra}),allow:[409]});console.log(type,name,r.status===409?'exists':'created');};
await create('space',space,{sdk:'docker',private:false});
await create('dataset',ledger,{private:true});
for(const [key,value] of [['NEBIUS_API_KEY',env.NEBIUS_API_KEY],['HF_TOKEN',token],['LIVE_LEDGER_REPO',ledger]]){
  if(!value)throw new Error(`${key} missing`);
  await hf(`/api/spaces/${space}/secrets`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value})});console.log('secret',key,'set');
}
const files=[['README.md',await fs.readFile('deploy/space/README.md','utf8')],['Dockerfile',(await fs.readFile('deploy/space/Dockerfile','utf8')).replace('__COMMIT__',commit)]];
const lines=[{key:'header',value:{summary:`Build ${commit.slice(0,7)}`}},...files.map(([path,content])=>({key:'file',value:{path,encoding:'base64',content:Buffer.from(content).toString('base64')}}))];
await hf(`/api/spaces/${space}/commit/main`,{method:'POST',headers:{'Content-Type':'application/x-ndjson'},body:lines.map(l=>JSON.stringify(l)).join('\n')});
console.log(JSON.stringify({space:`https://huggingface.co/spaces/${space}`,app:`https://${space.replace('/','-').replace(/[^a-zA-Z0-9-]/g,'-').toLowerCase()}.hf.space/`,commit}));
