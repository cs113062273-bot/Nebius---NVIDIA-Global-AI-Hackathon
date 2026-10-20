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
  { id: 'wizard', title: 'Send an application', subtitle: 'Finish the last step of an application.', category: 'Keyboard activation', kind: 'activation', action: 'Send application', output: 'Application received · Alex', field: 'Name', value: 'Alex' }
];
export function getFixture(id) { const fixture = fixtures.find(f => f.id === id); if (!fixture) throw new Error('Unknown fixture'); return fixture; }
export function fixturePath(id, version = 'broken') { getFixture(id); if (!['broken','reference'].includes(version)) throw new Error('Invalid fixture version'); return path.join(ROOT, 'fixtures', id, version); }
export function journeyFor(id, profile = 'keyboard') {
  const f = getFixture(id), pointer = profile === 'pointer';
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
