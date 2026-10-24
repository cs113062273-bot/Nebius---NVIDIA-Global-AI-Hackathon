// Display explanations are derived from recorded evidence; historical verdicts stay untouched.
export const status = r => r?.verdict || 'NOT_TESTED';
export function executionLabel(run){
  if(run.source?.execution==='fresh-browser-recheck'||run.mode==='recheck')return 'Fresh browser verification · reused candidate · no inference';
  if(run.mode==='reference'||run.mode==='provided')return 'Human-supplied candidate · no inference';
  if(run.mode==='recorded')return 'Recorded model patch replay · no new inference';
  if(!run.manifest)return 'Nemotron repair workflow in progress';
  const provenance=[run.model,...(run.attempts||[]).map(a=>a.provenance)].filter(Boolean);
  if(provenance.some(p=>p.responseFile||p.requestId))return 'Recorded Nemotron inference on Nebius Token Factory';
  if(provenance.some(p=>p.attemptedCompletions>0))return 'Nebius request attempted · no model response recorded';
  return 'No model request · stopped before inference';
}
export const checkpointId = step => step ? `step-${step-1}` : 'initial';
export const lastCheckpoint = r => {
  const id=r?.checkpoints?.at(-1)?.id;
  return id?.startsWith('step-') ? Number(id.slice(5))+1 : 0;
};
const value = v => v === undefined ? 'not recorded' : typeof v==='string' ? v : JSON.stringify(v);
export function assertionSummary(c, focus) {
  if(c.assertion.kind==='form-data'){
    const a=c.assertion,format=v=>Array.isArray(v)?v.length?v.map(item=>item===''?'(empty)':JSON.stringify(item)).join(', '):'(field absent)':value(v);
    return `Form ${a.selector} / ${a.name}: expected ${format(a.value)}, observed ${format(c.observed)}${c.incomplete?' (incomplete evidence)':''}`;
  }
  const a=c.assertion, actual=a.kind==='focus' && typeof c.observed==='boolean' ? focus || (c.observed?a.selector:'focus not recorded') : value(c.observed);
  const target=a.selector || `${a.role || a.kind}${a.name?' '+a.name:''}`;
  const expected=a.kind==='focus'?a.selector:a.kind==='ax'?'one visible element':a.kind==='overflow'?`≤ ${a.maximum} px`:a.kind==='motion'?`≤ ${a.maximumMs} ms`:a.kind==='forced-colors'?'forced colors active; adjust ≠ none':value(a.value);
  return `${a.kind==='focus'?'Focus':target+(a.name&&a.kind!=='ax'?' '+a.name:'')}: expected ${expected}, observed ${actual}${c.incomplete?' (incomplete evidence)':''}`;
}
export function failurePoint(r) {
  if(!r)return null;
  for(const [i,s] of (r.steps||[]).entries()) {
    const c=s.assertions?.find(c=>!c.pass);
    if(c)return {step:i+1,summary:`Step ${i+1} · ${s.action?.key||s.title} · ${assertionSummary(c,s.after?.selector||r.checkpoints?.find(cp=>cp.id===`step-${i}`)?.state?.focus?.selector)}`};
    if(s.result!=='VERIFIED_PASS')return {step:i+1,summary:`Step ${i+1} · ${s.title}: ${r.failure?.message||s.result}`};
  }
  const c=[...r.checks||[],...r.functional||[]].find(c=>!c.pass);
  if(c)return {step:lastCheckpoint(r),summary:assertionSummary(c,r.checkpoints?.at(-1)?.state?.focus?.selector)};
  const forbidden=r.forbidden?.find(c=>c.pass);
  if(forbidden)return {step:lastCheckpoint(r),summary:`Forbidden state occurred: ${JSON.stringify(forbidden.assertion)}; observed ${value(forbidden.observed)}`};
  if(r.failure || r.consoleErrors?.length || r.networkFailures?.length)return {step:lastCheckpoint(r),summary:r.failure?.message||[...r.consoleErrors||[],...r.networkFailures||[]].map(value).join('; ')};
  return null;
}
export function attemptFailure(a) {
  // Prefer the independent rejection when the keyboard path passed; then regression guards.
  for(const [path,r] of [['keyboard',a?.after],['pointer',a?.functionalAfter],...(a?.guardsAfter||[]).map((r,i)=>['guard-'+i,r])]) {
    const f=failurePoint(r);if(f)return {path,...f};
  }
  return null;
}
export function functionalReasons(before,after) {
  return [['baseline',before],['candidate',after]].flatMap(([label,r])=>!r?[`Independent functional ${label}: missing (not executed)`]:r.verdict==='VERIFIED_PASS'?[]:[`Independent functional ${label}: ${r.verdict==='VERIFIED_FAIL'?'failed':'inconclusive'}${failurePoint(r)?' · '+failurePoint(r).summary:''}`]);
}
export function comparisonCheckpoint(before,after) {
  const failed=failurePoint(after);if(failed)return failed.step;
  const common=(after?.checkpoints||[]).filter(cp=>before?.checkpoints?.some(b=>b.id===cp.id));
  const baselineFailure=failurePoint(before);
  const chosen=(baselineFailure&&common.find(cp=>cp.id===checkpointId(baselineFailure.step)))||common.at(-1);
  return chosen?.id.startsWith('step-')?Number(chosen.id.slice(5))+1:0;
}
export function attemptReasons(run,a) {
  if(!a)return ['Candidate verification was not executed.'];
  if(!a.after&&!a.functionalAfter)return [`Not run in a browser · ${a.category||'STOPPED'}: ${a.failure||'no candidate reached verification'}`];
  const reasons=[a.failure,...a.verification?.reasons||[],...a.verification?.uncertain||[]].filter(Boolean);
  const specific=[failurePoint(a.after)?.summary,failurePoint(a.functionalAfter)?.summary].filter(Boolean);
  const legacy='Functional regression baseline/replay failed or missing';
  const keyboardFailure=failurePoint(a.after),functionalFailure=failurePoint(a.functionalAfter);
  const clean=reasons.filter(r=>r!==legacy && !(specific.length&&['Exact journey did not complete after repair','Task evidence is missing or contradicts the verdict'].includes(r)) && !(keyboardFailure&&r.startsWith('Keyboard candidate:')) && !(functionalFailure&&(r.startsWith('Independent functional candidate:')||r==='Functional output changed')));
  const functional=functionalReasons(run.functionalBefore,a.functionalAfter).filter(r=>!(functionalFailure&&r.startsWith('Independent functional candidate:'))).map(r=>{
    const summary=failurePoint(a.functionalAfter)?.summary;
    return summary&&r.startsWith('Independent functional candidate:')?r.replace(' · '+summary,''):r;
  });
  return [...new Set([...specific,...functional,...clean])];
}
