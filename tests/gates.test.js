import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Journey } from '../src/schema.js';
import { taskSpecificEdits, preimageReport, resolvePreimage, applyPlan } from '../src/repair.js';
import { normalizeAdvisory, extractJson } from '../src/nebius.js';
import { digest } from '../src/schema.js';

const journey = Journey.parse({ version: 1, id: 'open-drawer', title: 'Open the drawer', goal: 'Focus moves into the drawer', source: 'authored', profile: 'keyboard', path: '/',
  steps: [{ title: 'Open', action: { kind: 'press', key: 'Enter' }, assertions: [{ kind: 'focus', selector: '#filters-close' }] }],
  success: [{ kind: 'focus', selector: '#filters-close' }], functional: [{ kind: 'focus', selector: '#filters-close' }] });

test('Overfitting gate rejects component code that names the test page, and spares application code', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gate-')), before = path.join(root, 'before'), after = path.join(root, 'after');
  try {
    for (const dir of [before, after]) await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(before, 'drawer.js'), 'export function show(el) { el.showModal() }\n');
    await fs.writeFile(path.join(after, 'drawer.js'), "export function show(el) { el.showModal(); el.querySelector('#filters-close').focus() }\n");
    await fs.writeFile(path.join(before, 'app.js'), "document.querySelector('#filters-close')\n");
    await fs.writeFile(path.join(after, 'app.js'), "document.querySelector('#filters-close').focus()\n");
    await fs.writeFile(path.join(before, 'generic.js'), 'export function show(el) { el.showModal() }\n');
    await fs.writeFile(path.join(after, 'generic.js'), "export function show(el) { el.showModal(); el.querySelector('[data-bs-dismiss]').focus() }\n");
    assert.deepEqual(await taskSpecificEdits(before, after, ['drawer.js', 'app.js', 'generic.js'], [journey]), [{ path: 'drawer.js', id: 'filters-close' }]);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('An unapplied preimage reports the missing line and the closest real one, or where it repeats', () => {
  const source = 'a\n  const x = 1\n  foo(x)\n  foo(x)\nend';
  assert.match(preimageReport(source, '  foo(x)'), /occurs 2 times \(lines 3, 4\)/);
  assert.match(preimageReport(source, '  const y = 1\n  foo(x)'), /not in file: "const y = 1"; closest is line 2: "const x = 1"/);
});

test('Misremembered context lines are tolerated only when the patch keeps them; changed and invented lines must match', () => {
  const source = 'function f(self) {\n  const a = 1;\n  if (a) {\n    input.addEventListener("paste", onPaste.bind(null, this));\n  }\n  return a;\n}\n';
  // Context `input.addEventListener("paste", onPaste.bind(null, self))` (kept unchanged in after) is near-identical to the file's `input.addEventListener("paste", onPaste.bind(null, this));`: the file's line is used.
  const ok = resolvePreimage(source, '  if (a) {\n    input.addEventListener("paste", onPaste.bind(null, self))\n  }\n  return a;', '  if (a) {\n    input.addEventListener("paste", onPaste.bind(null, self))\n  }\n  return a + 1;');
  assert.equal(ok.normalization, 'context-lines');
  assert.equal(source.replace(ok.before, ok.after), source.replace('return a;', 'return a + 1;'));
  // A changed line that differs in substance is not guessed.
  assert.throws(() => resolvePreimage(source, '  if (a) {\n    input.addEventListener("paste", onPaste.bind(null, self))\n  }\n  return a;', '  if (a) {\n    stop()\n  }\n  return a;'));
  // An invented line the patch changes is never accepted.
  assert.throws(() => resolvePreimage(source, '  if (a) {\n    prevent();\n    input.addEventListener("paste", onPaste.bind(null, this));\n  }', '  if (a) {\n    stop();\n    input.addEventListener("paste", onPaste.bind(null, this));\n  }'));
  // An invented line the patch keeps is ignored: only the model's own change is applied, at its anchored place.
  const hunk = resolvePreimage(source, '  if (a) {\n    prevent();\n    input.addEventListener("paste", onPaste.bind(null, this));\n  }', '  if (a) {\n    prevent();\n    input.addEventListener("paste", onPaste.bind(null, this));\n    done();\n  }');
  assert.equal(hunk.normalization, 'hunks');
  assert.equal(source.replace(hunk.before, hunk.after), source.replace('this));\n', 'this));\n    done();\n'));
  // An insertion between two lines with an unseen file line between them has no defined place.
  const gap = 'a();\nb();\nunseen();\nc();\nd();\n';
  assert.throws(() => resolvePreimage(gap, 'a();\nb();\nc();\nd();', 'a();\nb();\nnew();\nc();\nd();'));
});

test('Advisory fields written inside an edit are moved to the top level', () => {
  const plan = normalizeAdvisory({ root_cause: 'r', repair_strategy: 's', edits: [{ path: 'a.js', sha256: 'x', before: 'b', after: 'c', functional_risks: 'none', expected_accessibility_effect: 'e', verification_requirements: ['v'] }] });
  assert.deepEqual(Object.keys(plan.edits[0]), ['path', 'sha256', 'before', 'after']);
  assert.deepEqual(plan.functional_risks, ['none']);
  assert.equal(plan.expected_accessibility_effect, 'e');
});

test('A read-only page cannot be patched; the refusal names the editable component files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tabstitch-ro-'));
  await fs.writeFile(path.join(root, 'index.html'), '<p>page</p>\n'); await fs.writeFile(path.join(root, 'lib.js'), 'export const a = 1;\n');
  const plan = { root_cause: 'r', repair_strategy: 's', expected_accessibility_effect: 'e', functional_risks: ['none'], verification_requirements: ['v'], edits: [{ path: 'index.html', sha256: digest('<p>page</p>\n'), before: '<p>page</p>', after: '<p>fixed</p>' }] };
  await assert.rejects(applyPlan(root, plan, ['lib.js'], { readOnly: ['index.html'] }), /read-only context: repair the component's own code in "lib.js"/);
  assert.equal(await fs.readFile(path.join(root, 'index.html'), 'utf8'), '<p>page</p>\n');
});

test('Model JSON with misplaced closers is repaired structurally; string contents are kept', () => {
  let repaired = 0; const mark = () => repaired++;
  // The edits array never closed before the next key.
  assert.deepEqual(extractJson('{"edits":[{"after":"a]}"},"note":"n"}', mark), { edits: [{ after: 'a]}' }], note: 'n' });
  // '}' written for ']', a trailing comma and a stray closer at the end.
  assert.deepEqual(extractJson('{"edits":[{"p":"x",}},"n":1}}', mark), { edits: [{ p: 'x' }], n: 1 });
  // A raw newline inside a string.
  assert.deepEqual(extractJson('{"after":"a\nb"}', mark), { after: 'a\nb' });
  assert.equal(repaired, 3);
  // Valid JSON is parsed as is, and hopeless text still fails.
  assert.deepEqual(extractJson('{"a":[1]}', mark), { a: [1] }); assert.equal(repaired, 3);
  assert.throws(() => extractJson('{"a": nope}'));
});
