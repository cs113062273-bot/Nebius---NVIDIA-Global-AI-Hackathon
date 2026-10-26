// Live repair viewer. On a live host it starts budget-capped Nemotron runs and streams them;
// on the static judge site it replays the recorded blind run for each real bug.
const $=s=>document.querySelector(s),el=(tag,attrs={},...kids)=>{const n=document.createElement(tag);for(const [k,v]of Object.entries(attrs))if(v!=null)k==='class'?n.className=v:k==='text'?n.textContent=v:n.setAttribute(k,v);n.append(...kids.filter(k=>k!=null));return n;};
const LIVE_URL=document.querySelector('meta[name="tabstitch-live"]')?.content||'';
// Without a live host, a live run is requested by opening an issue; GitHub Actions runs it and replies there.
const REPO='https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon';
const issueUrl=id=>`${REPO}/issues/new?template=live-run.yml&title=${encodeURIComponent('[live run] '+id)}`;
const runLive=id=>el('a',{class:'secondary run-live',href:issueUrl(id),target:'_blank',rel:'noopener',text:'Run it live ↗'});
const MODEL={'nemotron-3-super-120b-a12b':'Nemotron 3 Super','Nemotron-3-Ultra-550b-a55b':'Nemotron 3 Ultra'};
// Repeated blind runs on the current engine: every one is listed, so a lucky run cannot stand alone.
const repeats=c=>{const l=c.frozenRuns||[];if(l.length<2)return null;const ok=l.filter(x=>x.verdict==='VERIFIED_PASS').length;
  return el('p',{class:'case-repeats small'},`Current engine, every blind run: repaired in ${ok} of ${l.length}: `,...l.flatMap((x,i)=>[i?' · ':'',el('a',{href:`./project.html?run=${x.run}${x.passedOn?'&attempt='+x.passedOn:''}#project-result`,text:`run ${i+1} ${x.verdict==='VERIFIED_PASS'?(x.scope==='page'?'✓ page workaround':'✓'):'✗'}`})]));};
// Where the passing patch changed code: the library itself, or only the author-built page around it.
const WHERE={library:' · fixed in the library code',page:' · worked around in the page; library unchanged'};
const modelName=id=>MODEL[String(id||'').split('/').pop()]||String(id||'Nemotron').split('/').pop();
const STAGES=[['reproduce','Reproduce the bug',['PREPARING','BASELINE_RUNNING','FAILURE_CONFIRMED']],['locate','Find the source',['LOCALIZING']],['propose','Nemotron proposes a patch',['PLANNING_REPAIR']],['apply','Apply in an isolated copy',['PATCHING','BUILDING']],['replay','Replay in Chromium',['REPLAYING','VERIFYING']],['verdict','Verdict',['VERIFIED','FAILED','INCONCLUSIVE']]];
let api=false,data=null,open=[],daily=null,gates=null,watching=null,clock=null;

async function getJson(url,options){const r=await fetch(url,options);const body=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(body.error||`HTTP ${r.status}`),{status:r.status,body});return body;}
const artifactUrl=(run,file)=>run.__static?`./evidence/runs/${run.id}/${file}`:`./api/runs/${run.id}/artifacts/${file}`;
const humanPatchUrl=id=>api?`./api/live/cases/${id}/human.patch`:`./realbugs/${id}/human.patch`;

async function boot(){
  // GitHub Pages serves only the static build, so there is no live API to probe there.
  try{if(/.github.io$/.test(location.hostname))throw new Error('static');data=await getJson('./api/live');api=true;}
  catch{try{data=await getJson('./realbugs/index.json');}catch{$('#mode').textContent='OFFLINE';notice('The bug list could not be loaded.');return;}}
  try{open=api&&data.open?data.open:(await getJson('./openbugs/index.json')).cases;}catch{open=[];}
  try{daily=await getJson('./live-runs/index.json');}catch{daily=null;}
  try{gates=await getJson('./gate-stats.json');}catch{gates=null;}
  renderMode();renderDaily();renderStats();renderOpen();renderCases();renderScoreboard();renderGates();
  // ?case=<id> plays that bug's recorded run; &run=<uuid> pins one specific published run of it.
  const params=new URLSearchParams(location.search),wanted=params.get('case'),pin=params.get('run');if(wanted){const c=[...data.cases,...open].find(c=>c.id===wanted);if(c)void showRecorded(c,/^[0-9a-f-]{36}$/.test(pin||'')?pin:null);}
  if(api&&data.active)void watch(data.active.id,data.cases.find(c=>c.id===data.active.case),{live:true});
}
function renderMode(){
  const m=$('#mode');
  if(api&&data.enabled){m.textContent='● LIVE · SPONSOR CREDITS';m.className='mode live';}
  else if(api){m.textContent='RECORDED · LIVE PAUSED';m.className='mode';}
  else{m.textContent='RECORDED RUNS';m.className='mode';}
  const b=data.budget;
  $('#budget').textContent=api&&data.enabled&&b?`Live budget today: US$${Math.max(0,b.dailyLimitUsd-b.todayUsd).toFixed(2)} of ${b.dailyLimitUsd.toFixed(2)} left · total cap US$${b.totalLimitUsd.toFixed(0)}`:api?(data.reason||''):LIVE_URL?'':'Recorded runs made real Nemotron calls when they were captured; viewing makes none. Run it live opens a GitHub issue: Actions makes a fresh Nemotron repair (capped at US$0.50) and replies there with the verdict in about 3 to 10 minutes.';
}
function renderStats(){
  const cases=data.cases,libs=new Set(cases.map(c=>c.repository.replace(/\/+$/,'').toLowerCase())),runs=cases.filter(c=>c.recorded),passed=runs.filter(c=>c.recorded.verdict==='VERIFIED_PASS');
  const items=[[String(cases.length),'real upstream bugs'],[String(libs.size),'libraries'],[`${cases.length}/${cases.length}`,"maintainers' fixes pass the frozen task"],[runs.length?`${passed.length}/${runs.length}`:'—',`repaired blind by Nemotron${passed.some(c=>c.recorded.scope==='page')?` · ${passed.filter(c=>c.recorded.scope==='library').length} in the library code, ${passed.filter(c=>c.recorded.scope==='page').length} by a page workaround`:''}`]];
  $('#stats').replaceChildren(...items.map(([v,l])=>el('div',{},el('dt',{text:v}),el('dd',{text:l}))));
}
// Fresh runs made by GitHub Actions on the date shown (daily during judging), newest first.
function renderDaily(){
  const runs=daily?.runs||[];$('#daily').hidden=!runs.length;if(!runs.length)return;
  $('#daily-note').textContent=daily.note||'';
  $('#daily-list').replaceChildren(...runs.slice(0,6).map(x=>el('article',{class:'daily-run'},
    el('p',{class:'case-lib'},el('span',{class:'mono',text:x.date}),el('span',{class:'tag',text:x.kind==='open'?'still open upstream':'fixed upstream, run blind'}),x.trigger==='issue'?el('a',{class:'tag',href:`${REPO}/issues/${x.issue}`,text:`requested in issue #${x.issue}`}):el('span',{class:'tag',text:'daily scheduled run'})),
    el('h3',{},el('a',{href:`./project.html?run=${x.run}${x.passedOn?'&attempt='+x.passedOn:''}#project-result`,text:`${x.library} · ${x.title}`})),
    el('p',{class:`case-status ${x.verdict==='VERIFIED_PASS'?'ok':'no'}`,text:x.verdict==='VERIFIED_PASS'?`Repaired on attempt ${x.passedOn} · ${modelName(x.models[x.passedOn-1])} · US$${x.costUsd.toFixed(3)}`:`Not repaired · ${x.models.length} attempt${x.models.length>1?'s':''} · US$${x.costUsd.toFixed(3)}`}),
    x.actionsRun?el('p',{class:'small'},el('a',{href:x.actionsRun,text:'GitHub Actions log for this run ↗'})):null)));
}
// Bugs that are still open upstream: no maintainers' fix exists, so the card links the pending one if any.
function renderOpen(){
  const box=$('#open-list');box.replaceChildren();$('#open').hidden=!open.length;
  for(const c of open){
    const r=c.recorded,status=r?(r.verdict==='VERIFIED_PASS'?`Repaired on attempt ${r.passedOn} · ${modelName(r.models[r.passedOn-1])} · browser-verified${WHERE[r.scope]||''}`:`Not repaired (${r.models.length} attempts)`):'Reproduced · no run yet';
    const actions=el('div',{class:'case-actions'});
    if(r){const b=el('button',{class:'primary',type:'button',text:'Watch the repair'});b.onclick=()=>void showRecorded(c);actions.append(b);}
    if(r?.passedOn)actions.append(el('a',{class:'secondary',href:`./openbugs/${c.id}/nemotron.patch`,download:`${c.id}.patch`,text:'Download the patch'}));
    if(!api&&!LIVE_URL)actions.append(runLive(c.id));
    box.append(el('article',{class:'case open',id:`open-${c.id}`},
      el('p',{class:'case-lib'},el('span',{text:c.library}),c.category?el('span',{class:'tag',text:c.category}):null),
      el('h3',{text:c.title}),el('p',{class:'case-sum',text:c.summary}),
      el('p',{class:'case-upstream',text:c.status}),
      ...(c.expectedBehaviour?[el('p',{class:'case-note',text:c.expectedBehaviour})]:[]),
      ...(c.addedAfterReview?[el('p',{class:'case-note added',text:c.addedAfterReview})]:[]),
      // A case that a stricter one replaced after review says so, so the easier task is not read as the last word.
      ...open.filter(o=>o.derivedFrom===c.id).map(o=>el('p',{class:'case-note added'},'Superseded after review by a stricter task: ',el('a',{href:`#open-${o.id}`,text:o.title}),'.')),
      ...(c.replays?.length?[el('ul',{class:'case-replays'},...c.replays.map(x=>el('li',{},el('a',{href:`./project.html?run=${x.run}#project-result`,text:`Replay of run ${x.fromRun.slice(0,8)} attempt ${x.attempt}`}),`: ${x.verdict==='VERIFIED_PASS'?'passes the stricter task':'rejected by the stricter task'} (browser only, no inference)`)))]:[]),
      el('p',{class:'case-src'},el('a',{href:c.issue,text:c.issue.includes('/issues?q=')?'Not reported yet · issues searched ↗':/Found by Tabstitch and reported/.test(c.status||'')?`Reported upstream by Tabstitch · #${c.issue.split('/').pop()} ↗`:'Open issue ↗'}),...(c.pendingHumanFix?[' · ',el('a',{href:c.pendingHumanFix,text:'Pending human fix ↗'}),' · ',el('a',{href:`./openbugs/${c.id}/pending-human.patch`,text:'its diff'})]:[])),
      ...(c.pendingHumanCheck?[el('p',{class:'case-note',text:c.pendingHumanCheck.keyboard==='VERIFIED_PASS'?'The pending human fix also passes this frozen task, so the task is fair. It was fetched only for comparison and never sent to the model.':c.pendingHumanCheck.note})]:[]),
      el('p',{class:`case-status ${r?.verdict==='VERIFIED_PASS'?'ok':r?'no':''}`,text:status}),repeats(c),
      // Human reading of the patch after the browser verdict, only shown for the run it reviewed.
      ...(c.review&&r&&c.review.run===r.run?[el('details',{class:'case-review'},el('summary',{text:`Patch review: ${c.review.verdict}`}),el('p',{text:c.review.summary}),el('ul',{},...c.review.caveats.map(t=>el('li',{text:t}))),el('p',{class:'case-note',text:c.review.reviewer}))]:[]),actions));
  }
}
function renderCases(){
  const list=$('#case-list');list.replaceChildren();
  for(const c of data.cases){
    const r=c.recorded,status=r?(r.verdict==='VERIFIED_PASS'?`Recorded: repaired on attempt ${r.passedOn} · ${modelName(r.models[r.passedOn-1])}${WHERE[r.scope]||''}`:`Recorded: not repaired (${r.models.length} attempts)`):'No recorded run yet';
    const actions=el('div',{class:'case-actions'});
    if(api&&data.enabled){const b=el('button',{class:'primary',type:'button',text:'Repair live with Nemotron'});b.onclick=()=>void startLive(c,b);actions.append(b);}
    else if(LIVE_URL)actions.append(el('a',{class:'primary',href:`${LIVE_URL}/live.html?case=${c.id}`,text:'Repair live ↗'}));
    if(r){const b=el('button',{class:api&&data.enabled?'secondary':'primary',type:'button',text:'Watch the recorded run'});b.onclick=()=>void showRecorded(c);actions.append(b);}
    if(!api&&!LIVE_URL)actions.append(runLive(c.id));
    list.append(el('article',{class:'case'},
      el('p',{class:'case-lib'},el('span',{text:c.library}),c.category?el('span',{class:'tag',text:c.category}):null),
      el('h3',{text:c.title}),el('p',{class:'case-sum',text:c.summary}),
      el('p',{class:'case-src'},el('a',{href:c.issue,text:'Reported issue ↗'}),' · ',el('a',{href:c.fixUrl||`${c.repository}/commit/${c.fixCommit}`,text:`Maintainers' fix ${c.fixCommit.slice(0,7)} ↗`})),
      el('p',{class:`case-status ${r?.verdict==='VERIFIED_PASS'?'ok':r?'no':''}`,text:status}),repeats(c),actions));
  }
}
function renderScoreboard(){
  const rows=$('#score-rows');rows.replaceChildren();
  for(const c of data.cases){const r=c.recorded;
    rows.append(el('tr',{},el('td',{text:c.library}),el('td',{},el('a',{href:c.issue,text:c.title})),el('td',{class:'ok',text:'Pass'}),
      el('td',{class:r?.verdict==='VERIFIED_PASS'?'ok':r?'no':'',text:r?(r.verdict==='VERIFIED_PASS'?(r.scope==='page'?'Pass · page workaround':'Verified pass'):r.verdict==='VERIFIED_FAIL'?'Rejected':'Inconclusive'):'Not run'}),
      el('td',{text:r?.passedOn?`${r.passedOn} · ${modelName(r.models[r.passedOn-1])}`:'—'}),
      el('td',{},r?el('a',{href:`./project.html?run=${r.run}${r.passedOn?'&attempt='+r.passedOn:''}#project-result`,text:'Evidence'}):'—')));}
  // Earlier engine versions stay on the page: a rerun after a change must not hide the previous score.
  const b=data.benchmark,box=$('#versions');if(!b?.versions?.length){box.hidden=true;return;}
  box.hidden=false;box.replaceChildren(el('h3',{text:'Engine versions'}),...(b.note?[el('p',{class:'small',text:b.note})]:[]),
    el('ol',{},...[...b.versions].reverse().map(v=>el('li',{class:v.current?'current':''},el('strong',{text:`${v.verified}/${v.runs}`}),...(v.libraryVerified!=null&&v.libraryVerified<v.verified?[el('span',{class:'small',text:` (${v.libraryVerified} in the library code)`})]:[]),el('span',{class:'small',text:` ${v.id}${v.current?' · this table':''}${v.runs<v.eligible?` · ${v.runs} of ${v.eligible} cases run`:''}`}),...(v.repeats?[el('span',{class:'small',text:` · ${v.repeats.perCase} blind runs per bug, all counted: ${v.repeats.verified} of ${v.repeats.runs} runs repaired (${v.repeats.libraryVerified} in the library code), ${v.repeats.casesRepairedOnce} of ${v.eligible} bugs repaired at least once`})]:[]),...(v.note?[el('p',{text:v.note})]:[])))));
}
// What the loop and the gates add, measured over every recorded blind run (scripts/gate-stats.mjs).
function renderGates(){
  const g=gates,box=$('#gates');if(!g?.realRuns){box.hidden=true;return;}box.hidden=false;
  const pct=n=>Math.round(n/g.realRuns*100)+'%',WHY={functional:'changed the submitted data or broke the pointer path',guards:'broke a guarded behaviour',rules:'added an axe finding the original never showed'};
  box.replaceChildren(el('h3',{text:'What the browser loop and the gates add'}),el('p',{class:'small',text:g.note}),
    el('dl',{class:'gate-stats'},
      el('div',{},el('dt',{text:`${g.firstTry}/${g.realRuns}`}),el('dd',{text:`repaired by Nemotron 3 Super's first patch (${pct(g.firstTry)})`})),
      el('div',{},el('dt',{text:`${g.firstTry+g.withFeedback}/${g.realRuns}`}),el('dd',{text:`repaired once Chromium's failure report goes back to Nemotron (${pct(g.firstTry+g.withFeedback)})${g.libraryFixed!=null?`; ${g.libraryFixed} of those changed the library's own code, the rest only worked around the bug in the page`:''}`})),
      el('div',{},el('dt',{text:String(g.caughtAfterKeyboardPass)}),el('dd',{text:'patches made the reported keyboard task pass and were still rejected. A test of the reported bug alone would have accepted them.'}))),
    el('details',{class:'gate-caught'},el('summary',{text:`The ${g.caught.length} patches, on ${new Set(g.caught.map(c=>c.case)).size} bugs, that fixed the reported key and broke something else`}),
      el('ul',{},...Object.values(Object.groupBy(g.caught,c=>c.case)).map(list=>el('li',{},
        el('strong',{text:list[0].case}),` · ${list.length} patch${list.length>1?'es':''}: ${[...new Set(list.flatMap(c=>c.why))].map(w=>WHY[w]||w).join('; ')}. `,
        el('span',{class:'small',text:list[0].reason||''}),
        el('span',{class:'gate-links'},...list.map((c,i)=>el('a',{href:`./project.html?run=${c.run}&attempt=${c.attempt}#project-result`,text:`${modelName(c.model)} · attempt ${c.attempt}${c.version?` · engine ${c.version}`:""}`}))))))),
    // The gate's own mistakes stay visible: rejections the corrected axe check (engine v9) does not support.
    ...(g.falseRejections?.length?[el('details',{class:'gate-caught'},el('summary',{text:`${g.falseRejections.length} patches the gate itself got wrong`}),
      el('p',{class:'small',text:'Before engine v9, an axe finding counted as new if the failing keyboard baseline lacked that exact selector. A patch that got further reached calendar days the baseline never rendered, and the library\'s own day colours were blamed on the patch. Engine v9 compares with every recorded path on the original by element kind; these patches show no new finding under that check, so they are not counted as caught above. Their recorded verdicts are unchanged.'}),
      el('p',{class:'gate-links'},...g.falseRejections.map(c=>el('a',{href:`./project.html?run=${c.run}&attempt=${c.attempt}#project-result`,text:`${c.case} · ${modelName(c.model)} · attempt ${c.attempt} · engine ${c.version}`}))))]:[]));
}
// Crop a 1280×720 capture to the focused element so the result is visible at a glance.
function focusShot(img,src,state,tone){
  const fig=img.parentElement;fig.querySelector('.ring')?.remove();img.removeAttribute('style');fig.classList.add('shot');
  const box=state?.focus?.bbox;img.onload=()=>{
    const W=img.naturalWidth,H=img.naturalHeight;if(!box||!W||box.width*box.height>W*H*.5){img.removeAttribute('style');return;}
    const cw=Math.min(W,Math.max(560,box.width*2.4)),ch=cw*9/16,cx=Math.min(Math.max(0,box.x+box.width/2-cw/2),W-cw),cy=Math.min(Math.max(0,box.y+box.height/2-ch/2),Math.max(0,H-ch));
    const frame=img.closest('.crop');frame.style.aspectRatio=`${cw} / ${ch}`;Object.assign(img.style,{width:`${W/cw*100}%`,maxWidth:'none',marginLeft:`${-cx/cw*100}%`,marginTop:`${-cy/cw*100}%`});
    const ring=el('span',{class:`ring ${tone}`});Object.assign(ring.style,{left:`${(box.x-cx-4)/cw*100}%`,top:`${(box.y-cy-4)/ch*100}%`,width:`${(box.width+8)/cw*100}%`,height:`${(box.height+8)/ch*100}%`});frame.append(ring);
  };img.src=src;
}
function notice(text){const n=$('#notice');n.textContent=text;n.hidden=!text;}

async function startLive(c,button){
  button.disabled=true;notice('');
  try{const {id}=await getJson('./api/live/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({case:c.id})});await watch(id,c,{live:true});}
  catch(e){notice(e.message);if(e.body?.active){const a=data.cases.find(x=>x.id===e.body.active.case);if(a)void watch(e.body.active.id,a,{live:true});}}
  finally{button.disabled=false;try{data={...data,...await getJson('./api/live')};renderMode();}catch{}}
}
async function showRecorded(c,pin=null){
  const r=c.recorded;if(!r&&!pin)return;
  let run;try{run=await getJson(`./evidence/runs/${pin||r.run}/run.json`);run.__static=true;}catch{notice('This recorded run is not in the published evidence bundle.');return;}
  await watch(run.id,c,{recorded:run});
}
// Recorded runs are revealed stage by stage from their own event log; nothing is re-executed.
async function watch(id,c,{live=false,recorded=null}={}){
  const token=Symbol();watching=token;
  $('#run').hidden=false;$('#run-kind').textContent=live?'LIVE RUN · NEW NEMOTRON CALLS ON NEBIUS TOKEN FACTORY':'RECORDED RUN · REPLAYED FROM ITS EVENT LOG, NO NEW CALLS';
  $('#run-title').textContent=c?.title||'Repair';$('#run-summary').textContent=c?.summary||'';
  $('#run-links').replaceChildren(...(c?[el('a',{href:c.issue,text:'Reported issue ↗'}),' · ',el('span',{class:'mono',text:c.buggyCommit?`${c.library} @ ${c.buggyCommit.slice(0,7)} (before the fix)`:`${c.library} @ ${c.pinnedCommit.slice(0,7)} (current head, unfixed)`})]:[]));
  for(const s of ['#baseline','#verdict'])$(s).hidden=true;$('#attempts').replaceChildren();$('#human').open=false;
  $('#run').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  clearInterval(clock);
  if(recorded){
    const events=recorded.events||[];
    for(let i=1;i<=events.length;i++){if(watching!==token)return;render({...recorded,events:events.slice(0,i),state:events[i-1].state,__partial:i<events.length},c);$('#run-clock').textContent=`${((Date.parse(events[i-1].at)-Date.parse(events[0].at))/1000).toFixed(1)} s`;await new Promise(r=>setTimeout(r,matchMedia('(prefers-reduced-motion: reduce)').matches?0:450));}
    return;
  }
  const t0=Date.now();clock=setInterval(()=>{$('#run-clock').textContent=`${((Date.now()-t0)/1000).toFixed(1)} s`;},100);
  for(;;){
    if(watching!==token)return;
    let run;try{run=await getJson(`./api/runs/${id}`);}catch{await new Promise(r=>setTimeout(r,1500));continue;}
    render(run,c);
    if(run.completedAt){clearInterval(clock);if(run.elapsedMs)$('#run-clock').textContent=`${(run.elapsedMs/1000).toFixed(1)} s`;try{data={...data,...await getJson('./api/live')};renderMode();}catch{}return;}
    await new Promise(r=>setTimeout(r,1000));
  }
}
const cardCache=new Map();
const seen=(run,states)=>run.events?.some(e=>states.includes(e.state));
function render(run,c){
  const current=run.state,last=STAGES.findIndex(([, ,s])=>s.includes(current));
  $('#run-state').textContent={VERIFIED:'Verified pass',FAILED:'Not repaired',INCONCLUSIVE:'Inconclusive'}[current]||STAGES[last]?.[1]||'Starting';
  $('#run-state').className=`state ${current==='VERIFIED'?'ok':current==='FAILED'||current==='INCONCLUSIVE'?'no':'busy'}`;
  $('#pipeline').replaceChildren(...STAGES.map(([key,label,states],i)=>{const done=i<last||seen(run,['VERIFIED'])&&key==='verdict',active=i===last&&!['VERIFIED','FAILED','INCONCLUSIVE'].includes(current);
    const n=key==='propose'?run.events?.filter(e=>e.state==='PLANNING_REPAIR').length:0;
    return el('li',{class:done?'done':active?'active':i===last?'end':'' ,'aria-current':active?'step':null},el('span',{class:'dot'}),el('span',{text:label+(n>1?` ×${n}`:'')}));}));
  // Baseline: the frozen keyboard task fails on the buggy upstream source.
  if(run.before&&seen(run,['FAILURE_CONFIRMED','LOCALIZING','PLANNING_REPAIR','FAILED','INCONCLUSIVE','VERIFIED'])){
    const b=run.before,step=b.steps?.find(s=>s.result!=='VERIFIED_PASS'),fail=step?.assertions?.find(a=>!a.pass),cp=b.checkpoints?.at(-1);
    $('#baseline').hidden=false;if(cp?.screenshot){focusShot($('#baseline-shot'),artifactUrl(run,`before/${cp.screenshot}`),cp.state,'bad');$('#baseline-shot').alt=`Buggy page after the keyboard task; focus on ${cp.state?.focus?.selector||'nothing'}`;}
    $('#baseline-caption').textContent=`Buggy source · focus on ${cp?.state?.focus?.selector||'—'}`;
    $('#baseline-text').textContent=step?`Step ${step.index+1}, “${step.title}”: ${describe(fail,step)}.`:(b.failure?.message||'The keyboard task fails.');
    $('#baseline-task').textContent='Frozen keys: '+(run.journey?.steps||[]).map(s=>s.action.kind==='press'?s.action.key:s.action.kind==='seek'?`Tab→${s.action.selector}`:s.action.kind==='type'?`type “${s.action.text}”`:s.action.kind).join(' · ');
  }
  // A replayed recording reveals attempts in order: an attempt appears when its proposal is requested and
  // shows its outcome only once the run has moved past its verification. Unchanged cards are reused.
  const box=$('#attempts'),planned=run.events?.filter(e=>e.state==='PLANNING_REPAIR').length??0,ended=['VERIFIED','FAILED','INCONCLUSIVE'].includes(run.state);
  // An attempt is finished once the next one has started or the run has ended; until then it is in progress.
  const shown=(run.attempts||[]).filter(a=>!run.__partial||a.attempt<=planned).map(a=>run.__partial&&!ended&&a.attempt===planned?{attempt:a.attempt,provenance:{model:a.provenance?.model}}:a);
  box.replaceChildren(...shown.map(a=>{const key=`${run.id}:${a.attempt}:${a.category||''}:${a.verified}:${!!a.plan}`;let card=cardCache.get(key);if(!card){card=attemptCard(run,a);cardCache.set(key,card);}return card;}));
  if(['VERIFIED','FAILED','INCONCLUSIVE'].includes(current)&&!run.__partial)renderVerdict(run,c);
}
function describe(fail,step){
  if(!fail)return 'the expected state did not occur';const a=fail.assertion;
  if(a.kind==='focus')return `focus should be on ${a.selector}, but it is on ${step.after?.selector||'nothing'}`;
  if(a.kind==='form-data')return `the form should submit ${a.name}=${JSON.stringify(a.value)}, but submits ${JSON.stringify(fail.observed)}`;
  if(a.kind==='attribute')return `${a.selector} ${a.name} should be ${JSON.stringify(a.value)}, observed ${JSON.stringify(fail.observed)}`;
  if(a.kind==='visible')return `${a.selector} should be ${a.value?'visible':'hidden'}`;
  if(a.kind==='text')return `${a.selector} should read “${a.value}”, observed “${fail.observed}”`;
  return `${a.kind} check failed`;
}
function attemptCard(run,a){
  const p={...a.provenance,model:a.provenance?.model||data?.models?.[a.attempt-1]},u=p.usage,ok=a.verified,pending=!a.category&&!a.verified&&!a.verification;
  const card=el('article',{class:`attempt ${ok?'a-ok':pending?'a-busy':'a-no'}`},
    el('header',{},el('span',{class:'model',text:`Attempt ${a.attempt} · ${modelName(p.model)}`}),el('span',{class:'mono',text:[p.latencyMs?`${(p.latencyMs/1000).toFixed(1)} s`:null,u?.total_tokens?`${u.total_tokens.toLocaleString()} tokens`:null,p.requestId?p.requestId.slice(0,18)+'…':null].filter(Boolean).join(' · ')})));
  if(a.plan){card.append(el('h4',{text:'What Nemotron found'}),el('p',{text:a.plan.root_cause}),el('h4',{text:'What it changed'}),el('p',{text:a.plan.repair_strategy}));}
  else if(pending)card.append(el('p',{class:'thinking',text:`${modelName(p.model||'')} is reading the source and the browser's failure report…`}));
  if(a.diff){const pre=el('pre',{class:'diff',text:'Loading diff…'});card.append(pre);void fetch(artifactUrl(run,a.diff)).then(r=>r.ok?r.text():'Diff unavailable').then(t=>{pre.replaceChildren(...t.split('\n').map(line=>el('span',{class:line.startsWith('+')&&!line.startsWith('+++')?'add':line.startsWith('-')&&!line.startsWith('---')?'del':line.startsWith('@@')?'hunk':'',text:line+'\n'})));});}
  const outcome=ok?'The browser accepted it: keyboard task, independent pointer path'+(run.guards?.length?` and ${run.guards.length} regression guard${run.guards.length>1?'s':''}`:'')+' all pass.'
    :a.category==='APPLICATION'?`Rejected before running: ${a.failure}. The error goes back to the next attempt.`
    :a.category==='OVERFIT'?`Rejected before running: the patch only works on this test page. ${a.failure} That goes back to the next attempt.`
    :a.category==='VERIFICATION'?`Rejected by the browser: ${(a.verification?.reasons||[]).slice(0,1).join('; ')}. That failure goes back to the next attempt.`
    :a.category?`${a.category}: ${a.failure||''}`:null;
  if(outcome)card.append(el('p',{class:'outcome',text:outcome}));
  return card;
}
function renderVerdict(run,c){
  const v=run.verification?.verdict,ok=v==='VERIFIED_PASS',a=run.attempts?.find(x=>x.verified)||run.attempts?.at(-1);
  $('#verdict').hidden=false;$('#verdict').className=`verdict ${ok?'ok':'no'}`;
  $('#verdict-badge').textContent=ok?'VERIFIED PASS':v==='VERIFIED_FAIL'?'NOT REPAIRED':'INCONCLUSIVE';
  $('#verdict-title').textContent=ok?`Repaired on attempt ${a.attempt} by ${modelName(a.provenance?.model)}.`:'No patch passed every gate. Nothing is accepted.';
  $('#verdict-text').textContent=ok?'The same frozen keys now reach the expected result in a fresh browser. The pointer path still produces the same outcome. No new automated-rule findings and no console errors. This verdict covers only these checks.':(run.verification?.reasons||[]).slice(0,3).join(' · ');
  const before=run.before?.checkpoints?.at(-1),after=a?.after?.checkpoints?.at(-1)||run.after?.checkpoints?.at(-1);
  if(ok&&before?.screenshot&&after?.screenshot){$('#compare').hidden=false;focusShot($('#shot-before'),artifactUrl(run,`before/${before.screenshot}`),before.state,'bad');focusShot($('#shot-after'),artifactUrl(run,`${a.afterDir||run.afterDir}/${after.screenshot}`),after.state,'good');
    $('#focus-before').textContent=`focus: ${before.state?.focus?.selector||'—'}`;$('#focus-after').textContent=`focus: ${after.state?.focus?.selector||'—'}`;
    $('#shot-before').alt=`Before: focus on ${before.state?.focus?.selector||'nothing'}`;$('#shot-after').alt=`After: focus on ${after.state?.focus?.selector||'nothing'}`;}
  else $('#compare').hidden=true;
  $('#human').hidden=true;
  if(c?.fixCommit){$('#human').hidden=false;$('#human').ontoggle=()=>{if($('#human').open&&$('#human-diff').dataset.case!==c.id){$('#human-diff').dataset.case=c.id;void fetch(humanPatchUrl(c.id)).then(r=>r.ok?r.text():'Unavailable').then(t=>{$('#human-diff').textContent=t;});}};}
  $('#full-evidence').href=`./project.html?run=${run.id}${a?.verified?'&attempt='+a.attempt:''}#project-result`;
}
void boot();
