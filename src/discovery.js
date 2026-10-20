import fs from 'node:fs/promises';
import { Journey } from './schema.js';

export async function discover(page) {
  const actions = await page.locator('button,a[href],input[type="submit"],[role="button"]').evaluateAll(elements => elements.slice(0,60).map(el => ({tag:el.tagName.toLowerCase(),role:el.getAttribute('role'),label:(el.getAttribute('aria-label')||el.textContent||el.value||'').trim().slice(0,120),selector:el.id?'#'+el.id:null,href:el.getAttribute('href')})));
  return actions.filter(a=>a.selector && /search|sign|submit|checkout|order|save|setting|book|reserv|export|create|application/i.test(a.label)).map((action,index)=>({id:`candidate-${index}`,source:'heuristic',title:action.label,action,verdict:'NOT_TESTED',requires:['Human-authored success condition','Functional postcondition','Allowed modality'],note:'A suggested intent is not an executable pass oracle.'}));
}
export async function importJourney(file) { return Journey.parse(JSON.parse(await fs.readFile(file,'utf8'))); }
export function fromTestContract(contract) { return Journey.parse({...contract,source:'test-derived'}); }
