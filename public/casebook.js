const root=document.querySelector('#casebook');
const find=selector=>root.querySelector(selector);
const write=(selector,value)=>{find(selector).textContent=value;};
const make=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
let cases=[],selected=0;
function render(index){
  selected=index;const item=cases[index];if(!item)return;
  root.querySelectorAll('[data-case-index]').forEach((button,i)=>{button.setAttribute('aria-pressed',String(i===index));});
  write('#case-kicker',item.kicker.replace(/^\d+ \/ /,''));write('#case-title',item.title);write('#case-impact',item.impact);write('#case-explanation',item.explanation);
  const p=item.provenance;write('#case-provenance',p.isAI?`${p.kind} · recorded ${p.recordedAt.slice(0,10)} · not triggered by this page`:p.kind+' · recorded browser evidence · no live AI call');
  const facts=find('#case-facts');facts.replaceChildren();
  for(const phase of ['before','after']){
    const image=item.images[phase],frame=find('#case-'+phase+'-image');frame.src=image.src.replace(/^\//,'./');frame.alt=`${phase==='before'?'Before':'After'}: ${item.title} Browser focus: ${image.focus}. ${image.verdict.replaceAll('_',' ')}.`;
    const state=find('#case-'+phase+'-state');state.textContent=image.verdict==='VERIFIED_PASS'?'Task completed':image.verdict==='VERIFIED_FAIL'?'Task failed':'Inconclusive';state.className='case-state '+(image.verdict==='VERIFIED_PASS'?'pass':'fail');
    write('#case-'+phase+'-focus','Focus: '+image.focus);
    const row=make('div');row.append(make('dt',phase==='before'?'Before scan':'After scan'),make('dd',image.axe?`${image.axe.violations} violations · ${image.axe.incomplete} incomplete`:'No scan captured'));facts.append(row);
  }
  const row=make('div');row.append(make('dt','Repair decision'),make('dd',item.id==='live-repair'?'Nemotron patch · task replay passed':item.id==='wrong-fix'?'Rejected · functional regression':item.id==='real-focus-loss'?'Human-fix task replay passed':'Reference task replay passed'));facts.append(row);
  if(p.isAI)for(const [term,value] of [['Model',p.model.replace(/^nvidia\//,'')],['Model call',`${(p.latencyMs/1000).toFixed(1)} s · ${p.usage.total_tokens.toLocaleString()} tokens`]]){const r=make('div');r.append(make('dt',term),make('dd',value));facts.append(r);}
  const path=find('#case-focus-path');path.replaceChildren();
  const trace=item.images.before.focusPath.slice(-10);trace.forEach((focus,i)=>{if(i)path.append(make('span','→','focus-edge'));path.append(make('span',focus,'focus-node'));});
  write('#case-source',item.patch);
  const original=find('#case-original');original.hidden=!item.provenance.url;if(item.provenance.url){original.href=item.provenance.url;original.textContent='Inspect the original human fix ↗';}
  write('#case-scope',item.id==='live-repair'?`One recorded Nebius call (request ${p.requestId}). Verified only for this synthetic checkout journey; not a repair success rate. Raw model output: ${p.evidence}.`:item.id==='real-focus-loss'?'Original project revisions and the published human patch. One reconstructed task; automated rule findings still remain.':'Synthetic application with an explicitly labeled author candidate. This demonstrates the gate, not an AI repair success rate.');
  const button=find('#case-next');button.textContent=index===cases.length-1?'Back to '+cases[0].title+' →':'Next: '+cases[index+1].title+' →';
  if(location.hash.startsWith('#case-'))history.replaceState(null,'','#case-'+item.id);
}
find('#case-next').addEventListener('click',()=>render((selected+1)%cases.length));
find('#pitch-toggle').addEventListener('click',()=>{const on=!document.body.classList.contains('pitch-mode');document.body.classList.toggle('pitch-mode',on);find('#pitch-toggle').setAttribute('aria-pressed',String(on));find('#pitch-toggle').textContent=on?'Exit presentation':'Presentation view';if(on)root.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
find('a[href="#workbench"]')?.addEventListener('click',()=>{document.body.classList.remove('pitch-mode');find('#pitch-toggle').setAttribute('aria-pressed','false');find('#pitch-toggle').textContent='Presentation view';});
try{
  const response=await fetch('./casebook/data.json');if(!response.ok)throw new Error('Recorded evidence unavailable');const data=await response.json();cases=data.cases;
  const tabs=find('#case-tabs');tabs.replaceChildren();
  for(const [index,item]of cases.entries()){const button=make('button',String(index+1).padStart(2,'0')+' · '+({'live-repair':'Nemotron live repair','scanner-blindspot':'Scanner blind spot','wrong-fix':'The wrong fix','real-focus-loss':'Real-world focus loss'}[item.id]||item.title));button.type='button';button.dataset.caseIndex=String(index);button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>render(index));tabs.append(button);}
  const hash=location.hash.replace('#case-','');render(Math.max(0,cases.findIndex(c=>c.id===hash)));
}catch(error){write('#case-title','Recorded evidence unavailable');write('#case-impact',error.message);}
