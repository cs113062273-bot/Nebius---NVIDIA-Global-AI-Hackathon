import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { RepairPlan, digest } from './schema.js';
import { contained, listFiles } from './files.js';
import { checkedDiff } from './diff.js';

const allowedExtensions = new Set(['.html','.css','.js','.jsx','.tsx','.ts']);
export function allowedSource(file) {
  return !file.split('/').some(p => p.startsWith('.') || /^(node_modules|vendor|dist|build|scripts|tests|secrets|credentials)$/i.test(p)) && allowedExtensions.has(path.extname(file)) && !/(^|\/)(package|lock|config|next\.config|vite\.config)/i.test(file);
}
export async function localize(root, evidence) {
  const terms = new Set();
  for (const step of evidence.steps) { if(step.action.selector) terms.add(step.action.selector.replace(/^[#.]/,''));for(const a of step.assertions||[])if(a.assertion?.selector)terms.add(a.assertion.selector.replace(/^[#.]/,'')); }
  for(const cp of evidence.checkpoints)if(cp.state.focus?.selector)terms.add(cp.state.focus.selector.replace(/^[#.]/,''));
  for (const cp of evidence.checkpoints) for (const node of cp.state.nodes) if(node.nameHint) terms.add(node.nameHint);
  const candidates = [],sources=new Map();
  for(const file of await listFiles(root)) {
    if(!allowedSource(file)) continue;
    const p = await contained(root,file), st = await fs.stat(p); if(st.size > 60000) continue;
    const source = await fs.readFile(p,'utf8');
    sources.set(file,source);
    const matches = [...terms].filter(t=>t.length>1 && source.includes(t));
    if(matches.length) candidates.push({path:file,score:matches.length,signals:matches.slice(0,12),sha256:digest(source),source});
  }
  // Follow local runtime dependencies: component internals rarely contain the
  // consumer's selectors. Never execute code or resolve third-party packages.
  const queue=[...candidates];
  for(let i=0;i<queue.length&&i<12;i++){
    const from=queue[i];
    const imports=[...from.source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*|src\s*=\s*)['"]([^'"]+)['"]/g)];
    for(const match of imports){
      const specifier=match[1].split(/[?#]/)[0];if(/^(?:[a-z]+:|\/\/|\/)/i.test(specifier))continue;
      const file=path.posix.normalize(path.posix.join(path.posix.dirname(from.path),specifier));
      if(!sources.has(file)||candidates.some(c=>c.path===file))continue;
      const source=sources.get(file),candidate={path:file,score:Math.max(1,from.score-.5),signals:['Imported runtime dependency of '+from.path],sha256:digest(source),source};
      candidates.push(candidate);queue.push(candidate);
    }
  }
  return candidates.sort((a,b)=>b.score-a.score).slice(0,5);
}
export async function referencePlan(beforeRoot, referenceRoot) {
  const edits = [];
  for (const file of await listFiles(beforeRoot)) {
    if(!allowedSource(file)) continue;
    const before = await fs.readFile(await contained(beforeRoot,file),'utf8'), after = await fs.readFile(await contained(referenceRoot,file),'utf8');
    if(before === after) continue;
    // Trim unchanged prefix/suffix to make the review diff minimal, without guessing semantics.
    let start=0,end=0;while(start<before.length && start<after.length && before[start]===after[start])start++;
    while(end<before.length-start && end<after.length-start && before[before.length-1-end]===after[after.length-1-end])end++;
    let old=before.slice(start,before.length-end), replacement=after.slice(start,after.length-end);
    // Pure insertions need context; ambiguous matches expand to a whole line/file preimage.
    if(!old || before.split(old).length!==2) { old=before;replacement=after; }
    edits.push({path:file,sha256:digest(before),before:old,after:replacement});
  }
  return RepairPlan.parse({root_cause:'Reference source supplied by fixture author; no model diagnosis.',repair_strategy:'Replay a known reference patch to exercise the deterministic verifier.',edits,expected_accessibility_effect:'Restore the seeded keyboard path.',functional_risks:['The reference patch can still fail verification.'],verification_requirements:['Replay the frozen keyboard journey and pointer functional baseline.']});
}
// Models sometimes double-escape newlines inside JSON strings or drop the source's CRLF.
// Each fallback is a deterministic re-encoding of the same text and must still match exactly once.
const unescapeJson = text => text.replace(/\\(\\|n|r|t|"|')/g, (_, c) => ({ n: '\n', r: '\r', t: '\t' })[c] ?? c);
export function resolvePreimage(current, before, after) {
  const unique = text => current.split(text).length === 2, crlf = current.includes('\r\n');
  const eol = text => text.replace(/\r*\n/g, crlf ? '\r\n' : '\n');
  const variants = [['as-written', before, after]];
  if (!before.includes('\n') && /\\[nrt]/.test(before)) variants.push(['escaped-newlines', unescapeJson(before), unescapeJson(after)]);
  for (const [label, b, a] of variants) {
    if (unique(b)) return { before: b, after: a, normalization: label === 'as-written' ? null : label };
    if (unique(eol(b))) return { before: eol(b), after: eol(a), normalization: label === 'as-written' ? 'line-endings' : label + '+line-endings' };
  }
  // Last resort: the same lines with only their surrounding whitespace misremembered. The whole
  // line sequence must occur exactly once; unchanged lines keep the source's own indentation.
  for (const [label, b, a] of variants) {
    const block = indentInsensitive(current, b, a, crlf);
    if (block) return { ...block, normalization: (label === 'as-written' ? '' : label + '+') + 'indentation' };
  }
  throw new Error('Patch preimage must match exactly once');
}
function indentInsensitive(current, before, after, crlf) {
  const want = before.split(/\r*\n/), trimmed = want.map(l => l.trim());
  while (trimmed.length && !trimmed[0]) { trimmed.shift(); want.shift(); }
  while (trimmed.length && !trimmed.at(-1)) { trimmed.pop(); want.pop(); }
  if (trimmed.filter(Boolean).length < 2) return null;
  const lines = current.split('\n'), clean = lines.map(l => l.replace(/\r$/, '')), starts = [];
  for (let i = 0, offset = 0; i < lines.length; offset += lines[i].length + 1, i++) starts.push(offset);
  const hits = [];
  for (let i = 0; i + trimmed.length <= clean.length && hits.length < 2; i++) if (trimmed.every((t, k) => clean[i + k].trim() === t)) hits.push(i);
  if (hits.length !== 1) return null;
  const at = hits[0], source = clean.slice(at, at + trimmed.length), lead = l => l.match(/^\s*/)[0];
  const known = new Map(want.map((l, k) => [l, source[k]]));
  let shift = null;
  const rewritten = after.split(/\r*\n/).map(l => {
    if (known.has(l)) { shift = [lead(l), lead(known.get(l))]; return known.get(l); }
    return shift && l.startsWith(shift[0]) ? shift[1] + l.slice(shift[0].length) : l;
  });
  return { before: source.join(crlf ? '\r\n' : '\n'), after: rewritten.join(crlf ? '\r\n' : '\n') };
}
export async function applyPlan(root, rawPlan, allowedFiles) {
  const plan = RepairPlan.parse(rawPlan), staged = new Map(), normalizations = []; let changed = 0, size=0;
  for(const edit of plan.edits) {
    if(!allowedSource(edit.path) || !allowedFiles.includes(edit.path)) throw new Error('Edit outside localized allowlist');
    const file = await contained(root,edit.path);
    const original = await fs.readFile(file,'utf8');
    if(digest(original)!==edit.sha256) throw new Error('Stale source preimage');
    const current = staged.get(file)?.after ?? original;
    const resolved = resolvePreimage(current, edit.before, edit.after);
    if(resolved.normalization) normalizations.push({path:edit.path,normalization:resolved.normalization});
    const after = current.replace(resolved.before,()=>resolved.after);
    size += Math.abs(after.length-current.length) + resolved.before.length + resolved.after.length;
    if(size>40000 || after.length>80000 || staged.size>=5 && !staged.has(file)) throw new Error('Patch scope exceeds bounds');
    staged.set(file,{path:edit.path,before:original,after});
  }
  const changes = [...staged.values()].filter(v=>v.before!==v.after);
  if(!changes.length) throw new Error('No-op patch');
  // Validate every preimage before any write. Only disposable copies are accepted by the orchestrator.
  for(const [file,value] of staged) await fs.writeFile(file,value.after);
  changed=changes.length;
  const result = await checkedDiff(changes);
  if(normalizations.length) result.patchValidation = {...result.patchValidation, normalizations};
  return result;
}
export async function applyReference(root, referenceRoot, {staticProject=false,runtimeOnly=false}={}) {
  const names=new Set([...await listFiles(root),...await listFiles(referenceRoot)]),changes=[];
  for(const file of names){
    if(!staticProject&&(!allowedSource(file)||runtimeOnly&&!file.endsWith('.js')))continue;
    const read=async dir=>fs.readFile(await contained(dir,file,{existing:false})).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    const before=await read(root),after=await read(referenceRoot);
    if(before===null&&after===null||before!==null&&after!==null&&before.equals(after))continue;
    changes.push({path:file,before,after});
  }
  if(!changes.length)throw new Error('No source changes in edited version');
  const result=await checkedDiff(changes);
  for(const c of changes){const file=await contained(root,c.path,{existing:false});if(c.after===null)await fs.unlink(file);else{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,c.after);}}
  return result;
}
export async function buildStatic(root) {
  const checks=[];
  for(const file of await listFiles(root)) {
    if(file.endsWith('.js')) {
      try { new vm.Script(await fs.readFile(await contained(root,file),'utf8'), {filename:file}); checks.push({file,pass:true,kind:'syntax'}); }
      catch(error) {
        // Parse ESM without importing or executing the application's code.
        const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:await fs.readFile(await contained(root,file),'utf8'),encoding:'utf8',timeout:5000,windowsHide:true,maxBuffer:20000,env:{}});
        checks.push({file,pass:result.status===0,kind:'syntax',...(result.status===0?{}:{message:'JavaScript syntax check failed'})});
      }
    }
    if(file.endsWith('.html')) {
      const html = await fs.readFile(await contained(root,file),'utf8');
      checks.push({file,pass:/<!doctype html>/i.test(html) && /<html[\s>]/i.test(html) && /<body[\s>]/i.test(html),kind:'document-structure'});
    }
  }
  return {pass:checks.length>0 && checks.every(c=>c.pass),checks,scope:'Static HTML structure and JavaScript syntax (classic or ESM) only; no framework compilation claim.'};
}
