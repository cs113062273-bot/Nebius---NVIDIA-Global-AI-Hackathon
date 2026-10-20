import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { RepairPlan, digest } from './schema.js';
import { contained, listFiles } from './files.js';

const allowedExtensions = new Set(['.html','.css','.js','.jsx','.tsx','.ts']);
export function allowedSource(file) {
  return !file.split('/').some(p => p.startsWith('.') || /^(node_modules|vendor|dist|build|scripts|tests|secrets|credentials)$/i.test(p)) && allowedExtensions.has(path.extname(file)) && !/(^|\/)(package|lock|config|next\.config|vite\.config)/i.test(file);
}
export async function localize(root, evidence) {
  const terms = new Set();
  for (const step of evidence.steps) { if(step.action.selector) terms.add(step.action.selector.replace(/^[#.]/,'')); }
  for (const cp of evidence.checkpoints) for (const node of cp.state.nodes) if(node.nameHint) terms.add(node.nameHint);
  const candidates = [];
  for(const file of await listFiles(root)) {
    if(!allowedSource(file)) continue;
    const p = await contained(root,file), st = await fs.stat(p); if(st.size > 60000) continue;
    const source = await fs.readFile(p,'utf8');
    const matches = [...terms].filter(t=>t.length>1 && source.includes(t));
    if(matches.length) candidates.push({path:file,score:matches.length,signals:matches.slice(0,12),sha256:digest(source),source});
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
export async function applyPlan(root, rawPlan, allowedFiles) {
  const plan = RepairPlan.parse(rawPlan), staged = new Map(); let changed = 0, size=0;
  for(const edit of plan.edits) {
    if(!allowedSource(edit.path) || !allowedFiles.includes(edit.path)) throw new Error('Edit outside localized allowlist');
    const file = await contained(root,edit.path);
    const original = await fs.readFile(file,'utf8');
    if(digest(original)!==edit.sha256) throw new Error('Stale source preimage');
    const current = staged.get(file)?.after ?? original;
    if(current.split(edit.before).length!==2) throw new Error('Patch preimage must match exactly once');
    const after = current.replace(edit.before,()=>edit.after);
    size += Math.abs(after.length-current.length) + edit.before.length + edit.after.length;
    if(size>40000 || after.length>80000 || staged.size>=5 && !staged.has(file)) throw new Error('Patch scope exceeds bounds');
    staged.set(file,{path:edit.path,before:original,after});
  }
  const changes = [...staged.values()].filter(v=>v.before!==v.after);
  if(!changes.length) throw new Error('No-op patch');
  // Validate every preimage before any write. Only disposable copies are accepted by the orchestrator.
  for(const [file,value] of staged) await fs.writeFile(file,value.after);
  changed=changes.length;
  const patch = changes.map(c=>`--- a/${c.path}\n+++ b/${c.path}\n@@ -1,${c.before.split('\n').length} +1,${c.after.split('\n').length} @@\n${c.before.split('\n').map(l=>'-'+l).join('\n')}\n${c.after.split('\n').map(l=>'+'+l).join('\n')}\n`).join('');
  return {changed,changes:changes.map(c=>({path:c.path,beforeHash:digest(c.before),afterHash:digest(c.after)})),patch};
}
export async function buildStatic(root) {
  const checks=[];
  for(const file of await listFiles(root)) {
    if(file.endsWith('.js')) {
      try { new vm.Script(await fs.readFile(await contained(root,file),'utf8'), {filename:file}); checks.push({file,pass:true,kind:'syntax'}); }
      catch(error) { checks.push({file,pass:false,kind:'syntax',message:error.message}); }
    }
    if(file.endsWith('.html')) {
      const html = await fs.readFile(await contained(root,file),'utf8');
      checks.push({file,pass:/<!doctype html>/i.test(html) && /<html[\s>]/i.test(html) && /<body[\s>]/i.test(html),kind:'document-structure'});
    }
  }
  return {pass:checks.length>0 && checks.every(c=>c.pass),checks,scope:'Static HTML structure and classic JavaScript syntax only; no framework compilation claim.'};
}
