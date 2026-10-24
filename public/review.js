const $=selector=>document.querySelector(selector);
const write=(selector,value)=>{$(selector).textContent=value;};
let record,index=2,timer=null,registry,loadVersion=0;
const number=value=>Number(value).toLocaleString('en-US');
const actionLabel=action=>!action?'Start':action.kind==='press'?action.key:action.kind==='seek'?'Tab':action.kind==='type'?'Type':action.kind==='click'?'Click':'Start';
function stop(){clearInterval(timer);timer=null;write('#play','Play journey');$('#play').setAttribute('aria-pressed','false');}
function frameFor(phase,step){return phase.frames.find(f=>f.id===(step===0?'initial':`step-${step-1}`))||phase.frames.at(-1);}
function describe(step){
 if(step===0)return 'Both runs start with the same application, viewport and frozen task.';
 const before=frameFor(record.before,step),after=frameFor(record.after,step),failed=record.before.failure?.step;
 if(step===failed+1)return record.id==='a11y-dialog'?`Escape hides the dialog, but original focus is pulled back to invisible ${before.focus.selector}. The patch returns focus to ${after.focus.selector}.`:`Original focus stays on ${before.focus.selector}. The patch moves it to ${after.focus.selector}, inside the dialog.`;
 if(step>failed+1)return `The original stopped at step ${failed+1}; its last captured state remains shown. The repaired run continues: focus is on ${after.focus.selector}.`;
 return `Both runs reach ${after.focus.selector}. Only actual key presses move focus during this journey.`;
}
function render(){
 const max=record.journey.steps.length;index=Math.min(max,Math.max(0,index));
 $('#step-select').value=String(index);$('#step-back').disabled=index===0;$('#step-next').disabled=index===max;
 write('#step-count',`${index} / ${max}`);
 const step=record.journey.steps[index-1];write('#action-key',actionLabel(step?.action));write('#action-title',step?.title||'Start from the same page');write('#action-note',describe(index));
 for(const [name,result]of [['before',record.before],['after',record.after]]){
  const frame=frameFor(result,index),stopped=result.failure&&index>result.failure.step+1;
  const image=$('#'+name+'-image');image.src=new URL(frame.image,document.baseURI).href;image.alt=`${name==='before'?'Original':'Model-repaired'} recording, ${frame.id}: focus on ${frame.focus.selector}. ${stopped?'This run stopped at its failure; no later state was executed.':''}`;
  write('#'+name+'-focus',frame.focus.selector);write('#'+name+'-progress',stopped?'Stopped · last captured state':frame.id==='initial'?'Initial state':`Step ${index} / ${max}`);
  const state=stopped?'Stopped at barrier':result.failure&&index===result.failure.step+1?'Focus check failed':index===max?(result.verdict==='VERIFIED_PASS'?'Task completed':'Task failed'):'Recorded checkpoint';
  write('#'+name+'-status',state);
  const ring=$('#'+name+'-ring'),box=frame.focus.bbox;
  ring.hidden=!box||frame.focus.selector==='body'||box.x<0||box.y<0;
  if(!ring.hidden){ring.style.left=(box.x/1280*100)+'%';ring.style.top=(box.y/800*100)+'%';ring.style.width=(box.width/1280*100)+'%';ring.style.height=(box.height/800*100)+'%';}
 }
 write('#outcome-note',index===max?(record.id==='a11y-dialog'?'Escape restores focus to the opener; the separate pointer run still opens and dismisses the notice.':'The keyboard task passed; a separate pointer run preserved the order confirmation and submitted email.'):(record.id==='a11y-dialog'?'Open the notice, press Escape and compare the actual focus destination.':'Step through Enter, backward Tab, forward Tab, Escape and the completed order.'));
 if(index===max)stop();
}
$('#step-back').addEventListener('click',()=>{stop();index--;render();});
$('#step-next').addEventListener('click',()=>{stop();index++;render();});
$('#step-select').addEventListener('change',()=>{stop();index=Number($('#step-select').value);render();});
$('#show-result').addEventListener('click',()=>{stop();index=record.journey.steps.length;render();});
$('#play').addEventListener('click',()=>{
 if(timer){stop();return;}
 index=0;render();write('#play','Pause journey');$('#play').setAttribute('aria-pressed','true');
 timer=setInterval(()=>{index++;render();},1800);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('pagehide',stop);
function gate(text,pass=true){const li=document.createElement('li'),icon=document.createElement('span'),body=document.createElement('div');icon.textContent=pass?'✓':'!';icon.setAttribute('aria-hidden','true');body.textContent=text;li.append(icon,body);$('#gate-list').append(li);}
function fileLink(file){return new URL(record.files[file],document.baseURI).href;}
async function load(item){
 const version=++loadVersion;stop();$('#play').disabled=true;$('#show-result').disabled=true;$('#load-error').hidden=true;
 const response=await fetch(new URL(item.path,document.baseURI));if(!response.ok)throw new Error('The recording could not be loaded. Reload this page or run npm run review:build locally.');const loaded=await response.json();if(version!==loadVersion)return;record=loaded;
 if(record.verification?.verdict!=='VERIFIED_PASS'||record.model?.cacheHit!==false)throw new Error('This recording does not establish a verified live model repair.');
 const historical=record.id==='a11y-dialog';index=historical?3:2;
 $('#record-picker').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.record===record.id)));
 write('#replay-title',historical?'Escape should bring you back.':'Follow the focus.');
 write('#record-description',historical?'A real a11y-dialog historical defect: dismiss an opacity-hidden notice, and focus gets pulled back into invisible content. This reconstruction runs the pinned upstream runtime code and the model’s own patch.':'A synthetic checkout: at Enter, the original stops because focus never enters the dialog. The model’s patch continues through the same 11-step task.');
 const source=$('#record-source');source.replaceChildren();source.append(document.createTextNode(record.kind+'. '));
 if(historical){const a=document.createElement('a');a.href=record.source.fix;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Pinned upstream change ↗';source.append(a);}
 write('#record-limits',historical?'This is a nonblind reconstruction of a publicly fixed a11y-dialog defect. The model received the pinned broken runtime JavaScript and observed failure, and authored a patch that passed this task. It is not a new upstream discovery, an upstream-submitted fix or a blind benchmark. The notice harness and pointer assertion are reconstructed, not an entire production app. Existing unrelated automated findings remain visible. No full WCAG or screen-reader verification is claimed.':'This is one model-authored repair of a synthetic checkout, verified against its frozen keyboard journey and separate pointer functional replay. It is not a measured repair success rate, full WCAG conformance or real screen-reader verification. The author’s reference patch uses native <dialog>; this model wrote focus-handling functions. Different source does not establish superior quality.');
 const select=$('#step-select');select.replaceChildren();
 for(const [i,title]of ['Initial page',...record.journey.steps.map(s=>s.title)].entries()){const option=document.createElement('option');option.value=String(i);option.textContent=`${String(i).padStart(2,'0')} · ${title}`;select.append(option);}
 select.disabled=false;$('#play').disabled=false;$('#show-result').disabled=false;$('#play').setAttribute('aria-pressed','false');
 write('#diagnosis',record.plan.root_cause);write('#strategy',record.plan.repair_strategy);
 write('#model-name',record.model.model.replace('nvidia/',''));write('#model-time',(record.model.latencyMs/1000).toFixed(1)+' s');write('#model-tokens',number(record.model.usage.total_tokens));
 write('#verdict',record.verification.verdict.replace('_',' '));
 const comparison=await fetch(`./recordings/${record.id}/diff-comparison.json`).then(r=>r.ok?r.json():null);if(version!==loadVersion)return;const reviewPatch=comparison?await fetch('./'+comparison.model.path).then(r=>r.text()):record.patch;
 $('#human-comparison').hidden=!historical;if(historical&&comparison){write('#comparison-model',reviewPatch);write('#comparison-human',await fetch('./'+comparison['human-runtime'].path).then(r=>r.text()));$('#human-source').href=comparison.humanSource;$('#upstream-diff').href='./'+comparison['upstream-typescript'].path;}
 const pre=$('#patch');pre.replaceChildren();
 for(const line of reviewPatch.split('\n')){const span=document.createElement('span');span.textContent=line+'\n';span.className=line.startsWith('+++')||line.startsWith('---')||line.startsWith('@@')?'diff-header':line.startsWith('+')?'diff-add':line.startsWith('-')?'diff-remove':'';pre.append(span);}
 $('#gate-list').replaceChildren();
 gate(`Same frozen ${record.journey.steps.length}-step keyboard journey completed.`,record.after.verdict==='VERIFIED_PASS');
 gate(historical?'Escape closes the notice and returns keyboard focus to its opener.':'Focus enters the dialog; Tab and Shift+Tab stay inside; Escape returns to the opener.',record.after.verdict==='VERIFIED_PASS');
 for(const assertion of record.functional.assertions)gate(`Preserved ${historical?'closed-dialog aria-hidden state':assertion.assertion.kind==='text'?'confirmation':'submitted email'}: ${assertion.observed}`,assertion.pass);
 gate('Separate pointer functional replay passed.',record.functional.after==='VERIFIED_PASS');
 gate(`No new automated violations (${record.before.scan.violations} before, ${record.after.scan.violations} after). This is not full accessibility conformance.`,record.after.scan.violations<=record.before.scan.violations);
 write('#proof-hash',`Complete proof · ${(record.bundle.bytes/1024/1024).toFixed(1)} MB · SHA-256 ${record.bundle.sha256}`);
 write('#hash-result','');$('#verify-proof').disabled=false;
 $('#proof-download').href=new URL(record.bundle.path,document.baseURI).href;
 $('#patch-download').href=comparison?'./'+comparison.model.path:fileLink('diff-1.patch');
 for(const a of document.querySelectorAll('.evidence-files a'))a.href=fileLink(a.getAttribute('href').split('/').at(-1));
 $('#try-original').href=new URL(record.previews.before,document.baseURI).href;$('#try-repaired').href=new URL(record.previews.after,document.baseURI).href;
 render();
}
function failed(error){$('#load-error').hidden=false;write('#load-error',error.message);write('#action-note','Recording unavailable; no successful result is implied.');write('#verdict','NOT VERIFIED');$('#show-result').disabled=true;$('#play').disabled=true;$('#step-select').disabled=true;}
$('#verify-proof').addEventListener('click',async()=>{
 const current=record;$('#verify-proof').disabled=true;write('#hash-result','Checking the complete archive…');
 try{const r=await fetch(new URL(current.bundle.path,document.baseURI));if(!r.ok)throw new Error('Archive download failed');const bytes=await r.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(record!==current)return;if(hash!==current.bundle.sha256)throw new Error('Archive hash does not match the published recording.');write('#hash-result','Archive SHA-256 matches. This checks file integrity, not accessibility conformance.');}catch(error){if(record===current)write('#hash-result',error.message);}finally{if(record===current)$('#verify-proof').disabled=false;}
});
async function initialize(){
 const r=await fetch('./recordings/index.json');if(!r.ok)throw new Error('Recording index unavailable');registry=await r.json();
 for(const item of registry.records){const b=document.createElement('button');b.type='button';b.textContent=item.title;b.dataset.record=item.id;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>load(item).catch(failed));$('#record-picker').append(b);}
 await load(registry.records.find(r=>r.id===location.hash.replace('#record-',''))||registry.records[0]);
 const attemptsResponse=await fetch('./recordings/attempts.json');if(attemptsResponse.ok){const data=await attemptsResponse.json();for(const attempt of data.attempts){const li=document.createElement('li'),a=document.createElement('a');a.href=new URL(attempt.path,document.baseURI).href;a.target='_blank';a.rel='noopener';a.textContent=`${attempt.verdict}: ${attempt.reasons?.join('; ')||'frozen journey and functional replay passed'} · ${number(attempt.usage?.total_tokens||0)} tokens`;li.append(a);$('#attempt-list').append(li);}}
}
initialize().catch(failed);
