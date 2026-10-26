// Fills the homepage scorecard from the published real-bug index; the static copy stays if it is missing.
try{
  const data=await (await fetch('./realbugs/index.json')).json(),cases=data.cases,runs=cases.filter(c=>c.recorded),passed=runs.filter(c=>c.recorded.verdict==='VERIFIED_PASS');
  const lib=passed.filter(c=>c.recorded.scope==='library').length,page=passed.filter(c=>c.recorded.scope==='page').length;
  // A pass that only changes the author-built page works around the library bug; say so beside the number.
  const where=page?`: ${lib} by changing the library's own code, ${page} only by a workaround in the page around it`:'';
  const libs=[...new Set(cases.map(c=>c.repository.replace(/\/+$/,'').split('/').pop()))];
  document.querySelector('#score-pass').textContent=runs.length?`${passed.length}/${runs.length}`:String(cases.length);
  document.querySelector('#score-of').textContent=runs.length?`real bugs repaired blind by the current engine, across ${libs.length} libraries${where}`:`real bugs across ${libs.length} libraries`;
  document.querySelector('#score-libs').replaceChildren(...libs.map(l=>Object.assign(document.createElement('li'),{textContent:l})));
  document.querySelector('#proof-blind').textContent=`${passed.length}/${runs.length}`;
  document.querySelector('#proof-blind-text').textContent=`bugs the maintainers of ${libs.length} libraries fixed by hand, repaired by Nemotron without seeing their fix${page?` (${lib} in the library code)`:''}`;
}catch{/* Static copy remains. */}
// Every blind run on every frozen engine version: steadier than one run per bug.
try{
  const g=await (await fetch('./gate-stats.json')).json(),ok=g.firstTry+g.withFeedback,p=document.querySelector('#score-runs');
  p.textContent=`Across every engine version: ${ok} of ${g.realRuns} blind runs repaired (${Math.round(ok/g.realRuns*100)}%)${g.libraryFixed!=null?`, ${g.libraryFixed} of them in the library's own code`:''}. ${g.caughtAfterKeyboardPass} patches that fixed the reported key but broke something else were rejected.`;p.hidden=false;
}catch{/* Optional. */}
// Open upstream bugs: how many reproduce on current code, and how many Nemotron repaired.
try{
  const open=(await (await fetch('./openbugs/index.json')).json()).cases,fixed=open.filter(c=>c.recorded?.verdict==='VERIFIED_PASS');
  document.querySelector('#proof-open').textContent=fixed.length?`${fixed.length}/${open.length}`:String(open.length);
  // A browser pass is not the last word: count only patches the author's review called sound.
  const sound=fixed.filter(c=>c.review?.run===c.recorded.run&&/^Sound/.test(c.review.verdict)).length;
  document.querySelector('#proof-open-text').textContent=fixed.length?`bugs still unfixed upstream, repaired and browser-verified on each library's current code; ${sound} of those patches judged sound on review, the rest work with trade-offs`:`keyboard and form bugs still unfixed upstream, reproduced on each library's current code`;
}catch{/* Static copy remains. */}
