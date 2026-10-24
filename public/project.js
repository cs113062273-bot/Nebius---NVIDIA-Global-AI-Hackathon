import {executionLabel,status,checkpointId,lastCheckpoint,assertionSummary,failurePoint,attemptFailure,attemptReasons,comparisonCheckpoint} from './result-evidence.js';
const $=s=>document.querySelector(s),text=(s,v)=>{$(s).textContent=v;};
let original=[],edited=[],config,busy=false,pollTimer,runVersion=0,frozen=null,preview=null,capturing=false,pickPurpose='result',picked=null,lastRun=null,playTimer=null;
const empty=profile=>({version:1,id:'captured-'+profile,title:profile==='keyboard'?'Complete the keyboard task':'Preserve the functional result',goal:'Complete the confirmed task and preserve the selected outcome',source:'authored',profile,path:'/',steps:[],success:[],functional:[],forbidden:[]});
let tasks={keyboard:empty('keyboard'),pointer:empty('pointer')},guards=[];
async function api(url,options){const r=await fetch(url,options),data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed');return data;}
const post=(url,data)=>api(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
function notice(message,error=false){text('#project-notice',message);$('#project-notice').classList.toggle('error',error);}
function ready(){$('#freeze-task').disabled=busy||!tasks.keyboard.steps.length||!tasks.pointer.steps.length||!tasks.keyboard.functional.length||!tasks.pointer.functional.length;const live=$('#project-mode').value==='nebius';$('#verify-project').disabled=busy||!frozen||!original.length||!live&&!edited.length;$('#edited-source').hidden=live;text('#verify-project',live?'Repair & verify >':'Verify edited version >');text('#mode-explanation',live?'NVIDIA Nemotron diagnoses and writes bounded source edits through Nebius Token Factory. Up to three attempts receive concrete failure feedback.':'Your edited files are a human-supplied candidate. Added, deleted and modified files are applied in a disposable copy; no model call.');}
function summary(selector,files){text(selector,`${files.length} static files · ${(files.reduce((n,f)=>n+(f.encoding==='base64'?f.content.length*.75:new TextEncoder().encode(f.content).length),0)/1024).toFixed(1)} KB`);}
async function sourceFiles(input){
 const files=[...input.files].map(file=>({file,path:file.webkitRelativePath.split('/').slice(1).join('/')})).filter(({path})=>/\.(html|css|js|svg|json|png|jpg|jpeg|webp|gif|ico|woff2?|ttf|txt)$/.test(path)&&!path.split('/').some(p=>p.startsWith('.')||/^(node_modules|vendor|scripts|tests|secrets|credentials)$/i.test(p)));
 if(!files.length||files.length>80||files.reduce((n,v)=>n+v.file.size,0)>8000000||files.some(v=>v.file.size>1400000)||!files.some(v=>v.path==='index.html'))throw new Error('Choose a browser-executable folder with index.html, at most 80 files / 8 MB and 1.4 MB per file. Select the dist folder itself for built output.');
 return Promise.all(files.map(async({file,path})=>{if(/\.(png|jpg|jpeg|webp|gif|ico|woff2?|ttf)$/.test(path)){const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {path,content:btoa(binary),encoding:'base64'};}return {path,content:await file.text(),encoding:'utf8'};}));
}
function unfreeze(){frozen=null;$('#freeze-task').hidden=false;$('#unfreeze-task').hidden=true;text('#freeze-status','Not confirmed. Review both paths and their result assertions.');$('#capture-panel').inert=false;$('#task-builder').inert=false;$('.contract').inert=false;ready();}
for(const phase of ['original','edited'])$('#choose-'+phase).onclick=()=>$('#'+phase+'-files').click();
for(const phase of ['original','edited'])$('#'+phase+'-files').onchange=async()=>{try{const files=await sourceFiles($('#'+phase+'-files'));if(phase==='original'){original=files;tasks={keyboard:empty('keyboard'),pointer:empty('pointer')};guards=[];preview=null;$('#capture-panel').hidden=true;if(!$('#project-name').value)$('#project-name').value=$('#'+phase+'-files').files[0].webkitRelativePath.split('/')[0];}else edited=files;summary('#'+phase+'-summary',files);unfreeze();buildTask();notice('Source selected. Capture and confirm tasks before running.');}catch(e){if(phase==='original')original=[];else edited=[];unfreeze();text('#'+phase+'-summary','No valid folder selected.');notice(e.message,true);}ready();};
function syncJson(){$('#keyboard-contract').value=JSON.stringify(cleanTask(tasks.keyboard),null,2);$('#functional-contract').value=JSON.stringify(cleanTask(tasks.pointer),null,2);}
function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b;}
function buildTask(){
 syncJson();const profile=$('#edit-profile').value,t=tasks[profile];$('#task-builder').replaceChildren();
 t.steps.forEach((step,index)=>{const row=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=`${index+1}. ${step.title}`;row.append(legend);const select=document.createElement('input');select.type='radio';select.name='selected-step';select.value=index;select.setAttribute('aria-label',`Select step ${index+1} to choose expected focus`);select.checked=index===t.steps.length-1;row.append(select);const title=document.createElement('input');title.value=step.title;title.setAttribute('aria-label',`Step ${index+1} title`);title.onchange=()=>{step.title=title.value;unfreeze();syncJson();};row.append(title);const details=document.createElement('p');details.textContent=`${step.action.kind}: ${step.action.key??step.action.text??step.action.selector} · expected focus: ${(step.assertions||[]).find(a=>a.kind==='focus')?.selector||'not asserted'}`;row.append(details);if((step.assertions||[]).some(a=>a.kind==='focus'))row.append(button('Clear focus check',()=>{step.assertions=step.assertions.filter(a=>a.kind!=='focus');unfreeze();buildTask();}));row.append(button('Remove step',()=>{t.steps.splice(index,1);unfreeze();buildTask();}));if(index)row.append(button('Move earlier',()=>{[t.steps[index-1],t.steps[index]]=[t.steps[index],t.steps[index-1]];unfreeze();buildTask();}));const value=document.createElement('input');value.value=step.action.key??step.action.text??step.action.selector;value.setAttribute('aria-label',`Step ${index+1} action value`);value.onchange=()=>{step.action[step.action.kind==='press'?'key':step.action.kind==='type'?'text':'selector']=value.value;unfreeze();syncJson();};row.append(value);$('#task-builder').append(row);});
 $('#functional-summary').replaceChildren();const heading=document.createElement('strong');heading.textContent=profile==='keyboard'?'Keyboard task assertions':'Independent functional assertions';$('#functional-summary').append(heading);
 for(const g of guards){const p=document.createElement('p');p.textContent=`Regression guard · ${g.title} · must still pass after repair`;$('#functional-summary').append(p);}
 tasks[profile].functional.forEach((a,i)=>{const p=document.createElement('p');p.textContent=`${a.kind} · ${a.selector} · ${a.name||''} ${JSON.stringify(a.value)}`;p.append(button('Edit',()=>{picked={selector:a.selector,label:a.selector,text:a.value,attributes:a.name?[{name:a.name,value:a.value}]:[],form:a.kind==='form-data'?{selector:a.selector,fields:[{name:a.name,values:a.value}]}:null};showAssertion();$('#assertion-kind').value=a.kind;assertionKind();$('#assertion-value').value=String(a.value);$('#save-assertion').dataset.index=i;$('#assertion-scope').value=profile;}),button('Remove',()=>{const t=tasks[profile];t.functional.splice(i,1);t.success=t.functional.map(a=>({...a}));unfreeze();buildTask();}));$('#functional-summary').append(p);});ready();
}
async function template(id){const t=await api('./api/task-template/'+id);tasks={keyboard:t.journey,pointer:t.functionalJourney};guards=t.guards||[];unfreeze();buildTask();}
$('#add-key-step').onclick=()=>{const t=tasks[$('#edit-profile').value];if(t.steps.length>=40)return;t.steps.push({title:'Press Enter',action:{kind:'press',key:'Enter'},assertions:[]});unfreeze();buildTask();};$('#edit-profile').onchange=buildTask;$('#use-template').onclick=()=>template($('#task-template').value).catch(e=>notice(e.message,true));
for(const id of ['keyboard-contract','functional-contract'])$('#'+id).onchange=()=>{try{tasks={keyboard:JSON.parse($('#keyboard-contract').value),pointer:JSON.parse($('#functional-contract').value)};unfreeze();buildTask();}catch{notice('Task JSON is invalid.',true);}};
$('#project-mode').onchange=ready;$('#input-kind').onchange=unfreeze;
$('#load-example').onclick=async()=>{try{const e=await api('./api/project-example/a11y-dialog');original=e.files;edited=e.editedFiles;$('#project-name').value='a11y-dialog · published human patch';$('#project-mode').value='reference';await template('a11y-dialog');summary('#original-summary',original);summary('#edited-summary',edited);notice('Historical source and published human edit loaded. Review both tasks and freeze them. No inference.');ready();}catch(e){notice(e.message,true);}};
async function loadFormCase(example='country-preferences'){if(busy){notice('Wait for the active run to finish before loading another source.');return;}try{const e=await api('./api/project-case/'+example);clearTimeout(pollTimer);runVersion++;selectionVersion++;lastRun=null;$('#project-result').hidden=true;history.replaceState(null,'','?example='+example);original=e.files;edited=[];tasks={keyboard:e.journey,pointer:e.functionalJourney};guards=e.guards||[];preview=null;$('#capture-panel').hidden=true;$('#project-name').value=e.name;$('#project-mode').value=config.liveConfigured?'nebius':'reference';summary('#original-summary',original);text('#edited-summary','No human repair loaded.');unfreeze();buildTask();notice(e.notice);$('#project-form').scrollIntoView({behavior:'instant'});}catch(e){notice(e.message,true);}}
$('#load-form-example').onclick=()=>loadFormCase();$('#load-booking-example').onclick=()=>loadFormCase('weekday-booking');
function captureCommand(data){if(preview)$('#capture-frame').contentWindow.postMessage({tabstitch:preview.id,...data},preview.origin);}
function fitCapture(){const el=$('.app-preview'),width=el.clientWidth;if(width)el.style.setProperty('--capture-scale',Math.min(1,width/1280));}window.addEventListener('resize',fitCapture);
async function openCapture(){if(!original.length)throw new Error('Choose original source first.');if(!preview){preview=await post('./api/project-preview',{files:original});$('#capture-frame').src=preview.origin;}$('#capture-panel').hidden=false;requestAnimationFrame(fitCapture);}
$('#open-capture').onclick=()=>openCapture().catch(e=>notice(e.message,true));
$('#start-capture').onclick=async()=>{try{await openCapture();unfreeze();const profile=$('#capture-profile').value,checks=tasks[profile].functional.map(a=>({...a}));tasks[profile]={...empty(profile),functional:checks,success:checks.map(a=>({...a}))};capturing=true;$('#stop-capture').disabled=false;$('#edit-profile').value=profile;$('#capture-frame').src=preview.origin+'/?capture='+Date.now();text('#capture-notice',`Capturing ${profile} path. Click blank page space to enter the app. Choose expected focus if the current behavior is wrong.`);buildTask();}catch(e){notice(e.message,true);}};
$('#stop-capture').onclick=()=>{capturing=false;captureCommand({active:false});$('#stop-capture').disabled=true;text('#capture-notice','Capture stopped. Review steps; choose expected focus and result assertions before freezing.');};
for(const [id,purpose]of [['pick-result','result'],['pick-focus','focus']])$('#'+id).onclick=()=>{capturing=false;captureCommand({active:false,picking:true});pickPurpose=purpose;text('#capture-notice',purpose==='focus'?'Click the element that should receive focus after the selected step. This does not activate it.':'Click the result element. This does not activate it.');};
window.addEventListener('message',event=>{
 if(!preview||event.origin!==preview.origin||event.source!==$('#capture-frame').contentWindow||event.data?.tabstitch!==preview.id)return;const d=event.data,profile=$('#capture-profile').value,t=tasks[profile];
 if(d.type==='ready'){captureCommand({active:capturing,profile});return;}
 if(d.type==='element'){if(pickPurpose==='focus'){const selected=tasks[$('#edit-profile').value],i=Number($('input[name=selected-step]:checked')?.value??selected.steps.length-1),s=selected.steps[i];if(!s){notice('Capture a step first.',true);return;}s.assertions=[...s.assertions.filter(a=>a.kind!=='focus'),{kind:'focus',selector:d.element.selector}];unfreeze();buildTask();text('#capture-notice',`Expected focus: ${d.element.label}`);}else{picked=d.element;delete $('#save-assertion').dataset.index;showAssertion();}return;}
 if(!capturing||frozen)return;
 if(d.type==='step'&&t.steps.length<40){t.steps.push({title:`${d.action.key||'Click'} · ${d.focus.label}`,sequence:d.sequence,action:d.action,assertions:[]});buildTask();}
 if(d.type==='focus'){const s=t.steps.find(s=>s.sequence===d.sequence);if(s){s.title=`${s.action.key||'Click'} · ${d.focus.label}`;if(profile==='keyboard')s.assertions=[{kind:'focus',selector:d.focus.selector}];buildTask();}}
 if(d.type==='input'&&t.steps.length<40){const previous=t.steps.at(-1);if(previous?.action.kind==='type'&&previous.inputTarget===d.element.selector)previous.action.text=d.value;else t.steps.push({title:'Type in '+d.element.label,action:{kind:'type',text:d.value,replace:true},assertions:[],inputTarget:d.element.selector});buildTask();}
});
function formValues(values){$('#form-values').replaceChildren();for(const value of values){const row=document.createElement('div'),input=document.createElement('textarea');input.rows=1;input.dataset.formValue='';input.value=value;input.setAttribute('aria-label','Expected field value');row.append(input,button('Remove value',()=>row.remove()));$('#form-values').append(row);}}
function assertionKind(){const kind=$('#assertion-kind').value,form=kind==='form-data';$('#form-data-editor').hidden=!form;$('#scalar-value-editor').hidden=form;$('#attribute-editor').hidden=kind!=='attribute';if(form)formValues(picked.form?.fields.find(f=>f.name===$('#form-field').value)?.values||[]);else $('#assertion-value').value=kind==='text'?picked.text:kind==='visible'?String(picked.visible):picked.attributes.find(a=>a.name===$('#attribute-name').value)?.value||'';}
function showAssertion(){$('#assertion-editor').hidden=false;text('#picked-element','Selected: '+picked.label);$('#attribute-name').replaceChildren();for(const a of picked.attributes){const o=document.createElement('option');o.value=a.name;o.textContent=a.name;$('#attribute-name').append(o);}$('#form-field').replaceChildren();for(const f of picked.form?.fields||[]){if(f.unsupported)continue;const o=document.createElement('option');o.value=f.name;o.textContent=f.name;$('#form-field').append(o);}if(picked.form?.fields.some(f=>!f.unsupported&&f.name===picked.form.preferredName))$('#form-field').value=picked.form.preferredName;$('#assertion-kind option[value="form-data"]').disabled=!$('#form-field').options.length;$('#assertion-kind').value=picked.form&&$('#form-field').options.length?'form-data':'text';assertionKind();$('#assertion-editor').scrollIntoView({behavior:'instant',block:'center'});$('#assertion-kind').focus({preventScroll:true});}
$('#assertion-kind').onchange=assertionKind;
$('#form-field').onchange=()=>formValues(picked.form.fields.find(f=>f.name===$('#form-field').value)?.values||[]);
$('#add-form-value').onclick=()=>{const values=[...$('#form-values').querySelectorAll('[data-form-value]')].map(input=>input.value);formValues([...values,'']);};
$('#attribute-name').onchange=()=>{$('#assertion-value').value=picked.attributes.find(a=>a.name===$('#attribute-name').value)?.value||'';};
$('#save-assertion').onclick=()=>{if(!picked)return;const kind=$('#assertion-kind').value,value=$('#assertion-value').value,a={kind,selector:picked.selector,value:kind==='visible'?value==='true':value};if(kind==='attribute')a.name=$('#attribute-name').value;if(kind==='form-data'){a.selector=picked.form.selector;a.name=$('#form-field').value;a.value=[...$('#form-values').querySelectorAll('[data-form-value]')].map(input=>input.value);}const index=$('#save-assertion').dataset.index;for(const profile of ($('#assertion-scope').value==='both'?['keyboard','pointer']:[$('#assertion-scope').value])){const t=tasks[profile];if(index!==undefined)t.functional[Number(index)]={...a};else t.functional.push({...a});t.success=t.functional.map(a=>({...a}));}$('#assertion-editor').hidden=true;unfreeze();buildTask();};
function cleanTask(task){const t=structuredClone(task);for(const s of t.steps){delete s.inputTarget;delete s.sequence;}return t;}
$('#freeze-task').onclick=async()=>{try{frozen=await post('./api/project-task',{journey:cleanTask(tasks.keyboard),functionalJourney:cleanTask(tasks.pointer),...(guards.length?{guards}:{})});capturing=false;captureCommand({active:false,picking:false});$('#freeze-task').hidden=true;$('#unfreeze-task').hidden=false;$('#capture-panel').inert=true;$('#task-builder').inert=true;$('.contract').inert=true;text('#freeze-status',`Confirmed · ${frozen.hash.slice(0,16)} · ${frozen.journey.steps.length} keyboard steps / ${frozen.functionalJourney.steps.length} pointer steps${frozen.guards?.length?` · ${frozen.guards.length} regression guards`:''}. The model cannot edit these checks.`);ready();}catch(e){frozen=null;notice(e.message,true);}};
$('#unfreeze-task').onclick=unfreeze;
// Without a local backend (static host, public mode or a fresh clone) runs come from the published evidence bundle.
let staticMode=false,readOnly=false;
const evidenceBase=id=>`./evidence/runs/${id}/`;
const artifact=(run,file)=>run.__static?evidenceBase(run.id)+file:`./api/runs/${run.id}/artifacts/${file}`;
async function fetchRun(id){
 if(!staticMode){try{return await api('./api/runs/'+id);}catch{/* fall back to the published bundle */}}
 const r=await fetch(evidenceBase(id)+'run.json');if(!r.ok)throw new Error('This run is not in the published evidence bundle.');
 return {...await r.json(),__static:true};
}
// Each replay path pairs a frozen task with its baseline and the selected attempt's capture.
function pathInfo(run,a,value){
 const guard=/^guard-(\d+)$/.exec(value||'');
 if(guard){const i=Number(guard[1]);return {task:run.guards?.[i],before:run.guardsBefore?.[i],after:a?.guardsAfter?.[i],beforeDir:`guard-before-${i}`,afterDir:`guard-after-${a?.attempt}-${i}`,label:'Regression guard '+(i+1)};}
 if(value==='pointer')return {task:run.functionalJourney,before:run.functionalBefore,after:a?.functionalAfter,beforeDir:'functional-before',afterDir:`functional-after-${a?.attempt}`,label:'Independent functional'};
 return {task:run.journey,before:run.before,after:a?.after,beforeDir:'before',afterDir:a?.afterDir,label:'Keyboard'};
}
let histories;
async function renderHistory(run){
 const host=$('#evidence-history');host.hidden=true;host.replaceChildren();
 try{histories??=await Promise.all(['micromodal-history','native-form-history','pikaday-history'].map(name=>api('./'+name+'.json')));const historyData=histories.find(data=>data.runIds.includes(run.id));if(lastRun!==run||!historyData)return;
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=historyData.title||'Evidence history · model repairs, human variants & negative control';details.append(summary);
 const intro=document.createElement('p');intro.textContent=historyData.scope;details.append(intro);
 const source=document.createElement('p');source.textContent=historyData.sourceNote+' ';const upstream=document.createElement('a');upstream.href=historyData.upstream;upstream.textContent=historyData.upstreamLabel||'Published upstream fix';source.append(upstream);details.append(source);
 const ol=document.createElement('ol');
 for(const entry of historyData.steps){
  const li=document.createElement('li'),h=document.createElement('h3');h.textContent=entry.title;li.append(h);
  const meta=document.createElement('p');meta.className='evidence-meta';meta.textContent=entry.kind+' · '+new Date(entry.at).toLocaleString('en-GB',{timeZone:'UTC',hour12:false})+' UTC'+(entry.timeNote?' · '+entry.timeNote:'');li.append(meta);
  const p=document.createElement('p');p.textContent=entry.description;li.append(p);
  const links=document.createElement('div');links.className='evidence-links';for(const l of entry.links){const a=document.createElement('a');a.href=l.href;a.textContent=l.label;links.append(a);}li.append(links);
  if(entry.evidence||entry.componentHash){const hashes=document.createElement('details'),label=document.createElement('summary'),pre=document.createElement('pre');label.textContent='Source run / attempt, request & SHA-256';pre.textContent=JSON.stringify({run:entry.evidence?.run,componentHash:entry.componentHash,...entry.evidence},null,2);hashes.append(label,pre);li.append(hashes);}
  ol.append(li);
 }
 details.append(ol);host.append(details);host.hidden=false;
 }catch{if(lastRun===run){host.hidden=false;host.textContent='Evidence history is temporarily unavailable.';}}
}
let selectionVersion=0;
const selectedAttempt=()=>lastRun?.attempts.find(a=>a.attempt===Number($('#result-attempt').value));
function stopPlayback(){if(playTimer)clearInterval(playTimer);playTimer=null;text('#play-checkpoints','Play captured checkpoints');}
function saveSelection(){if(!lastRun)return;const u=new URL(location.href);for(const [k,v]of Object.entries({run:lastRun.id,attempt:$('#result-attempt').value,path:$('#result-path').value,step:$('#result-step').value}))u.searchParams.set(k,v);history.replaceState(null,'',u);}
function showShot(run,result,dir,prefix,step){
 const cp=result?.checkpoints?.find(c=>c.id===checkpointId(step)),img=$('#project-'+prefix+'-image');
 img.hidden=true;img.removeAttribute('src');$('#project-'+prefix+'-ring').hidden=true;
 if(!cp){text('#project-'+prefix,'NOT_EXECUTED · checkpoint not reached');text('#project-'+prefix+'-focus','No executed checkpoint');return;}
 img.src=artifact(run,dir+'/'+cp.screenshot);img.hidden=false;
 const outcome=step?`Action ${(result.steps?.[step-1]?.result||'CAPTURED').replace('VERIFIED_','')}`:'Initial capture';
 const finalChecks=[...result.checks||[],...result.functional||[],...(result.forbidden||[]).map(c=>({...c,pass:!c.pass}))];
 text('#project-'+prefix,cp.id+' · '+outcome+(step===lastCheckpoint(result)&&finalChecks.length?` · Postconditions ${finalChecks.every(c=>c.pass)?'PASS':'FAIL'}`:''));
 text('#project-'+prefix+'-focus','Focus: '+(cp.state.focus?.selector||'document'));
 const ring=$('#project-'+prefix+'-ring'),box=cp.state.focus?.bbox;
 if(box&&cp.state.focus?.selector!=='body'){ring.hidden=false;Object.assign(ring.style,{left:box.x/1280*100+'%',top:box.y/800*100+'%',width:box.width/1280*100+'%',height:box.height/800*100+'%'});}
}
function renderAttemptSummary(){
 const a=selectedAttempt(),run=lastRun,keyboard=status(a?.after),functional=status(a?.functionalAfter);
 text('#selected-attempt-heading',a?'Selected attempt '+a.attempt:'No executed attempt');
 text('#project-verdict',!a?.after&&!a?.functionalAfter?'NOT_EXECUTED · no browser verification':a?.verification?.verdict?.replaceAll('_',' ')||'INCONCLUSIVE');
 $('#project-verdict').dataset.verdict=a?.verification?.verdict||'NOT_TESTED';
 const label=v=>v==='VERIFIED_PASS'?'PASS':v==='VERIFIED_FAIL'?'FAIL':v==='NOT_TESTED'?'NOT_TESTED (not executed)':v;
 const guards=run.guards?.length?(a?.guardsAfter||[]):null,guardsPassed=guards?.filter(r=>r?.verdict==='VERIFIED_PASS').length;
 text('#gate-summary',`Attempt ${a?.attempt||'—'} · Keyboard ${label(keyboard)} | Independent functional ${label(functional)}${guards?` | Regression guards ${guards.length?guardsPassed+'/'+run.guards.length:'NOT_TESTED'}`:''}`);
 const guardFailed=guards?.length&&guardsPassed<run.guards.length;
 text('#gate-explanation',keyboard==='VERIFIED_PASS'&&functional==='VERIFIED_FAIL'?'Keyboard passed; independent functionality failed':keyboard==='VERIFIED_FAIL'?'Keyboard failed; this attempt was rejected':keyboard==='VERIFIED_PASS'&&functional==='VERIFIED_PASS'&&guardFailed?'Task passed; a regression guard failed':keyboard==='VERIFIED_PASS'&&functional==='VERIFIED_PASS'?(guards?'Keyboard, independent functionality and every regression guard passed':'Keyboard and independent functionality passed'):'Browser verification is incomplete');
 text('#baseline-gates',`Original baseline · Keyboard ${label(status(run.before))} | Independent functional ${label(status(run.functionalBefore))}${run.guards?.length?` | Regression guards ${(run.guardsBefore||[]).filter(r=>r.verdict==='VERIFIED_PASS').length}/${run.guards.length}`:''}`);
 const reasons=attemptReasons(run,a);text('#project-reasons',reasons.join('; ')||(run.guards?.length?'Frozen keyboard task, independent functional path and every regression guard passed. This verdict covers only these checks.':'Frozen keyboard task and independent functional path passed. This verdict covers only these checks.'));
 const raw={attempt:a?.attempt,...a?.verification,...(a?.failure?{failure:a.failure}:{})},original=[...a?.verification?.reasons||[],...a?.verification?.uncertain||[]],clarified=original.some(reason=>!reasons.includes(reason));
 text('#reason-provenance',clarified?`This display explains recorded assertions. Some original verifier wording is clarified here; the original record below and downloaded proof are unchanged. Functional baseline: ${label(status(run.functionalBefore))}; candidate: ${label(functional)}.`:'');
 $('#reason-provenance').hidden=!clarified;$('#original-verifier').hidden=!a;text('#original-verifier-record',JSON.stringify(raw,null,2));
 for(const b of document.querySelectorAll('.attempt-select'))b.setAttribute('aria-pressed',String(Number(b.dataset.attempt)===a?.attempt));
 renderModelCall(run,a);
}
// Shows the recorded Nebius request behind the selected attempt; replays and human candidates say no call was made.
function renderModelCall(run,a){
 const box=$('#model-call'),p=a?.provenance;box.replaceChildren();box.hidden=!a;if(!a)return;
 const line=(value,className)=>{const el=document.createElement('p');el.textContent=value;if(className)el.className=className;box.append(el);};
 const heading=document.createElement('h3');heading.textContent=`Model call · attempt ${a.attempt}`;box.append(heading);
 if(!p?.requestId&&!p?.requestFile){line(p?.status==='RECORDED_PLAN_REPLAY'?`No new model call: replay of recorded request ${p.originalRequestId}.`:p?.status==='REFERENCE_NOT_AI'?'No model call: this candidate is human-supplied or a browser-only replay of an earlier patch.':'No model request was made for this attempt.');return;}
 const n=v=>Number(v).toLocaleString('en-US'),u=p.usage,reasoning=u?.completion_tokens_details?.reasoning_tokens;
 line(`${p.model} · ${p.provider||'Nebius Token Factory'} · request ${p.requestId||'not returned'} · ${u?`${n(u.prompt_tokens)} prompt + ${n(u.completion_tokens)} completion tokens${reasoning?` (${n(reasoning)} reasoning)`:''}`:'no usage recorded'}${p.latencyMs?` · ${(p.latencyMs/1000).toFixed(1)} s`:''}${p.cacheHit?' · cached response, no new call':''}`,'model-meta');
 if(p.status==='FAILED_OR_UNCERTAIN')line(`No usable proposal${p.finishReason?` (finish reason: ${p.finishReason})`:''}: ${a.failure||'see the raw files'}`);
 if(a.plan?.root_cause)line('Model diagnosis: '+a.plan.root_cause);
 if(a.plan?.repair_strategy)line('Model strategy: '+a.plan.repair_strategy);
 const links=document.createElement('p');links.className='evidence-links';
 for(const [label,file,present]of [['Raw request',`model-request-${a.attempt}.json`,p.requestFile],['Raw response',`model-response-${a.attempt}.json`,p.responseFile]])if(present){const link=document.createElement('a');link.href=artifact(run,file);link.textContent=label+' →';links.append(link);}
 if(links.childNodes.length)box.append(links);
}
function showCheckpoint(){
 if(!lastRun)return;const run=lastRun,a=selectedAttempt(),info=pathInfo(run,a,$('#result-path').value),{before,after,task}=info,step=Number($('#result-step').value);
 const outcomes=(after?.checks||[]).filter(c=>['text','attribute','form-data'].includes(c.assertion.kind)).map(c=>({after:c,before:before?.checks?.find(b=>JSON.stringify(b.assertion)===JSON.stringify(c.assertion))})).filter(pair=>pair.before&&JSON.stringify(pair.before.observed)!==JSON.stringify(pair.after.observed)).sort((a,b)=>['form-data','text','attribute'].indexOf(a.after.assertion.kind)-['form-data','text','attribute'].indexOf(b.after.assertion.kind));
 $('#task-outcome').hidden=!outcomes.length;if(outcomes.length){const pair=outcomes[0],target=pair.after.assertion;const display=v=>typeof v==='string'?v||'(empty)':JSON.stringify(v);text('#task-outcome',`Final recorded ${target.kind==='form-data'?'form data':'outcome'} · ${target.selector}${target.name?' '+target.name:''}: ${display(pair.before.observed)} → ${display(pair.after.observed)}`);}
 showShot(run,before,info.beforeDir,'before',step);showShot(run,after,info.afterDir,'after',step);
 text('#checkpoint-note',`${info.label}${info.label.startsWith('Regression')&&task?.title?' · '+task.title:''} · ${step===0?'Initial page':task?.steps[step-1]?.title||''}`);$('#checkpoint-assertions').replaceChildren();
 for(const [label,r]of [['Original · shared baseline',before],['Candidate · Attempt '+(a?.attempt||'—'),after]]){
  const section=document.createElement('article'),h=document.createElement('h3');h.textContent=label+' assertions';section.append(h);$('#checkpoint-assertions').append(section);
  const cp=r?.checkpoints?.find(c=>c.id===checkpointId(step));
  if(!cp){const p=document.createElement('p');p.textContent='NOT_EXECUTED · no assertions or screenshot at this checkpoint.';section.append(p);continue;}
  const checks=[...(step?r.steps?.[step-1]?.assertions||[]:[]),...(step===lastCheckpoint(r)?[...r.checks||[],...r.functional||[],...(r.forbidden||[]).map(c=>({...c,pass:!c.pass,forbidden:true}))]:[])];
  for(const c of [...new Map(checks.map(c=>[JSON.stringify(c.assertion)+!!c.forbidden,c])).values()]){const p=document.createElement('p');p.textContent=`${c.pass?'PASS':'FAIL'} · ${c.forbidden?'Forbidden: ':''}${assertionSummary(c,cp.state.focus?.selector)}`;section.append(p);}
  if(!checks.length){const p=document.createElement('p');p.textContent='No assertions at this checkpoint.';section.append(p);}
  if(r.failure&&step===lastCheckpoint(r)){const p=document.createElement('p');p.textContent='Stopped: '+(failurePoint(r)?.summary||r.failure.message);section.append(p);}
 }
 saveSelection();
}
function setupCheckpoints(preferred){
 stopPlayback();const a=selectedAttempt(),{task:t,after:r,before}=pathInfo(lastRun,a,$('#result-path').value);
 $('#play-checkpoints').disabled=!r?.checkpoints?.length;
 $('#result-step').replaceChildren();for(const [i,label]of ['Initial',...t.steps.map(s=>s.title)].entries()){const o=document.createElement('option');o.value=i;o.textContent=`${i}. ${label}${r?.checkpoints?.some(c=>c.id===checkpointId(i))?'':' · NOT_EXECUTED'}`;$('#result-step').append(o);}
 const step=preferred!==undefined&&Number.isInteger(Number(preferred))&&Number(preferred)>=0&&Number(preferred)<=t.steps.length?Number(preferred):comparisonCheckpoint(before,r);
 $('#result-step').value=step;showCheckpoint();
}
async function chooseAttempt(selection={}){
 const run=lastRun,a=selectedAttempt(),version=++selectionVersion;stopPlayback();renderAttemptSummary();
 const f=attemptFailure(a),paths=[...$('#result-path').options].map(o=>o.value);$('#result-path').value=paths.includes(selection.path)?selection.path:f?.path||'keyboard';
 setupCheckpoints(selection.step);text('#project-diff',a?.diff?'Loading selected attempt diff…':'No applied diff for this attempt.');$('#rerun-browser').disabled=!a?.diff||!a?.after||readOnly||!!run.__static;
 $('#download-patch').hidden=!a?.diff;if(a?.diff){$('#download-patch').href=artifact(run,a.diff);$('#download-patch').download=`tabstitch-${run.id}-attempt-${a.attempt}.patch`;}
 if(a?.diff){try{const r=await fetch(artifact(run,a.diff)),diff=r.ok?await r.text():'Diff unavailable for this attempt.';if(version===selectionVersion&&run===lastRun)text('#project-diff',diff);}catch{if(version===selectionVersion)text('#project-diff','Diff unavailable for this attempt.');}}
}
function renderAttemptCards(run){
 $('#attempt-timeline').replaceChildren();
 for(const a of run.attempts||[]){
  const article=document.createElement('article'),b=button(`Attempt ${a.attempt} · ${a.verification?.verdict||a.category||'IN PROGRESS'} · ${((a.elapsedMs||0)/1000).toFixed(1)} s`,()=>{$('#result-attempt').value=a.attempt;void chooseAttempt();$('#project-result').scrollIntoView({behavior:'instant',block:'start'});});
  b.className='attempt-select';b.dataset.attempt=a.attempt;b.disabled=!run.manifest;b.setAttribute('aria-pressed','false');article.append(b);
  const p=document.createElement('p');p.textContent=attemptFailure(a)?.summary||attemptReasons(run,a).join('; ')||'Keyboard PASS · Independent functional PASS';article.append(p);
  p.className='attempt-reason';p.onclick=()=>b.click();
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Diagnosis & provenance';details.append(summary);
  for(const v of [a.plan?.root_cause,a.plan?.repair_strategy,a.provenance?`${a.provenance.provider} · ${a.provenance.requestId||'no model request'} · ${a.provenance.cacheHit?'cached':'not cached'}`:null]){if(v){const p=document.createElement('p');p.textContent=v;details.append(p);}}
  article.append(details);$('#attempt-timeline').append(article);
 }
}
$('#result-attempt').onchange=()=>chooseAttempt().catch(e=>notice(e.message,true));
$('#result-path').onchange=()=>setupCheckpoints();$('#result-step').onchange=()=>{stopPlayback();showCheckpoint();};
$('#play-checkpoints').onclick=()=>{
 if(playTimer){stopPlayback();return;}
 const r=pathInfo(lastRun,selectedAttempt(),$('#result-path').value).after;
 const steps=(r?.checkpoints||[]).map(c=>c.id==='initial'?0:Number(c.id.slice(5))+1);
 if(!steps.length)return;let i=0;$('#result-step').value=steps[i];showCheckpoint();text('#play-checkpoints','Pause checkpoints');
 playTimer=setInterval(()=>{if(++i>=steps.length){stopPlayback();return;}$('#result-step').value=steps[i];showCheckpoint();},1300);
};
async function poll(id,version=runVersion){try{const run=await fetchRun(id);if(version!==runVersion)return;$('#project-progress').replaceChildren();for(const event of run.events||[]){const li=document.createElement('li');li.textContent=event.state.replaceAll('_',' ');li.title=event.detail;$('#project-progress').append(li);}text('#result-title',run.journey?.title||'Preparing browser');const zone=run.before?.environment?.timezoneId;text('#result-source',executionLabel(run)+(run.source?.name?' · '+run.source.name:'')+(zone&&zone!=='UTC'?' · Browser time zone '+zone:'')+(run.source?.scope?' · '+run.source.scope:''));renderAttemptCards(run);
 if(run.manifest){
 lastRun=run;const params=new URLSearchParams(location.search);$('#result-attempt').replaceChildren();
 $('#result-path').replaceChildren(...[['keyboard','Keyboard journey'],['pointer','Independent functional path'],...(run.guards||[]).map((g,i)=>['guard-'+i,`Regression guard ${i+1}`])].map(([value,label])=>Object.assign(document.createElement('option'),{value,textContent:label})));
 for(const a of run.attempts){const o=document.createElement('option');o.value=a.attempt;o.textContent='Attempt '+a.attempt;$('#result-attempt').append(o);}
 $('#result-attempt').value=run.attempts.some(a=>a.attempt===Number(params.get('attempt')))?params.get('attempt'):run.attempts.at(-1)?.attempt||'';
 text('#run-final-verdict',`Run final result · ${run.verification.verdict.replaceAll('_',' ')} · final attempt ${run.attempts.at(-1)?.attempt||'none'}`);
 await chooseAttempt({path:params.get('path'),step:params.has('step')?params.get('step'):undefined});
 void renderHistory(run);
 const archived=!run.__static||run.evidenceView?.proof;$('#project-proof').href=run.__static?evidenceBase(id)+(archived?'proof.tar.gz':'manifest.json'):`./api/runs/${id}/proof`;text('#project-proof',archived?'Download complete proof →':'Download hash manifest →');$('#project-proof').hidden=false;$('#rerun-model').disabled=readOnly||!!run.__static||!config?.liveConfigured||!run.attempts.length;busy=false;ready();
 notice(run.__static?'Recorded evidence loaded from the published bundle. No inference or browser run is started.':'Verification complete. Selected attempt controls gates, checkpoints, assertions and diff.');
 $('#project-result').scrollIntoView({behavior:'instant',block:'start'});
 }
 else if(run.fatal)throw new Error('Browser run failed to initialize.');else pollTimer=setTimeout(()=>poll(id,version),900);
 }catch(e){busy=false;ready();notice(e.message,true);text('#project-verdict','INCONCLUSIVE');}}
async function startRun(data,url='./api/project-runs'){const version=++runVersion;selectionVersion++;lastRun=null;stopPlayback();clearTimeout(pollTimer);busy=true;ready();text('#project-verdict','RUNNING');$('#project-verdict').dataset.verdict='RUNNING';for(const id of ['run-final-verdict','baseline-gates','gate-summary','gate-explanation','project-reasons','checkpoint-note','project-diff','project-before','project-after','project-before-focus','project-after-focus'])text('#'+id,'');$('#reason-provenance').hidden=true;$('#original-verifier').hidden=true;$('#task-outcome').hidden=true;$('#download-patch').hidden=true;$('#checkpoint-assertions').replaceChildren();$('#evidence-history').hidden=true;for(const prefix of ['before','after']){const img=$('#project-'+prefix+'-image');img.hidden=true;img.removeAttribute('src');$('#project-'+prefix+'-ring').hidden=true;}$('#project-result').hidden=false;$('#attempt-timeline').replaceChildren();notice('Freezing source and both tasks; starting fresh browser contexts...');try{const r=await post(url,data);$('#project-result').hidden=false;$('#project-proof').hidden=true;text('#project-verdict','RUNNING');$('#rerun-browser').disabled=true;$('#rerun-model').disabled=true;localStorage.setItem('tabstitch.projectRun',r.id);history.replaceState(null,'',`?run=${r.id}`);clearTimeout(pollTimer);if(playTimer){clearInterval(playTimer);playTimer=null;}$('#project-result').scrollIntoView({behavior:'smooth'});void poll(r.id,version);}catch(e){busy=false;ready();notice(e.message,true);}}
$('#project-form').onsubmit=event=>{event.preventDefault();if(!busy&&frozen)void startRun({name:$('#project-name').value,mode:$('#project-mode').value,inputKind:$('#input-kind').value,files:original,editedFiles:$('#project-mode').value==='reference'?edited:undefined,journey:frozen.journey,functionalJourney:frozen.functionalJourney,...(frozen.guards?.length?{guards:frozen.guards}:{}),confirmation:frozen.token});};
$('#rerun-browser').onclick=()=>{if(!busy&&lastRun)void startRun({attempt:Number($('#result-attempt').value),inference:false},`./api/runs/${lastRun.id}/repeat`);};
$('#rerun-model').onclick=()=>{if(!busy&&lastRun&&confirm(`Start a new Nemotron inference using sponsor credits?\n\nSource run: ${lastRun.id}\nSelected attempt: ${$('#result-attempt').value}\n\nViewing recorded evidence uses no inference. Continue only if you intend to spend configured credits.`))void startRun({attempt:Number($('#result-attempt').value),inference:true},`./api/runs/${lastRun.id}/repeat`);};
if(new URLSearchParams(location.search).has('run')){$('#project-result').hidden=false;text('#result-title','Loading recorded browser evidence…');text('#project-verdict','LOADING');$('#project-result').scrollIntoView({behavior:'instant',block:'start'});}
try{config=await api('./api/config');}catch{staticMode=true;}
readOnly=staticMode||!!config?.publicMode;
if(readOnly){document.body.classList.add('read-only');for(const el of document.querySelectorAll('[data-local-only]'))el.hidden=true;text('.masthead .source-link','PUBLISHED EVIDENCE · READ ONLY');
 const params=new URLSearchParams(location.search);if(!params.has('run')||params.has('evidence')){$('#evidence-index').hidden=false;void renderEvidenceIndex();}if(params.has('run')){busy=true;$('#project-result').hidden=false;void poll(params.get('run'));}else{notice('Recorded evidence only. Importing source, capturing tasks and new inference need the local workbench.');if(params.has('evidence'))requestAnimationFrame(()=>$('#evidence-index').scrollIntoView({behavior:'instant'}));}}
else try{const o=$('#project-mode option[value=nebius]');o.disabled=!config.liveConfigured;o.textContent=config.liveConfigured?'Nemotron on Nebius · uses sponsor credits':'Nemotron unavailable · configure authorized sponsor inference';$('#project-mode').value=config.liveConfigured?'nebius':'reference';buildTask();ready();const params=new URLSearchParams(location.search),previous=params.get('run')||localStorage.getItem('tabstitch.projectRun');if(params.has('evidence')){$('#evidence-index').hidden=false;await renderEvidenceIndex();$('#evidence-index').scrollIntoView({behavior:'instant'});}else if(['country-preferences','weekday-booking'].includes(params.get('example')))await loadFormCase(params.get('example'));else if(previous){busy=true;ready();$('#project-result').hidden=false;void poll(previous);}}catch(e){notice(e.message,true);}
async function renderEvidenceIndex(){
 try{const r=await fetch('./evidence/index.json');if(!r.ok)throw new Error('missing');const index=await r.json(),list=$('#evidence-list');list.replaceChildren();
  for(const group of index.groups){const li=document.createElement('li'),h=document.createElement('h3');h.textContent=group.title;li.append(h);const p=document.createElement('p');p.textContent=group.summary;li.append(p);const ul=document.createElement('ul');
   for(const item of group.runs){const row=document.createElement('li'),a=document.createElement('a');a.href=`./project.html?run=${item.id}${item.attempt?'&attempt='+item.attempt:''}#project-result`;a.textContent=item.label;row.append(a,document.createTextNode(` · ${item.verdict.replaceAll('_',' ')} · ${item.execution}`));ul.append(row);}
   li.append(ul);list.append(li);}
 }catch{text('#evidence-list','The evidence index is unavailable.');}
}
