import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ROOT,fixtures } from './catalog.js';
import { runRepair } from './engine.js';
import { serveFile } from './static.js';
import { readJson } from './files.js';
import { proofArchive } from './archive.js';
import { verifyProof } from './proof.js';

const Request=z.object({fixture:z.enum(fixtures.map(f=>f.id)),mode:z.enum(['reference','nebius'])}).strict();
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
export async function createApp({artifactRoot=path.join(ROOT,'artifacts','runs'),publicMode=process.env.PUBLIC_DEMO==='true',token=process.env.DEMO_TOKEN||''}={}) {
  if(publicMode && token.length<24)throw new Error('PUBLIC_DEMO requires a DEMO_TOKEN of at least 24 characters');
  await fs.mkdir(artifactRoot,{recursive:true});
  const runs=new Map();let active=false,closing=false,lastPublicStart=0;
  for(const entry of await fs.readdir(artifactRoot,{withFileTypes:true})) {
    if(entry.isDirectory() && /^[a-z0-9-]{1,80}$/.test(entry.name)) {
      try {const r=await readJson(path.join(artifactRoot,entry.name,'run.json'));if(!r.completedAt){r.state='INCONCLUSIVE';r.verification={verdict:'INCONCLUSIVE',reasons:['Server restarted before completion']};}runs.set(r.id,r);}
      catch{ /* Non-run directories are not API-visible. */ }
    }
  }
  const server=http.createServer(async(req,res)=>{
    try {
      const host=req.headers.host;
      if(!host || /[\s/@\\]/.test(host))return send(res,400,{error:'Invalid Host'});
      if(!publicMode && !/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host))return send(res,403,{error:'Local Host required'});
      const url=new URL(req.url,'http://'+host),pathname=decodeURIComponent(url.pathname);
      if(req.method==='POST') {
        if(closing)return send(res,503,{error:'Server shutting down'});
        if(req.headers.origin && req.headers.origin!==`http://${host}` && req.headers.origin!==`https://${host}`)return send(res,403,{error:'Cross-origin writes blocked'});
        if(publicMode){const provided=Buffer.from(req.headers.authorization?.replace(/^Bearer /,'')||''),expected=Buffer.from(token);if(provided.length!==expected.length || !timingSafeEqual(provided,expected))return send(res,401,{error:'Judge token required'});}
        if(pathname!=='/api/runs')return send(res,404,{error:'Not found'});
        if(active)return send(res,429,{error:'A browser run is already active'});
        if(runs.size>=60)return send(res,429,{error:'Run storage limit reached; archive old local runs before continuing'});
        if(publicMode && Date.now()-lastPublicStart<60000)return send(res,429,{error:'Public run rate limit'});
        if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required'});
        let body='',bytes=0;
        for await(const chunk of req){bytes+=chunk.length;if(bytes>4096)return send(res,413,{error:'Request too large'});body+=chunk.toString('utf8');}
        const input=Request.parse(JSON.parse(body));
        const id=crypto.randomUUID();runs.set(id,{id,state:'CREATED',events:[],fixture:input.fixture,mode:input.mode});active=true;lastPublicStart=Date.now();
        send(res,202,{id});
        void runRepair({...input,id,artifactRoot,onUpdate:r=>runs.set(id,structuredClone(r))}).then(r=>runs.set(id,r)).catch(()=>{runs.set(id,{id,state:'INCONCLUSIVE',fatal:true,completedAt:new Date().toISOString(),verification:{verdict:'INCONCLUSIVE',reasons:['Run failed before initialization']}});}).finally(()=>{active=false;});
        return;
      }
      if(req.method!=='GET' && req.method!=='HEAD')return send(res,405,{error:'Method not allowed'});
      if(pathname==='/api/config')return send(res,200,{fixtures,publicMode,liveConfigured:!!process.env.NEBIUS_API_KEY && process.env.LIVE_NEBIUS_TESTS==='true' && process.env.NEBIUS_SPONSOR_CREDITS_CONFIRMED==='true',model:process.env.NEBIUS_MODEL||null,active});
      if(pathname==='/api/runs')return send(res,200,[...runs.values()].reverse().slice(0,30).map(r=>({id:r.id,fixture:r.fixture,mode:r.mode,state:r.state,verdict:r.verification?.verdict,elapsedMs:r.elapsedMs})));
      if(pathname==='/api/benchmark'){try{return send(res,200,await readJson(path.join(ROOT,'benchmarks','results.json')));}catch{return send(res,200,{status:'NOT_TESTED',note:'Run npm run benchmark to measure results'});}}
      const match=pathname.match(/^\/api\/runs\/([a-z0-9-]{1,80})(?:\/(.*))?$/);
      if(match){const run=runs.get(match[1]);if(!run)return send(res,404,{error:'Unknown run'});const dir=path.join(artifactRoot,run.id);
        if(!match[2])return send(res,200,run);
        if(match[2]==='proof'){
          if(!run.completedAt || !run.manifest)return send(res,409,{error:'Proof not finalized'});
          if(!(await verifyProof(dir)).pass)return send(res,409,{error:'Artifact integrity check failed'});
          const archive=await proofArchive(dir,run.manifest);res.writeHead(200,{'Content-Type':'application/gzip','Content-Disposition':`attachment; filename="tabstitch-${run.id}.tar.gz"`,'X-Content-Type-Options':'nosniff'});res.end(archive);return;
        }
        if(match[2].startsWith('artifacts/')) {
          const file=match[2].slice(10);
          if(!run.manifest?.files[file] && !['manifest.json'].includes(file))return send(res,404,{error:'Artifact not finalized'});
          return await serveFile(res,dir,file,{attachment:!file.endsWith('.png')});
        }
      }
      if(pathname.startsWith('/api/'))return send(res,404,{error:'Not found'});
      const name=pathname==='/'?'index.html':pathname.slice(1);
      return await serveFile(res,path.join(ROOT,'public'),name);
    }catch(error){if(!res.headersSent)send(res,error instanceof z.ZodError || error instanceof SyntaxError || error instanceof URIError?400:500,{error:'Invalid request or unavailable resource'});else res.end();}
  });
  server.requestTimeout=10000;server.headersTimeout=10000;
  return {server,runs,close:async()=>{closing=true;await new Promise(resolve=>server.close(resolve));const deadline=Date.now()+180000;while(active && Date.now()<deadline)await new Promise(r=>setTimeout(r,100));}};
}
if(process.argv[1] && fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) {
  const app=await createApp();const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||4317);
  if(process.env.PUBLIC_DEMO!=='true' && !['127.0.0.1','localhost','::1'].includes(host))throw new Error('External binding requires PUBLIC_DEMO=true and authentication');
  app.server.listen(port,host,()=>console.log(`Tabstitch workbench: http://${host}:${port}`));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void app.close().then(()=>process.exit(0)));
}
