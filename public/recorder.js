// Runs on a disposable, separate localhost origin. Page messages are drafts only.
const script=document.currentScript;
const token=new URL(script.src).searchParams.get('token');
let active=false,profile='keyboard',picking=false,sequence=0;
function selector(el){
 if(el.id&&document.querySelectorAll('#'+CSS.escape(el.id)).length===1)return '#'+CSS.escape(el.id);
 for(const name of ['data-testid','name'])if(el.getAttribute(name)){const s=`${el.tagName.toLowerCase()}[${name}=${JSON.stringify(el.getAttribute(name))}]`;if(document.querySelectorAll(s).length===1)return s;}
 const parts=[];while(el&&el!==document.documentElement){let s=el.tagName.toLowerCase();const peers=[...el.parentElement.children].filter(p=>p.tagName===el.tagName);if(peers.length>1)s+=`:nth-of-type(${peers.indexOf(el)+1})`;parts.unshift(s);el=el.parentElement;}return parts.join(' > ');
}
function describe(el,includeForm=false){
 const form=includeForm&&(el instanceof HTMLFormElement?el:el.form||el.closest('form'));let formInfo=null;
 if(form){const data=new FormData(form),names=[...new Set([...form.elements].map(control=>control.name).filter(Boolean))];formInfo={selector:selector(form),preferredName:el.name||document.getElementById(el.id+'-select')?.name,fields:names.map(name=>({name,values:data.getAll(name).filter(value=>typeof value==='string'),unsupported:data.getAll(name).some(value=>typeof value!=='string')}))};}
 return {selector:selector(el),label:el===document.body?'Page body':(el.getAttribute('aria-label')||el.labels?.[0]?.textContent||el.innerText||el.getAttribute('name')||el.tagName).trim().slice(0,120),text:(el.textContent||'').trim().slice(0,1000),attributes:[...el.attributes].filter(a=>!/^on|^style$|^value$/i.test(a.name)).map(a=>({name:a.name,value:a.value})),visible:!!(el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'),form:formInfo};
}
const send=(type,data)=>parent.postMessage({tabstitch:token,type,...data},'*');
window.addEventListener('message',event=>{if(event.source!==parent||event.data?.tabstitch!==token)return;const d=event.data;active=d.active??active;profile=d.profile||profile;picking=d.picking??picking;});
document.addEventListener('click',e=>{
 if(picking){e.preventDefault();e.stopImmediatePropagation();picking=false;send('element',{element:describe(e.target,true)});return;}
 if(active&&profile==='pointer'){const action={kind:'click',selector:selector(e.target.closest('button,a,input,select,[role=button]')||e.target)},id=sequence++;send('step',{sequence:id,action,focus:describe(document.activeElement)});setTimeout(()=>send('focus',{sequence:id,focus:describe(document.activeElement)}),60);}
},true);
const keys=new Set(['Tab','Enter',' ','Escape','ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End']);
document.addEventListener('keydown',e=>{if(!active||profile!=='keyboard'||!keys.has(e.key)||e.ctrlKey||e.metaKey||e.altKey||e.key===' '&&e.target.matches('input,textarea,[contenteditable]'))return;const action={kind:'press',key:e.key===' '?'Space':e.key==='Tab'&&e.shiftKey?'Shift+Tab':e.key},id=sequence++;send('step',{sequence:id,action,focus:describe(document.activeElement)});setTimeout(()=>send('focus',{sequence:id,focus:describe(document.activeElement)}),60);},true);
document.addEventListener('input',e=>{if(!active||!e.target.matches('input,textarea,[contenteditable]'))return;send('input',{element:describe(e.target),value:e.target.value??e.target.textContent});},true);
window.addEventListener('load',()=>send('ready',{}));
