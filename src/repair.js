import { stripTypeScriptTypes } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { RepairPlan, digest } from './schema.js';
import { contained, listFiles } from './files.js';
import { checkedDiff } from './diff.js';

const allowedExtensions = new Set(['.html','.css','.js','.jsx','.tsx','.ts']);
export function allowedSource(file) {
  // Directory names are matched whole, and only build-tool configs (vite.config.js and the like) are
  // excluded by file name. A prefix match here once hid packages/** and util/config.js from every repair.
  return !file.split('/').some(p => p.startsWith('.') || /^(node_modules|vendor|dist|build|scripts|tests|secrets|credentials)$/i.test(p)) && allowedExtensions.has(path.extname(file)) && !/\.config\.[cm]?[jt]s$/i.test(path.posix.basename(file));
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
      // Resolve like a browser import map or bundler would: as written, extensionless, TypeScript or index.
      const base=path.posix.normalize(path.posix.join(path.posix.dirname(from.path),specifier));
      const file=[base,base+'.js',base+'.ts',base.endsWith('.js')?base.slice(0,-3)+'.ts':null,base+'/index.js',base+'/index.ts'].find(f=>f&&sources.has(f));
      if(!file||candidates.some(c=>c.path===file))continue;
      const source=sources.get(file),candidate={path:file,score:Math.max(1,from.score-.5),signals:['Imported runtime dependency of '+from.path],sha256:digest(source),source};
      candidates.push(candidate);queue.push(candidate);
    }
  }
  // Component internals sit several imports deep, so keep up to ten files within a fixed source budget.
  const kept=[];let chars=0;
  for(const c of candidates.sort((a,b)=>b.score-a.score)){if(kept.length>=10||chars+c.source.length>120000)continue;kept.push(c);chars+=c.source.length;}
  return kept;
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
  for (const [label, b, a] of variants) {
    const block = contextTolerant(current, b, a, crlf);
    if (block) return { ...block, normalization: (label === 'as-written' ? '' : label + '+') + 'context-lines' };
  }
  for (const [label, b, a] of variants) {
    const block = hunkTolerant(current, b, a, crlf);
    if (block) return { ...block, normalization: (label === 'as-written' ? '' : label + '+') + 'hunks' };
  }
  throw new Error('Patch preimage must match exactly once');
}
// Line-level LCS: the pairs (i, j) of equal items, in order.
function lcsPairs(a, b, eq) {
  const n = a.length, m = b.length, t = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = eq(a[i], b[j]) ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const out = []; for (let i = 0, j = 0; i < n && j < m;) { if (eq(a[i], b[j])) { out.push([i, j]); i++; j++; } else if (t[i + 1][j] >= t[i][j + 1]) i++; else j++; }
  return out;
}
// Like `patch` with fuzz, but stricter. The model's before -> after diff is applied hunk by hunk to
// the file's real region: lines it deletes must exist verbatim (ignoring surrounding whitespace) and
// contiguously; context it misremembered, invented or left out stays exactly as the file has it.
// Refused when the region is not unique, when too little of before is found, or when an insertion
// point falls between file lines the model never saw.
function hunkTolerant(current, before, after, crlf) {
  const want = before.split(/\r*\n/), got = after.split(/\r*\n/), t = l => l.trim();
  while (want.length && !t(want[0])) want.shift();
  while (want.length && !t(want.at(-1))) want.pop();
  const real = want.filter(l => t(l)).length;
  if (real < 3) return null;
  const clean = current.split('\n').map(l => l.replace(/\r$/, ''));
  const anchor = alignment(current, want.join('\n'));
  if (!anchor || anchor.length < 2) return null;
  // The anchor run must be unique, or the region is ambiguous.
  const run = want.slice(anchor.from, anchor.from + anchor.length).map(t);
  let runs = 0; for (let i = 0; i + run.length <= clean.length && runs < 2; i++) if (run.every((r, k) => t(clean[i + k]) === r)) runs++;
  if (runs !== 1) return null;
  const lo = Math.max(0, anchor.at - anchor.from - 8), hi = Math.min(clean.length, anchor.at + (want.length - anchor.from) + 8);
  const map = new Map(lcsPairs(want, clean.slice(lo, hi), (a, b) => t(a) === t(b)).map(([i, j]) => [i, lo + j]));
  const matched = [...map.keys()].filter(k => t(want[k])).length;
  if (matched < 3 || matched < 0.6 * real) return null;
  // The model's own change: which before lines it deletes, and what it inserts after which before line.
  const keep = new Map(lcsPairs(want, got, (a, b) => t(a) === t(b)).map(([i, j]) => [i, j]));
  const dels = new Set(), inserts = new Map(); let prevW = -1, nextJ = 0;
  for (let i = 0; i <= want.length; i++) {
    const j = i < want.length ? keep.get(i) : got.length;
    if (j === undefined) { dels.add(i); continue; }
    if (j > nextJ) inserts.set(prevW, got.slice(nextJ, j));
    nextJ = j + 1; prevW = i;
  }
  for (const k of dels) if (t(want[k]) && !map.has(k)) return null;
  // Deleted runs must be contiguous in the file too.
  const sorted = [...dels].filter(k => map.has(k)).sort((a, b) => a - b);
  for (let x = 1; x < sorted.length; x++) if (sorted[x] === sorted[x - 1] + 1 && map.get(sorted[x]) !== map.get(sorted[x - 1]) + 1) return null;
  const files = [...map.values()], from = Math.min(...files), to = Math.max(...files);
  const lead = l => l.match(/^\s*/)[0];
  const indentFor = k => { for (let d = 0; d < want.length; d++) for (const c of [k - d, k + d + 1]) if (map.has(c) && t(want[c])) return [lead(want[c]), lead(clean[map.get(c)])]; return ['', '']; };
  const shift = (lines, k) => { const [w, f] = indentFor(k); return lines.map(l => t(l) && l.startsWith(w) ? f + l.slice(w.length) : l); };
  // Where each insertion goes in the file: after the file image of the before line it follows.
  const placed = new Map();
  for (const [k, lines] of inserts) {
    // A replacement goes where its first deleted line was; a pure insertion follows the kept line
    // before it and must not straddle file lines the model never saw.
    const next = [...map.keys()].filter(c => c > k).sort((a, b) => a - b)[0];
    let at;
    if (next !== undefined && dels.has(next)) at = map.get(next) - 1;
    else if (k < 0) at = map.get(next) - 1;
    else if (map.has(k)) { at = map.get(k); if (next !== undefined && clean.slice(at + 1, map.get(next)).some(l => t(l))) return null; }
    else return null;
    placed.set(at, [...(placed.get(at) || []), ...shift(lines, k)]);
  }
  const gone = new Set(sorted.map(k => map.get(k))), out = [];
  if (placed.has(from - 1)) out.push(...placed.get(from - 1));
  for (let f = from; f <= to; f++) { if (!gone.has(f)) out.push(clean[f]); if (placed.has(f)) out.push(...placed.get(f)); }
  const eol = crlf ? '\r\n' : '\n', region = clean.slice(from, to + 1).join(eol), next = out.join(eol);
  if (region === next || current.split(region).length !== 2) return null;
  return { before: region, after: next, ignoredContext: want.filter((l, k) => t(l) && !map.has(k)).length };
}
// Models often misremember an unchanged context line (a dropped semicolon, `self` for `this`).
// Accepted only when the region has the same number of lines, at most two lines differ, each
// differing line is near-identical to the file's line and appears unchanged in `after` (so the
// patch never meant to edit it), and the region is unique. Those lines take the file's text in both
// before and after, so the applied change is exactly the lines the model did mean to change.
// A line that differs only in spacing or a trailing semicolon/comma says the same thing, whether the
// patch keeps it or replaces it; any other difference is tolerated only on a line the patch keeps.
const formatOnly = (a, b) => { const f = s => s.replace(/\s+/g, '').replace(/[;,]$/, ''); return f(a) === f(b); };
function contextTolerant(current, before, after, crlf) {
  const want = before.split(/\r*\n/);
  while (want.length && !want[0].trim()) want.shift();
  while (want.length && !want.at(-1).trim()) want.pop();
  const lines = want.filter(l => l.trim()).length;
  if (lines < 2) return null;
  const kept = new Set(after.split(/\r*\n/).map(l => l.trim())), limit = Math.min(2, Math.max(1, Math.floor(want.length / 8)));
  const near = (w, f) => w.trim() && f.trim() && (formatOnly(w, f) || lines >= 4 && w.trim().length >= 8 && kept.has(w.trim()) && similarity(bigrams(w), bigrams(f)) >= 0.75);
  const clean = current.split('\n').map(l => l.replace(/\r$/, '')), hits = [];
  for (let i = 0; i + want.length <= clean.length && hits.length < 2; i++) {
    const off = [];
    for (let k = 0; k < want.length && off.length <= limit; k++) if (clean[i + k].trim() !== want[k].trim()) off.push(k);
    if (!off.length || off.length > limit) continue;
    if (off.every(k => near(want[k], clean[i + k]))) hits.push({ at: i, off });
  }
  if (hits.length !== 1) return null;
  const { at, off } = hits[0], source = clean.slice(at, at + want.length), lead = l => l.match(/^\s*/)[0];
  const fixed = new Map(off.map(k => [want[k].trim(), source[k].trim()])), known = new Map(want.map((l, k) => [l, source[k]]));
  let shift = null;
  const rewritten = after.split(/\r*\n/).map(l => {
    if (known.has(l)) { shift = [lead(l), lead(known.get(l))]; return known.get(l); }
    const line = shift && l.startsWith(shift[0]) ? shift[1] + l.slice(shift[0].length) : l;
    return fixed.has(l.trim()) ? lead(line) + fixed.get(l.trim()) : line;
  });
  return { before: source.join(crlf ? '\r\n' : '\n'), after: rewritten.join(crlf ? '\r\n' : '\n') };
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
// Tells the model exactly why a preimage did not apply: which of its lines are not in the file and
// the closest real lines, or where an ambiguous preimage occurs. It never applies anything itself.
const bigrams = text => { const t = text.replace(/\s+/g, ' ').trim(), out = new Map(); for (let i = 0; i < t.length - 1; i++) out.set(t.slice(i, i + 2), (out.get(t.slice(i, i + 2)) || 0) + 1); return out; };
const similarity = (a, b) => { let hit = 0, total = 0; for (const [k, n] of a) { hit += Math.min(n, b.get(k) || 0); total += n; } for (const n of b.values()) total += n; return total ? 2 * hit / total : 0; };
export function preimageReport(current, before) {
  const lines = current.split(/\r?\n/), trimmed = new Set(lines.map(l => l.trim())), count = current.split(before).length - 1;
  if (count > 1) { const at = []; for (let i = 0, k = current.indexOf(before); k >= 0 && i < 4; i++, k = current.indexOf(before, k + 1)) at.push(current.slice(0, k).split('\n').length); return `before occurs ${count} times (lines ${at.join(', ')}); include surrounding lines so it matches exactly once.`; }
  const missing = before.split(/\r?\n/).filter(l => l.trim() && !trimmed.has(l.trim())), where = alignment(current, before);
  const diverge = where ? ` Best alignment: before lines ${where.from + 1}-${where.from + where.length} match file lines ${where.at + 1}-${where.at + where.length}` + (where.next < where.want.length ? `, then before line ${where.next + 1} ${JSON.stringify(where.want[where.next].slice(0, 160))} differs from file line ${where.at + where.length + 1} ${JSON.stringify((lines[where.at + where.length] || '').trim().slice(0, 160))}.` : '.') + ' The real file lines are in actual_source_region.' : '';
  if (!missing.length) return 'before matches no contiguous region: every line exists in the file, but not in this order or with this spacing.' + diverge + ' Copy the region verbatim from the source.';
  const grams = lines.map(bigrams), report = missing.slice(0, 3).map(l => { const g = bigrams(l); let best = -1, score = 0; grams.forEach((x, i) => { const v = similarity(g, x); if (v > score) { score = v; best = i; } });
    return `not in file: ${JSON.stringify(l.trim().slice(0, 160))}` + (best >= 0 && score > 0.5 ? `; closest is line ${best + 1}: ${JSON.stringify(lines[best].trim().slice(0, 160))}` : ''); });
  return `before does not occur in the file. ${missing.length} of its lines are not in the source. ${report.join(' | ')}.${diverge} Copy before verbatim from source_candidates.`;
}
// The longest run of consecutive before-lines (ignoring surrounding whitespace) found in the file.
// Models usually get most of a region right and invent or drop one line; this locates that line.
function alignment(current, before) {
  const want = before.split(/\r?\n/).map(l => l.trim()), file = current.split(/\r?\n/).map(l => l.trim());
  let best = null;
  for (let j = 0; j < want.length; j++) if (want[j]) for (let i = 0; i < file.length; i++) {
    if (file[i] !== want[j]) continue;
    let n = 0; while (j + n < want.length && i + n < file.length && file[i + n] === want[j + n]) n++;
    if (!best || n > best.length) best = { from: j, at: i, length: n };
  }
  if (!best || best.length < 2) return null;
  return { ...best, want, next: best.from + best.length };
}
// The file's own text where before was evidently aimed, so a retry can copy it instead of recalling it.
export function actualRegion(current, before) {
  const where = alignment(current, before); if (!where) return null;
  const lines = current.split(/\r?\n/), start = Math.max(0, where.at - where.from - 2), end = Math.min(lines.length, start + where.want.length + 6, start + 80);
  return { lines: `${start + 1}-${end}`, text: lines.slice(start, end).join('\n') };
}
export async function applyPlan(root, rawPlan, allowedFiles, { readOnly = [] } = {}) {
  const plan = RepairPlan.parse(rawPlan), staged = new Map(), normalizations = []; let changed = 0, size=0;
  for(const edit of plan.edits) {
    // A path written with a leading ./ or /, or missing only its leading folders, is resolved when exactly one allowed file matches.
    if(!allowedFiles.includes(edit.path)) { const bare = edit.path.replace(/^\.?\//,''), match = allowedFiles.filter(f => f === bare || f.endsWith('/'+bare)); if(match.length===1) { normalizations.push({path:match[0],normalization:'path-prefix',written:edit.path}); edit.path=match[0]; } }
    if(readOnly.includes(edit.path)) throw new Error(`Edit ${plan.edits.indexOf(edit)+1} changes ${JSON.stringify(edit.path)}, the page that uses the component. It is read-only context: repair the component's own code in ${allowedFiles.slice(0,12).map(f=>JSON.stringify(f)).join(', ')}.`);
    if(!allowedSource(edit.path) || !allowedFiles.includes(edit.path)) throw new Error(`Edit outside localized allowlist: ${JSON.stringify(edit.path)}. Allowed paths: ${allowedFiles.slice(0,12).map(f=>JSON.stringify(f)).join(', ')}`);
    const file = await contained(root,edit.path);
    const original = await fs.readFile(file,'utf8');
    // Every attempt patches a fresh copy of the unchanged original, so a hash that matches no file is a
    // transcription slip and is recorded; a hash that belongs to another file means the model mixed files up.
    if(digest(original)!==edit.sha256) {
      const other = [];
      for (const f of allowedFiles) if (f !== edit.path && digest(await fs.readFile(await contained(root,f),'utf8')) === edit.sha256) other.push(f);
      if (other.length) throw new Error(`Edit ${plan.edits.indexOf(edit)+1} gives ${JSON.stringify(edit.path)} the sha256 of ${JSON.stringify(other[0])}; edit the file whose source you quoted.`);
      normalizations.push({path:edit.path,normalization:'sha256-mistyped'});
    }
    const current = staged.get(file)?.after ?? original;
    let resolved;
    try { resolved = resolvePreimage(current, edit.before, edit.after); }
    catch(error) { const region = actualRegion(current, edit.before); throw Object.assign(new Error(`Edit ${plan.edits.indexOf(edit)+1} (${edit.path}): ${preimageReport(current, edit.before)}`), region ? { actualRegion: { path: edit.path, ...region } } : {}); }
    if(resolved.normalization) normalizations.push({path:edit.path,normalization:resolved.normalization,...(resolved.ignoredContext?{ignoredContext:resolved.ignoredContext}:{})});
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
// Component code must work on any page. A non-HTML file that named none of the task's element ids
// before the patch is component code; a patch that makes it name one is fitted to the test page.
// Application files that already refer to the page's ids are left alone.
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export async function taskSpecificEdits(originalRoot, candidateRoot, files, journeys) {
  const ids = new Set();
  for (const j of journeys) for (const s of [...j.steps.flatMap(s => [s.action, ...s.assertions]), ...j.success, ...j.functional, ...j.forbidden])
    for (const m of String(s.selector || '').matchAll(/#([A-Za-z][\w-]{2,})/g)) ids.add(m[1]);
  const named = (text, id) => new RegExp(`['"\`#]${escapeRegExp(id)}(?![\\w-])`).test(text), findings = [];
  for (const file of files) {
    if (/\.html?$/i.test(file)) continue;
    const before = await fs.readFile(path.join(originalRoot, file), 'utf8').catch(() => ''), after = await fs.readFile(path.join(candidateRoot, file), 'utf8').catch(() => '');
    if ([...ids].some(id => named(before, id))) continue;
    for (const id of ids) if (named(after, id)) findings.push({ path: file, id });
  }
  return findings;
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
    if(file.endsWith('.ts')) {
      let code=null;try{code=stripTypeScriptTypes(await fs.readFile(await contained(root,file),'utf8'),{mode:'strip'});}catch{}
      const result=code===null?{status:1}:spawnSync(process.execPath,['--input-type=module','--check'],{input:code,encoding:'utf8',timeout:5000,windowsHide:true,maxBuffer:20000,env:{}});
      checks.push({file,pass:result.status===0,kind:'syntax',...(result.status===0?{}:{message:'TypeScript is not erasable or its JavaScript has a syntax error'})});
    }
    if(file.endsWith('.html')) {
      const html = await fs.readFile(await contained(root,file),'utf8');
      checks.push({file,pass:/<!doctype html>/i.test(html) && /<html[\s>]/i.test(html) && /<body[\s>]/i.test(html),kind:'document-structure'});
    }
  }
  return {pass:checks.length>0 && checks.every(c=>c.pass),checks,scope:'Static HTML structure, JavaScript syntax (classic or ESM) and erasable TypeScript only; no framework compilation claim.'};
}
