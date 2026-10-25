import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '../src/catalog.js';
import { json, listFiles, readJson } from '../src/files.js';
import { digest } from '../src/schema.js';
import { verifyProof } from '../src/proof.js';
import { proofArchive } from '../src/archive.js';
import { liveCases, humanPatch } from '../src/live.js';

// Publishes recorded runs as a read-only, backend-free evidence bundle under public/evidence.
// Every copied artifact must match its run manifest hash; run.json is a reduced, path-sanitized view.
const runs = path.join(ROOT, 'artifacts', 'runs'), out = path.join(ROOT, 'public', 'evidence');
const r = (id, label, extra = {}) => ({ id, label, ...extra });
const groups = [
 { title: 'GOV.UK autocomplete · final contract (markup-independent)', summary: 'Same task with the options pretty-printed the way server templates often emit them, plus a third guard: saving without editing must keep both saved countries. The previous final repair erased them and is rejected. A new Nemotron Ultra run passes every gate; three of four withheld checks pass, and the fourth is a recorded FAIL explained in the history.',
  runs: [r('c3158127-dba3-43b3-8dcc-981dc00e071f', 'Final Nemotron Ultra repair (attempt 1 rejected by guards, attempt 2 verified)', { attempt: 2, proof: true }), r('b9223625-8d8c-42f4-be52-c11aa95d3422', 'Previous final repair rejected: untouched save erases both countries', { proof: true }), r('537fabba-1354-4946-8bb8-f3641dc5b88b', 'Guarded repair rejected'), r('0cf6e4b4-677b-4839-860f-60a0c96c7775', 'Withheld: single-line page'), r('ed4b61c6-3c4a-4b84-8a5d-1e5a9aa1c9eb', 'Withheld: clear shipping'), r('6b8be951-29ac-45df-8aaa-379293b5f68b', 'Withheld: clear billing'), r('67e901e9-00ef-43bd-8ca4-27d422ed179d', 'Withheld: unlisted and blank (recorded FAIL; component shows Germany)')] },
 { title: 'Pikaday · daylight-saving week jump', summary: 'In Europe/London, ArrowDown from Friday 23 October 2026 selected Thursday 29 October. Nemotron Super switched the component to calendar-day arithmetic; six withheld UTC, London and closed-range checks pass.',
  runs: [r('cbb88e80-22b1-481b-a774-0d7dea9486f3', 'Nemotron Super · calendar-day arithmetic', { attempt: 2, proof: true }), r('e211fc5c-5553-4c01-acf6-80a865ffb891', 'Nemotron Ultra · rewritten preimages rejected; local ceiling stopped attempt 3'), r('38bb7c9f-7385-4170-ab7a-57d9ef79f1a6', 'Withheld: UTC forward'), r('8572d4e8-fff9-47c9-92d2-ff6a9d00b181', 'Withheld: UTC backward'), r('83c2bc19-69dc-4c53-911d-da39dd7a1954', 'Withheld: London forward'), r('397c4bac-572a-4e0a-9ede-30c1e290e702', 'Withheld: London backward'), r('a18bb581-77a2-4f9b-84cc-33ef841243e9', 'Withheld: closed range boundary')] },
 { title: 'Pikaday · closed weekends and closed range', summary: 'ArrowRight from Friday selected closed Saturday. Super repaired it; an author-added closed-range variant exposed a remaining flaw that a separate model run fixed.',
  runs: [r('65c8e7d5-3d35-41c7-a80f-3696a6273451', 'Nemotron Super · weekend skipping', { attempt: 2, proof: true }), r('770f858a-7b0a-42a1-94b3-132c4cc0c1b6', 'Same patch: precommitted reverse task'), r('459ef2eb-1518-4c98-bfb7-139912015c20', 'Nemotron Super · closed-range follow-up', { attempt: 3, proof: true }), r('374ef458-3f62-4074-8691-c476d43c863f', 'Final component: forward task'), r('eae53cc0-c0d8-48e9-be14-cf64478b3f55', 'Final component: backward task'), r('fef8da72-c446-4116-b69c-fc0c2c655472', 'Ultra request timed out'), r('5b0c2db0-6309-435d-8362-ca223ff2f672', 'Stopped before inference: model-context limit')] },
 { title: 'GOV.UK autocomplete · implicit submission', summary: 'An unlisted shipping country and a billing field cleared and submitted with Enter must both save no country. Two regression guards must keep passing. Earlier model patches are replayed against this gate; an Ultra repair passed it and three withheld checks, but a later reviewer probe showed it erased saved countries when options are pretty-printed (see the markup-independent contract).',
  runs: [r('bea9de3c-28dd-43a1-8777-c3b1a23ba7c9', 'Nemotron Ultra repair · passed this gate; later rejected by the markup gate', { attempt: 2, proof: true }), r('0b341dc4-5c54-44e8-9750-a8c5a504e2dc', 'Withheld: clear shipping'), r('d5fa5759-20ae-45b9-87f0-971981dfe816', 'Withheld: clear billing'), r('797b82c8-cfdf-4975-b243-db48350fc49b', 'Withheld: unlisted and blank countries'), r('a7653c03-77af-424a-ad1a-776455fedf22', 'Earlier Ultra patch rejected: Enter inside the field still sends de', { proof: true }), r('cd8d9040-155d-498b-a3fd-7b94e872c994', 'First model patch rejected: unlisted country still sends gb')] },
 { title: 'GOV.UK autocomplete · regression guards', summary: 'Guards: a partial match confirmed on blur still saves France, and a plain (non-select) autocomplete on the same page keeps working. Three earlier model patches are replayed and rejected; two new model runs fail; Ultra then passes every gate.',
  runs: [r('1d5036c9-3c31-436b-821a-8dacf8fb6ebb', 'Model patch that passed its own task, rejected by both guards', { proof: true }), r('0fcd838c-1959-4671-a14c-f63c526658bd', 'First model patch rejected: unlisted country still sends gb'), r('78893b29-e3dd-404c-9f3e-d6d23c14c73d', 'Model patch rejected: blank billing still sends de'), r('b768fc2e-5f12-4962-9bb6-d46d64f6bdf6', 'Nemotron Super · three rejected proposals'), r('63c909d4-7acb-46f4-839e-fc42c0aee73a', 'Nemotron Ultra · two truncated outputs, one rejected patch'), r('7746b726-e0f2-4bc0-90a9-7b9b47b73203', 'Nemotron Ultra · verified through the public onConfirm option', { attempt: 1, proof: true }), r('8ddb2160-2cbf-4960-b51a-a470e0386a3d', 'Withheld: clear shipping'), r('b183ec79-9f35-43d3-ac1a-eac8185bc25f', 'Withheld: clear billing')] },
 { title: 'GOV.UK autocomplete · unlisted and blank entries', summary: 'The first strengthening after independent review. Super produced three rejected proposals, then a component patch that passed its task but failed a withheld partial-match check.',
  runs: [r('a66884e3-0c53-4bc9-8703-d0e06a4d43ca', 'Nemotron Super · invalid fields, runtime errors, blank matched the empty option'), r('2b863464-168d-4a1c-8fd6-6685b7bc3a45', 'Nemotron Super · passed its task; later rejected by a withheld check', { attempt: 2 }), r('98988a04-01ec-4124-8c48-5ea4be054a66', 'Withheld: clear shipping'), r('ae1534ec-36a4-4d2b-83b2-cdf0199dbb8d', 'Withheld: clear billing')] },
 { title: 'GOV.UK autocomplete · first repair (clearing only)', summary: 'The original case: clearing a saved country kept gb. One Ultra call repaired it; a precommitted billing task passed; a human wrong-country variant was rejected by the independent pointer path.',
  runs: [r('d2eb947c-deed-44c9-9381-b444438a5c11', 'Nemotron Ultra · first repair', { attempt: 1, proof: true }), r('12b01ae9-a19c-4d84-b4dc-acc3a1da82d0', 'Same patch: precommitted billing task'), r('050ef18e-84ea-4891-b43a-f1d1f41698a4', 'Human negative control: visible France, form code gb')] },
 { title: 'MicroModal · hidden-node focus routing', summary: 'Earlier case on MicroModal #295 with a published human patch and model repairs.',
  runs: [r('99e589ff-42bc-4bd0-b9f9-0b66aa1432db', 'Nemotron repair'), r('2d7de911-90df-47ae-a9dd-4e0a36d2c206', 'Nemotron repair · CSS-hidden retry'), r('120c8bdb-63d5-4577-aa8b-afdab144aeff', 'Published human patch vs author-added control'), r('56a72234-ccfe-4c02-b6b3-897db6d0f245', 'Human reference replay'), r('cc7af68a-ac2e-46cc-bf1d-04f48978a521', 'Human reference replay (rejected)')] }
];
const textFile = /\.(json|patch|md)$/;
const keep = file => !/^candidate-/.test(file) && !/\.(dom\.html|ax\.json|axe\.json|aria\.yml|focus\.json)$/.test(file) && file !== 'provenance.json' && !file.endsWith('/result.json') && (file.endsWith('.png') || !file.includes('/'));
const credential = /(?:Bearer\s+[A-Za-z0-9._-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|v1\.[A-Za-z0-9_-]{60,}\.[A-Za-z0-9_-]{30,})/;
// Reduced journey result: the viewer needs captures, focus and assertions, not DOM inventories.
const slim = result => result && {
 ...result,
 checkpoints: result.checkpoints?.map(c => ({ id: c.id, screenshot: c.screenshot, state: { focus: c.state?.focus && { selector: c.state.focus.selector, tag: c.state.focus.tag, bbox: c.state.focus.bbox }, dialogs: c.state?.dialogs }, axe: c.axe && { violations: c.axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })) } })),
 steps: result.steps?.map(s => ({ ...s, before: s.before && { selector: s.before.selector }, after: s.after && { selector: s.after.selector } })),
 focusGraph: result.focusGraph && { findings: result.focusGraph.findings, note: result.focusGraph.note }
};
const slimAll = list => list?.map(slim);
const sanitize = text => text.split(ROOT.replaceAll('\\', '\\\\')).join('.').split(ROOT.replaceAll('\\', '/')).join('.').split(ROOT).join('.');

// Real-bug benchmark: every recorded blind run, plus the case list and maintainers' diffs for the live page.
const realbugs = await liveCases(), realbugsOut = path.join(ROOT, 'public', 'realbugs');
await fs.rm(realbugsOut, { recursive: true, force: true });
for (const c of realbugs) { await fs.mkdir(path.join(realbugsOut, c.id), { recursive: true }); await fs.writeFile(path.join(realbugsOut, c.id, 'human.patch'), await humanPatch(c.id)); }
await json(path.join(realbugsOut, 'index.json'), { generatedAt: new Date().toISOString(), enabled: false, cases: realbugs });
const recordedRealbugs = realbugs.filter(c => c.recorded);
if (recordedRealbugs.length) groups.unshift({ title: 'Real upstream bugs · blind Nemotron runs', summary: "Each library is pinned just before a published maintainer fix. The maintainers' fix passes the frozen task; Nemotron gets only the buggy source, Super first and Ultra after a rejection.",
 runs: recordedRealbugs.map(c => r(c.recorded.run, `${c.library} · ${c.title}`, { ...(c.recorded.passedOn ? { attempt: c.recorded.passedOn } : {}), proof: true })) });
await fs.rm(path.join(out, 'runs'), { recursive: true, force: true });
const index = { generatedAt: new Date().toISOString(), note: 'Read-only published evidence. Screenshots, plans, diffs and raw model requests/responses are byte-identical to the run manifests. run.json is a reduced, path-sanitized view; complete archives are attached where marked.', groups: [] };
let bytes = 0;
for (const group of groups) {
 const entries = [];
 for (const item of group.runs) {
  const dir = path.join(runs, item.id), proof = await verifyProof(dir);
  if (!proof.pass) throw new Error(`Proof integrity failed for ${item.id}`);
  const run = await readJson(path.join(dir, 'run.json')), manifest = await readJson(path.join(dir, 'manifest.json')), target = path.join(out, 'runs', item.id);
  for (const file of await listFiles(dir)) {
   if (!keep(file)) continue;
   const buffer = await fs.readFile(path.join(dir, file));
   if (file !== 'manifest.json' && file !== 'run.json' && manifest.files[file] !== digest(buffer)) throw new Error(`Manifest mismatch ${item.id}/${file}`);
   if (file === 'run.json') continue;
   if (textFile.test(file) && credential.test(buffer.toString('utf8'))) throw new Error(`Credential-like text in ${item.id}/${file}`);
   await fs.mkdir(path.dirname(path.join(target, file)), { recursive: true }); await fs.writeFile(path.join(target, file), buffer); bytes += buffer.length;
  }
  const view = { ...run, before: slim(run.before), after: slim(run.after), functionalBefore: slim(run.functionalBefore), functionalAfter: slim(run.functionalAfter), ...(run.guardsBefore ? { guardsBefore: slimAll(run.guardsBefore) } : {}),
   attempts: run.attempts.map(a => ({ ...a, after: slim(a.after), functionalAfter: slim(a.functionalAfter), ...(a.guardsAfter ? { guardsAfter: slimAll(a.guardsAfter) } : {}) })),
   evidenceView: { reduced: true, removed: ['checkpoint DOM inventories', 'axe pass lists', 'focus event logs'], proof: !!item.proof } };
  const text = sanitize(JSON.stringify(view));
  if (/C:[\\/]+Users|chinh/i.test(text) || credential.test(text)) throw new Error(`Local path or credential in ${item.id}/run.json`);
  await fs.writeFile(path.join(target, 'run.json'), text); bytes += text.length;
  if (item.proof) { const archive = await proofArchive(dir, manifest); await fs.writeFile(path.join(target, 'proof.tar.gz'), archive); bytes += archive.length; }
  const models = [...new Set(run.attempts.map(a => a.provenance?.model).filter(Boolean))];
  entries.push({ id: item.id, label: item.label, attempt: item.attempt, verdict: run.verification?.verdict || 'NOT_TESTED',
   execution: run.mode === 'nebius' ? `${run.attempts.length} Nemotron proposal${run.attempts.length > 1 ? 's' : ''} · ${models.join(', ') || 'no response'}` : run.source?.execution === 'fresh-browser-recheck' ? 'browser-only recheck · no inference' : 'human-supplied candidate · no inference',
   rootHash: manifest.rootHash, proofArchive: !!item.proof });
 }
 index.groups.push({ ...group, runs: entries });
}
await json(path.join(out, 'index.json'), index);
console.log(JSON.stringify({ runs: index.groups.reduce((n, g) => n + g.runs.length, 0), megabytes: +(bytes / 1e6).toFixed(1) }));
