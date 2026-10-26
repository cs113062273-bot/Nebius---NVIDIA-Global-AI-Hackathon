import { canonical } from './schema.js';

export const violationKeys = result => new Set((result?.checkpoints || []).flatMap(c => (c.axe?.violations || []).flatMap(v => v.nodes.map(n => v.id + ':' + n.target.join('|')))));
// Numbered siblings and numeric attribute values (a calendar day, a list position) name the same kind of element.
const elementKind = key => key.replace(/="\d+"/g, '="#"').replace(/:nth-child\(\d+\)/g, ':nth-child(#)');
const failedAssertion = result => {
  for(const s of result?.steps||[]){const c=s.assertions?.find(c=>!c.pass);if(c)return {c,step:s.index+1,focus:s.after?.selector};}
  const c=[...result?.checks||[],...result?.functional||[]].find(c=>!c.pass);
  return c?{c}:null;
};
function evidenceReason(label,result){
  if(!result)return `${label}: missing`;
  if(result.verdict==='VERIFIED_PASS')return null;
  const failed=failedAssertion(result),a=failed?.c.assertion;
  const detail=failed?`${failed.step?'Step '+failed.step+' · ':''}${a.selector||a.kind}${a.name?' '+a.name:''}: expected ${JSON.stringify(a.kind==='focus'?a.selector:a.value??a.maximum??a.maximumMs??'assertion satisfied')}, observed ${JSON.stringify(a.kind==='focus'?failed.focus??failed.c.observed:failed.c.observed)}`:result.failure?.message;
  return `${label}: ${result.verdict==='VERIFIED_FAIL'?'failed':'inconclusive'}${detail?' · '+detail:''}`;
}
export function verifyRepair({ before, after, functionalBefore, functionalAfter, patchChanged, build, visual, oracleHash, guards = [], guardsBefore = [], guardsAfter = [] }) {
  const reasons = [], uncertain = [];
  if (before.verdict !== 'VERIFIED_FAIL') reasons.push('Baseline did not reproduce a deterministic journey failure');
  if (after.verdict === 'INCONCLUSIVE') uncertain.push('Replay evidence incomplete');
  if (after.verdict !== 'VERIFIED_PASS') reasons.push(evidenceReason('Keyboard candidate',after));
  if (!after.checks?.length || !after.functional?.length || !after.steps?.length || after.checks.some(c=>!c.pass) || after.functional.some(c=>!c.pass) || after.steps.some(s=>s.result!=='VERIFIED_PASS')) reasons.push('Task evidence is missing or contradicts the verdict');
  if (!oracleHash || before.journeyHash !== oracleHash || after.journeyHash !== oracleHash) reasons.push('Frozen journey oracle mismatch');
  if (canonical(before.environment) !== canonical(after.environment) || before.browser !== after.browser) reasons.push('Replay environment mismatch');
  if (!patchChanged) reasons.push('No source change');
  if (!build) reasons.push('Build/parse checks missing');
  else if (!build.pass) reasons.push('Build/parse checks failed: '+JSON.stringify(build.checks?.filter(c=>!c.pass)||[]));
  if (!visual) reasons.push('Initial-page visual regression check missing');
  else if (!visual.pass) reasons.push('Initial-page visual regression check failed');
  for(const [label,result] of [['Independent functional baseline',functionalBefore],['Independent functional candidate',functionalAfter]]){const reason=evidenceReason(label,result);if(reason)reasons.push(reason);}
  if (functionalBefore && functionalAfter && (functionalBefore.journeyHash !== functionalAfter.journeyHash || canonical(functionalBefore.environment) !== canonical(functionalAfter.environment) || functionalBefore.browser !== functionalAfter.browser)) reasons.push('Functional oracle/environment mismatch');
  if (functionalBefore && functionalAfter && canonical(functionalBefore.functional.map(c => c.observed)) !== canonical(functionalAfter.functional.map(c => c.observed))) reasons.push('Functional output changed');
  // A finding is new only if no recorded path on the original (keyboard, pointer or guard) showed the
  // same rule on the same kind of element. A candidate that gets further than the failing baseline
  // reaches states the baseline never rendered, such as another calendar day with the library's own colours.
  const oldRules = new Set([before, functionalBefore, ...guardsBefore].filter(Boolean).flatMap(r => [...violationKeys(r)].map(elementKind)));
  const newRules = [...new Set([after, functionalAfter, ...guardsAfter].filter(Boolean).flatMap(r => [...violationKeys(r)]))].filter(key => !oldRules.has(elementKind(key)));
  if (newRules.length) reasons.push('New automated-rule findings: ' + newRules.join(', '));
  if (after.consoleErrors.length) reasons.push('Replay has runtime/console errors');
  if (functionalAfter?.consoleErrors.length) reasons.push('Functional replay has runtime/console errors');
  if (after.networkFailures.length || functionalAfter?.networkFailures.length) uncertain.push('Network failures require review');
  // A guard passed on the original; any failure or runtime error on the candidate is a regression.
  guards.forEach((guard,i)=>{if(guardsBefore[i]?.verdict!=='VERIFIED_PASS')reasons.push(`Regression guard "${guard.title}": baseline did not pass`);const reason=evidenceReason(`Regression guard "${guard.title}"`,guardsAfter[i]);if(reason)reasons.push(reason);if(guardsAfter[i]?.consoleErrors?.length)reasons.push(`Regression guard "${guard.title}": runtime error · ${guardsAfter[i].consoleErrors[0].slice(0,200)}`);});
  const gates={keyboard:after.verdict,independentFunctional:functionalAfter?.verdict||'NOT_TESTED',functionalOutputUnchanged:!!functionalBefore&&!!functionalAfter&&canonical(functionalBefore.functional.map(c=>c.observed))===canonical(functionalAfter.functional.map(c=>c.observed)),...(guards.length?{regressionGuards:`${guardsAfter.filter(r=>r?.verdict==='VERIFIED_PASS').length}/${guards.length}`}:{})};
  return { verdict: uncertain.length ? 'INCONCLUSIVE' : reasons.length ? 'VERIFIED_FAIL' : 'VERIFIED_PASS', reasons, uncertain, newRules,gates,
    scope: 'Verified only for frozen journey, functional assertions and recorded conditions. Manual review remains required.' };
}
