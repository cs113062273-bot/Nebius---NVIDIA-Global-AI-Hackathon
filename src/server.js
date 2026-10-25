import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { Journey,digest } from './schema.js';
import { ROOT,fixtures,journeyFor,fixturePath } from './catalog.js';
import { runRepair } from './engine.js';
import { serveFile, fixtureServer } from './static.js';
import { readJson, listFiles, contained,hashTree } from './files.js';
import { proofArchive } from './archive.js';
import { verifyProof } from './proof.js';
import { ProjectRequest, stageProject, validateProjectFiles, fileBytes } from './project.js';
import { liveCases, loadCase, humanPatch, LiveLedger, spend, liveLimits, liveConfigured, LIVE_SCOPE, LIVE_MODELS, WORST_RUN_USD } from './live.js';

const Request=z.object({fixture:z.enum(fixtures.map(f=>f.id)),mode:z.enum(['reference','nebius','recorded'])}).strict();
// Guards join the confirmed contract only when present, so earlier confirmations keep their hash.
const taskDigest=t=>digest(t.guards?.length?{journey:t.journey,functionalJourney:t.functionalJourney,guards:t.guards}:{journey:t.journey,functionalJourney:t.functionalJourney});
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
export async function createApp({artifactRoot=path.join(ROOT,'artifacts','runs'),publicMode=process.env.PUBLIC_DEMO==='true',token=process.env.DEMO_TOKEN||''}={}) {
  // Without a judge token a public host exposes only the budget-capped live runner and read-only evidence.
  if(publicMode && token && token.length<24)throw new Error('DEMO_TOKEN must be at least 24 characters');
  await fs.mkdir(artifactRoot,{recursive:true});
  const runs=new Map();let active=false,closing=false,lastPublicStart=0;
  const previews=[];
  const confirmations=new Map();
  const ledger=new LiveLedger({dir:path.join(artifactRoot,'..','inference')}),visitors=new Map(),limits=liveLimits();
  const live={enabled:false,reason:'Live repair is not configured on this host',active:null};
  if(liveConfigured()){
    if(publicMode&&!ledger.remote())live.reason='Live repair needs a persistent budget ledger on a public host';
    else try{await ledger.pull();Object.assign(live,{enabled:true,reason:null});}catch(error){live.reason='Budget ledger unavailable: '+error.message.slice(0,120);}
  }
  const visitor=req=>String(req.headers['x-forwarded-for']||'').split(',')[0].trim()||req.socket.remoteAddress||'unknown';
  async function startLive(req,res){
    if(!live.enabled)return send(res,503,{error:live.reason});
    if(active)return send(res,429,{error:'Another repair is running. Watch it, or try again in a minute.',active:live.active});
    const chunks=[];let bytes=0;for await(const c of req){bytes+=c.length;if(bytes>2048)return send(res,413,{error:'Request too large'});chunks.push(c);}
    const input=z.object({case:z.string().regex(/^[a-z0-9-]{1,80}$/)}).strict().parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    const who=visitor(req),last=visitors.get(who)||0;
    if(Date.now()-last<limits.perVisitorMs)return send(res,429,{error:`One live repair per visitor every ${Math.round(limits.perVisitorMs/60000)} minutes. Recorded runs stay available.`});
    let c;try{c=await loadCase(input.case);}catch{return send(res,404,{error:'Unknown or unscreened case'});}
    if(active)return send(res,429,{error:'Another repair is running.',active:live.active});
    active=true;
    let started=false;
    try{
      const book=await ledger.pull(),s=spend(book);
      if(s.totalUsd+WORST_RUN_USD>limits.totalUsd){live.enabled=false;live.reason='The live budget for judging is used up. Recorded runs remain available.';return send(res,429,{error:live.reason});}
      if(s.todayUsd+WORST_RUN_USD>limits.dailyUsd)return send(res,429,{error:"Today's live budget is used. Recorded runs remain available; live repair resumes tomorrow (UTC)."});
      // The client refuses any call whose worst-case reservation would push this run past WORST_RUN_USD.
      const reserved=book.entries.filter(e=>e.budgetScope===LIVE_SCOPE).reduce((sum,e)=>sum+Number(e.reservedCreditUsd||0),0);
      Object.assign(process.env,{NEBIUS_BUDGET_SCOPE:LIVE_SCOPE,NEBIUS_MAX_CREDIT_USD:String(reserved+WORST_RUN_USD),NEBIUS_MAX_CALLS:String(book.calls+3),NEBIUS_MAX_TOTAL_TOKENS:String(book.reservedTokens+300000),NEBIUS_MAX_OUTPUT_TOKENS:'10000'});
      const id=crypto.randomUUID();visitors.set(who,Date.now());live.active={id,case:input.case,startedAt:new Date().toISOString()};
      runs.set(id,{id,state:'CREATED',events:[],fixture:'custom-project',mode:'nebius',source:{live:true,case:input.case}});lastPublicStart=Date.now();started=true;
      send(res,202,{id});
      void runRepair({id,artifactRoot,fixture:'custom-project',mode:'nebius',sourceRoot:c.original,journey:c.journey,functionalJourney:c.functionalJourney,guards:c.guards,maxAttempts:3,freshInference:true,models:LIVE_MODELS,
        sourceMetadata:{kind:'source',live:true,case:input.case,name:c.meta.title,originalRoot:c.original,scope:`Live public run. Real upstream bug (${c.meta.issue}) at ${c.meta.buggyCommit}; blind to the maintainers' fix ${c.meta.fixCommit}. Super first, Ultra after a rejection.`},
        onUpdate:r=>runs.set(id,structuredClone(r))}).then(r=>runs.set(id,r)).catch(()=>{runs.set(id,{id,state:'INCONCLUSIVE',fatal:true,source:{live:true,case:input.case},completedAt:new Date().toISOString(),verification:{verdict:'INCONCLUSIVE',reasons:['Run failed before initialization']}});})
        .finally(async()=>{try{await ledger.push();}catch(error){live.enabled=false;live.reason='Budget ledger could not be saved; live repair paused: '+error.message.slice(0,120);}live.active=null;active=false;});
    }catch(error){live.enabled=false;live.reason='Budget ledger unavailable: '+error.message.slice(0,120);return send(res,503,{error:live.reason});}
    finally{if(!started)active=false;}
  }
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
        if(pathname==='/api/live/runs'){if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required'});return await startLive(req,res);}
        if(publicMode&&!token)return send(res,403,{error:'This public host only runs the budget-capped live repair'});
        if(publicMode){const provided=Buffer.from(req.headers.authorization?.replace(/^Bearer /,'')||''),expected=Buffer.from(token);if(provided.length!==expected.length || !timingSafeEqual(provided,expected))return send(res,401,{error:'Judge token required'});}
        if(pathname==='/api/project-task'){
          if(publicMode)return send(res,403,{error:'Task capture is local-only'});
          const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>100000)return send(res,413,{error:'Task too large'});chunks.push(chunk);}
          const task=z.object({journey:Journey,functionalJourney:Journey,guards:z.array(Journey).max(6).optional()}).strict().parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          if(task.journey.profile!=='keyboard'||task.functionalJourney.profile!=='pointer')return send(res,400,{error:'Capture a keyboard journey and an independent pointer path.'});
          const token=crypto.randomUUID(),hash=taskDigest(task);if(confirmations.size>100)confirmations.delete(confirmations.keys().next().value);confirmations.set(token,hash);return send(res,200,{...task,token,hash});
        }
        const repeat=pathname.match(/^\/api\/runs\/([a-z0-9-]{1,80})\/repeat$/);
        if(repeat){
          if(publicMode)return send(res,403,{error:'Custom repeats are local-only'});
          if(active)return send(res,429,{error:'A browser run is already active'});
          const chunks=[];let bytes=0;for await(const c of req){bytes+=c.length;if(bytes>4096)return send(res,413,{error:'Request too large'});chunks.push(c);}
          const input=z.object({attempt:z.number().int().min(1).max(3),inference:z.boolean()}).strict().parse(JSON.parse(Buffer.concat(chunks).toString('utf8'))),old=runs.get(repeat[1]),a=old?.attempts?.find(a=>a.attempt===input.attempt);
          if(!old?.completedAt||old.fixture!=='custom-project'||!a||!input.inference&&!a.diff)return send(res,400,{error:'Select a completed custom-project attempt; browser rechecks require an applied patch.'});
          if(!(await verifyProof(path.join(artifactRoot,old.id))).pass)return send(res,409,{error:'Prior proof integrity failed'});
          const original=old.source?.originalRoot||path.join(artifactRoot,'imports',old.id,'original');
          if(digest(await hashTree(original))!==digest(old.sourceHashes))return send(res,409,{error:'Original snapshot changed; import it again'});
          if(input.inference&&!(process.env.NEBIUS_API_KEY&&process.env.LIVE_NEBIUS_TESTS==='true'&&process.env.NEBIUS_SPONSOR_CREDITS_CONFIRMED==='true'))return send(res,409,{error:'Live inference disabled'});
          const id=crypto.randomUUID(),args={id,fixture:'custom-project',mode:input.inference?'nebius':'reference',sourceRoot:original,referenceRoot:path.join(artifactRoot,old.id,`candidate-${input.attempt}`),sourceMetadata:{...old.source,originalRoot:original,reusedFrom:old.id,reusedAttempt:input.attempt,execution:input.inference?'new-inference':'fresh-browser-recheck'},journey:old.journey,functionalJourney:old.functionalJourney,guards:old.guards||[],maxAttempts:3,freshInference:input.inference};
          active=true;runs.set(id,{id,state:'CREATED',events:[]});send(res,202,{id});void runRepair({...args,artifactRoot,onUpdate:r=>runs.set(id,structuredClone(r))}).then(r=>runs.set(id,r)).catch(()=>{runs.set(id,{id,state:'INCONCLUSIVE',fatal:true,completedAt:new Date().toISOString(),verification:{verdict:'INCONCLUSIVE',reasons:['Repeat failed before initialization']}});}).finally(()=>{active=false;});return;
        }
        if(pathname==='/api/project-preview'){
          if(publicMode)return send(res,403,{error:'Recording is local-only'});
          const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>24000000)return send(res,413,{error:'Preview too large'});chunks.push(chunk);}
          const input=z.object({files:ProjectRequest.shape.files}).strict().parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));validateProjectFiles(input.files);
          while(previews.length>=3){const old=previews.shift();clearTimeout(old.timer);await old.server.close();}
          const id=crypto.randomUUID(),root=path.join(artifactRoot,'previews',id);await fs.mkdir(root,{recursive:true});
          for(const f of input.files){const dest=await contained(root,f.path,{existing:false});await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,fileBytes(f));}
          const recorder=(await fs.readFile(path.join(ROOT,'public','recorder.js'),'utf8')).replace("new URL(script.src).searchParams.get('token')",JSON.stringify(id));
          const preview=await fixtureServer(root,{recorder}),entry={server:preview,timer:null};entry.timer=setTimeout(()=>{void preview.close();const i=previews.indexOf(entry);if(i>=0)previews.splice(i,1);},1800000);entry.timer.unref();previews.push(entry);
          return send(res,200,{id,origin:preview.origin});
        }
        const projectRun=pathname==='/api/project-runs';
        if(projectRun&&publicMode)return send(res,403,{error:'Project import is available only in the local workbench'});
        if(pathname!=='/api/runs'&&!projectRun)return send(res,404,{error:'Not found'});
        if(active)return send(res,429,{error:'A browser run is already active'});
        // Public hosts keep a tight bound; a local workbench accumulates evidence across experiments.
        if(runs.size>=(publicMode?60:500))return send(res,429,{error:'Run storage limit reached; archive old local runs before continuing'});
        if(publicMode && Date.now()-lastPublicStart<60000)return send(res,429,{error:'Public run rate limit'});
        if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required'});
        const chunks=[];let bytes=0;
        for await(const chunk of req){bytes+=chunk.length;if(bytes>(projectRun?48000000:4096))return send(res,413,{error:'Request too large'});chunks.push(chunk);}
        const body=Buffer.concat(chunks).toString('utf8');
        const id=crypto.randomUUID();let input;
        if(projectRun){
          const raw=ProjectRequest.parse(JSON.parse(body));
          if(raw.mode==='nebius'&&confirmations.get(raw.confirmation)!==taskDigest(raw))return send(res,409,{error:'Confirm and freeze both tasks before requesting inference.'});
          if(raw.mode==='nebius'&&!(process.env.NEBIUS_API_KEY&&process.env.LIVE_NEBIUS_TESTS==='true'&&process.env.NEBIUS_SPONSOR_CREDITS_CONFIRMED==='true'))return send(res,409,{error:'Live inference is disabled. Verify an existing patch or configure an authorized budget first.'});
          try{input=await stageProject(raw,artifactRoot,id);}catch(error){return send(res,400,{error:error instanceof z.ZodError?'The project tasks do not match the supported journey format':error.message});}
        }else input=Request.parse(JSON.parse(body));
        if(active)return send(res,429,{error:'A browser run is already active'});
        runs.set(id,{id,state:'CREATED',events:[],fixture:input.fixture,mode:input.mode});active=true;lastPublicStart=Date.now();
        send(res,202,{id});
        void runRepair({...input,id,artifactRoot,onUpdate:r=>runs.set(id,structuredClone(r))}).then(r=>runs.set(id,r)).catch(()=>{runs.set(id,{id,state:'INCONCLUSIVE',fatal:true,completedAt:new Date().toISOString(),verification:{verdict:'INCONCLUSIVE',reasons:['Run failed before initialization']}});}).finally(()=>{active=false;});
        return;
      }
      if(req.method!=='GET' && req.method!=='HEAD')return send(res,405,{error:'Method not allowed'});
      if(pathname==='/favicon.ico')return await serveFile(res,path.join(ROOT,'public'),'favicon.svg');
      if(pathname==='/api/live'){
        let budget=null;try{const s=spend(JSON.parse(await fs.readFile(ledger.file,'utf8')));budget={...s,totalLimitUsd:limits.totalUsd,dailyLimitUsd:limits.dailyUsd};}catch{/* No ledger yet. */}
        return send(res,200,{enabled:live.enabled,reason:live.reason,active:live.active,budget,models:LIVE_MODELS,cases:await liveCases()});
      }
      const livePatch=pathname.match(/^\/api\/live\/cases\/([a-z0-9-]{1,80})\/human\.patch$/);
      if(livePatch){try{const patch=await humanPatch(livePatch[1]);res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(patch);}catch{send(res,404,{error:'Unknown case'});}return;}
      if(pathname==='/api/config')return send(res,200,{fixtures,publicMode,liveConfigured:!!process.env.NEBIUS_API_KEY && process.env.LIVE_NEBIUS_TESTS==='true' && process.env.NEBIUS_SPONSOR_CREDITS_CONFIRMED==='true',model:process.env.NEBIUS_MODEL||null,active});
      const projectCase=pathname.match(/^\/api\/project-case\/(country-preferences|weekday-booking)$/);
      if(projectCase){
        if(publicMode)return send(res,403,{error:'Source import is local-only'});
        const booking=projectCase[1]==='weekday-booking';
        const root=path.join(ROOT,'benchmarks',booking?'pikaday-booking':'native-form-markup'),source=path.join(root,'original'),files=[];
        for(const file of await listFiles(source))files.push({path:file,content:await fs.readFile(await contained(source,file),'utf8'),encoding:'utf8'});
        const tasks=await readJson(path.join(root,'tasks.json'));
        return send(res,200,{name:booking?'Pikaday booking: keyboard must skip closed weekends':'GOV.UK autocomplete: an empty or unlisted country must not submit stale data',notice:booking?'Pinned Pikaday and author-created weekday booking form loaded. ArrowRight from Friday selects the closed Saturday. Review the keyboard task and independent available-date selection, then confirm them. Loading makes no model call.':'Pinned GOV.UK component and author-created delivery form loaded. An unlisted shipping country keeps gb, and clearing billing then pressing Enter inside the field keeps de. Options are pretty-printed. Review the keyboard task, the independent pointer path and three regression guards, then confirm them. Loading makes no model call.',files,journey:tasks.journey,functionalJourney:tasks.functionalJourney,guards:tasks.guards||[]});
      }
      const template=pathname.match(/^\/api\/task-template\/([a-z0-9-]+)$/);
      if(template){if(!fixtures.some(f=>f.id===template[1]))return send(res,404,{error:'Unknown task template'});return send(res,200,{journey:journeyFor(template[1]),functionalJourney:journeyFor(template[1],'pointer')});}
      const example=pathname.match(/^\/api\/project-example\/([a-z0-9-]+)$/);
      if(example){
        if(publicMode)return send(res,403,{error:'Source import is local-only'});
        if(!fixtures.some(f=>f.id===example[1]))return send(res,404,{error:'Unknown project example'});
        const sources=async version=>{const root=fixturePath(example[1],version),files=[];for(const file of await listFiles(root)){if(!/\.(html|css|js|svg)$/.test(file))continue;files.push({path:file,content:await fs.readFile(await contained(root,file),'utf8')});}return files;};
        return send(res,200,{files:await sources('broken'),editedFiles:await sources('reference')});
      }
      if(pathname==='/api/runs')return send(res,200,[...runs.values()].reverse().slice(0,30).map(r=>({id:r.id,fixture:r.fixture,mode:r.mode,state:r.state,verdict:r.verification?.verdict,elapsedMs:r.elapsedMs})));
      if(pathname==='/api/benchmark'){try{return send(res,200,await readJson(path.join(ROOT,'benchmarks','results.json')));}catch{return send(res,200,{status:'NOT_TESTED',note:'Run npm run benchmark to measure results'});}}
      // Read-only, explicitly allowlisted provenance records; never rewrite historical proof files.
      const evidenceFiles={
        'recovery-commitment':'component-recovery/commitment.json',
        'css-commitment':'component-css-followup/commitment.json',
        'recovery-audit':'component-recovery/acceptance.json',
        'followup-report':'component-css-followup/result.json',
        'final-validation':'component-css-followup/final-validation.json',
        'upstream-patch':'component-recovery/upstream-human.patch',
        'upstream-control':'component-recovery/upstream-control.json'
      };
      if(pathname.startsWith('/api/evidence/micromodal/')){
        const file=evidenceFiles[pathname.slice('/api/evidence/micromodal/'.length)];
        if(!file)return send(res,404,{error:'Unknown evidence record'});
        return await serveFile(res,path.join(ROOT,'benchmarks'),file,{attachment:true});
      }
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
          // A live run streams its captures, plans and diffs as they are written; everything else waits for the manifest.
          const streaming=run.source?.live&&!run.manifest&&/^(?:(?:before|functional-before|after-\d|functional-after-\d|guard-(?:before|after)-[\d-]+)\/[a-z0-9-]+\.png|diff-\d\.patch|plan-\d\.json)$/.test(file);
          if(!streaming&&!run.manifest?.files[file] && !['manifest.json'].includes(file))return send(res,404,{error:'Artifact not finalized'});
          return await serveFile(res,dir,file,{attachment:!file.endsWith('.png')});
        }
      }
      if(pathname.startsWith('/api/'))return send(res,404,{error:'Not found'});
      const name=pathname==='/'?(process.env.TABSTITCH_LANDING||'index.html'):pathname.slice(1);
      return await serveFile(res,path.join(ROOT,'public'),name,{fixture:name.startsWith('previews/')});
    }catch(error){if(!res.headersSent)send(res,error instanceof z.ZodError || error instanceof SyntaxError || error instanceof URIError?400:500,{error:'Invalid request or unavailable resource'});else res.end();}
  });
  server.requestTimeout=10000;server.headersTimeout=10000;
  return {server,runs,close:async()=>{closing=true;for(const p of previews){clearTimeout(p.timer);await p.server.close();}await new Promise(resolve=>server.close(resolve));const deadline=Date.now()+180000;while(active && Date.now()<deadline)await new Promise(r=>setTimeout(r,100));}};
}
if(process.argv[1] && fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) {
  const app=await createApp();const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||4317);
  if(process.env.PUBLIC_DEMO!=='true' && !['127.0.0.1','localhost','::1'].includes(host))throw new Error('External binding requires PUBLIC_DEMO=true and authentication');
  app.server.listen(port,host,()=>console.log(`Tabstitch workbench: http://${host}:${port}`));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void app.close().then(()=>process.exit(0)));
}
