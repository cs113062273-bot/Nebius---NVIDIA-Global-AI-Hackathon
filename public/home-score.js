// Fills the homepage scorecard from the published real-bug index; the static copy stays if it is missing.
try{
  const data=await (await fetch('./realbugs/index.json')).json(),cases=data.cases,runs=cases.filter(c=>c.recorded),passed=runs.filter(c=>c.recorded.verdict==='VERIFIED_PASS');
  const libs=[...new Set(cases.map(c=>c.repository.replace(/\/+$/,'').split('/').pop()))];
  document.querySelector('#score-pass').textContent=runs.length?`${passed.length}/${runs.length}`:String(cases.length);
  document.querySelector('#score-of').textContent=runs.length?`real bugs repaired blind, across ${libs.length} libraries`:`real bugs across ${libs.length} libraries`;
  document.querySelector('#score-libs').replaceChildren(...libs.map(l=>Object.assign(document.createElement('li'),{textContent:l})));
}catch{/* Static copy remains. */}
