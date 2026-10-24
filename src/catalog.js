import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const fixtures = [
  { id: 'checkout', title: 'Complete a checkout', subtitle: 'A beautiful shop. A broken keyboard path.', category: 'Modal focus', kind: 'dialog', action: 'Place order', output: 'Order confirmed · Field bag · $84', field: 'Email', value: 'judge@example.com' },
  { id: 'account', title: 'Create an account', subtitle: 'Reach the action that creates your account.', category: 'Keyboard activation', kind: 'activation', action: 'Create account', output: 'Account created · judge@example.com', field: 'Email', value: 'judge@example.com' },
  { id: 'booking', title: 'Reserve a studio', subtitle: 'Choose a time and keep your reservation.', category: 'Modal focus', kind: 'dialog', action: 'Confirm reservation', output: 'Reserved · Studio A · 10:00', field: 'Name', value: 'Alex' },
  { id: 'settings', title: 'Save your preferences', subtitle: 'A custom control must work without a mouse.', category: 'Keyboard activation', kind: 'activation', action: 'Save preferences', output: 'Preferences saved · Weekly digest', field: 'Name', value: 'Alex' },
  { id: 'search', title: 'Search the collection', subtitle: 'Find an item using the keyboard.', category: 'Keyboard activation', kind: 'activation', action: 'Search collection', output: '1 result · Field bag', field: 'Search', value: 'Field bag' },
  { id: 'dashboard', title: 'Export a report', subtitle: 'Review the export dialog and finish the task.', category: 'Modal focus', kind: 'dialog', action: 'Export report', output: 'Report exported · 24 records', field: 'Report name', value: 'Quarterly review' },
  { id: 'wizard', title: 'Send an application', subtitle: 'Finish the last step of an application.', category: 'Keyboard activation', kind: 'activation', action: 'Send application', output: 'Application received · Alex', field: 'Name', value: 'Alex' },
  { id: 'a11y-dialog', title: 'Restore focus after closing a real dialog', subtitle: 'Pinned a11y-dialog historical regression; reconstructed notice task.', category: 'Historical open-source defect', kind: 'historical', action: 'Dismiss notice', output: 'Focus returns to the opener', sourceKind:'historical', sourceUrl:'https://github.com/KittyGiraudel/a11y-dialog/commit/6367c03a9a6dfd1edffe9f8132142f61ad0ad9c9' }
];
export function getFixture(id) { const fixture = fixtures.find(f => f.id === id); if (!fixture) throw new Error('Unknown fixture'); return fixture; }
export function fixturePath(id, version = 'broken') { getFixture(id); if (!['broken','reference'].includes(version)) throw new Error('Invalid fixture version'); return id==='a11y-dialog'?path.join(ROOT,'benchmarks','historical','a11y-dialog-restore',version==='broken'?'before':'after'):path.join(ROOT, 'fixtures', id, version); }
export function journeyFor(id, profile = 'keyboard') {
  const f = getFixture(id), pointer = profile === 'pointer';
  if(f.kind==='historical')return {
    version:1,id:'historical-dialog-'+profile,title:f.title,goal:f.output,source:'benchmark',profile,path:'/',
    steps:pointer?[
      {title:'Open notice',action:{kind:'click',selector:'#open'},assertions:[{kind:'attribute',selector:'#dialog',name:'aria-hidden',value:null}]},
      {title:'Close notice with pointer',action:{kind:'click',selector:'#close'},assertions:[{kind:'attribute',selector:'#dialog',name:'aria-hidden',value:'true'}]}
    ]:[
      {title:'Reach notice trigger',action:{kind:'seek',selector:'#open'}},
      {title:'Open notice',action:{kind:'press',key:'Enter'},assertions:[{kind:'focus',selector:'#dialog'}]},
      {title:'Dismiss notice and return to the opener',action:{kind:'press',key:'Escape'},assertions:[{kind:'focus',selector:'#open'}]}
    ],
    success:pointer?[{kind:'attribute',selector:'#dialog',name:'aria-hidden',value:'true'}]:[{kind:'focus',selector:'#open'}],
    functional:[{kind:'attribute',selector:'#dialog',name:'aria-hidden',value:'true'}],forbidden:[]
  };
  const seek = selector => ({ kind: pointer ? 'click' : 'seek', selector });
  const activate = () => ({ kind: 'press', key: 'Enter' });
  const steps = [];
  if (f.kind === 'dialog') {
    if (pointer) steps.push({ title: 'Open task dialog', action: {kind:'click',selector:'#open'}, assertions:[{kind:'visible',selector:'#panel',value:true}] });
    else steps.push(
      { title: 'Reach task trigger', action: seek('#open') },
      { title: 'Open dialog and move focus into it', action: activate(), assertions: [{ kind:'focus',selector:'#field' },{kind:'ax',role:'dialog',name:f.action}] },
      { title: 'Move backward inside dialog',action:{kind:'press',key:'Shift+Tab'},assertions:[{kind:'focus',selector:'#close'}] },
      { title: 'Contain backward focus in dialog',action:{kind:'press',key:'Shift+Tab'},assertions:[{kind:'focus',selector:'#action'}] },
      { title: 'Contain forward focus in dialog',action:{kind:'press',key:'Tab'},assertions:[{kind:'focus',selector:'#close'}] },
      { title: 'Escape closes dialog and restores trigger',action:{kind:'press',key:'Escape'},assertions:[{kind:'visible',selector:'#panel',value:false},{kind:'focus',selector:'#open'}] },
      { title: 'Reopen dialog for original task',action:activate(),assertions:[{kind:'focus',selector:'#field'}] }
    );
  }
  steps.push({ title:'Reach input',action:seek('#field') },{ title:'Enter task data',action:{kind:'type',text:f.value} });
  if (pointer) steps.push({title:f.action,action:{kind:'click',selector:'#action'}});
  else steps.push({title:'Reach primary action',action:seek('#action')},{title:f.action,action:activate()});
  return { version:1,id:`${id}-${profile}`,title:f.title,goal:f.output,source:'benchmark',profile,path:'/',steps,
    success:[{kind:'text',selector:'#receipt',value:f.output}],functional:[{kind:'text',selector:'#receipt',value:f.output},{kind:'attribute',selector:'#receipt',name:'data-input',value:f.value}],forbidden:[] };
}
