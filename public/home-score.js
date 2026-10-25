// Fills the homepage scorecard from the published real-bug index; the static copy stays if it is missing.
try{
  const data=await (await fetch('./realbugs/index.json')).json(),cases=data.cases,runs=cases.filter(c=>c.recorded),passed=runs.filter(c=>c.recorded.verdict==='VERIFIED_PASS');
  const libs=[...new Set(cases.map(c=>c.repository.replace(/\/+$/,'').split('/').pop()))];
  document.querySelector('#score-pass').textContent=runs.length?`${passed.length}/${runs.length}`:String(cases.length);
  document.querySelector('#score-of').textContent=runs.length?`real bugs repaired blind, across ${libs.length} libraries`:`real bugs across ${libs.length} libraries`;
  document.querySelector('#score-libs').replaceChildren(...libs.map(l=>Object.assign(document.createElement('li'),{textContent:l})));
  document.querySelector('#proof-blind').textContent=`${passed.length}/${runs.length}`;
  document.querySelector('#proof-blind-text').textContent=`bugs the maintainers of ${libs.length} libraries fixed by hand, repaired by Nemotron without seeing their fix`;
}catch{/* Static copy remains. */}
// Open upstream bugs: how many reproduce on current code, and how many Nemotron repaired.
try{
  const open=(await (await fetch('./openbugs/index.json')).json()).cases,fixed=open.filter(c=>c.recorded?.verdict==='VERIFIED_PASS');
  document.querySelector('#proof-open').textContent=fixed.length?`${fixed.length}/${open.length}`:String(open.length);
  document.querySelector('#proof-open-text').textContent=fixed.length?`bugs still unfixed upstream, repaired and browser-verified on each library's current code`:`keyboard and form bugs still unfixed upstream, reproduced on each library's current code`;
}catch{/* Static copy remains. */}
