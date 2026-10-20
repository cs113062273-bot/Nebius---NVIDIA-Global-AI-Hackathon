import fs from 'node:fs/promises';
import path from 'node:path';
import { digest } from './schema.js';

export async function json(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(value, null, 2));
  await fs.rename(tmp, file);
}
export async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
export async function contained(root, relative, { existing = true } = {}) {
  if (!relative || relative.includes('\\') || relative.includes(':') || relative.includes('\0') || path.isAbsolute(relative) || relative.split('/').some(s => s === '..' || s === '.' || !s)) throw new Error('Unsafe relative path');
  const absoluteRoot = await fs.realpath(root);
  const resolved = path.resolve(absoluteRoot, relative);
  if (!resolved.startsWith(absoluteRoot + path.sep)) throw new Error('Path escapes root');
  let cursor = absoluteRoot;
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part);
    try { if ((await fs.lstat(cursor)).isSymbolicLink()) throw new Error('Symbolic links forbidden'); }
    catch (e) { if (e.code !== 'ENOENT' || existing) throw e; }
  }
  return resolved;
}
export async function listFiles(root, prefix = '') {
  const files = [];
  for (const entry of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Symbolic links forbidden');
    const rel = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(root, rel));
    else if (entry.isFile()) files.push(rel);
    if (files.length > 2000) throw new Error('File count limit');
  }
  return files.sort();
}
export async function hashTree(root, exclude = []) {
  const hashes = {};
  for (const file of await listFiles(root)) if (!exclude.includes(file)) hashes[file] = digest(await fs.readFile(await contained(root, file)));
  return hashes;
}
