import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Journey } from '../src/schema.js';
import { taskSpecificEdits, preimageReport } from '../src/repair.js';

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
