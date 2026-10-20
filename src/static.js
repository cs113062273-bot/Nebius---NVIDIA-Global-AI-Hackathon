import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { contained } from './files.js';

export const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.patch': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.yml': 'text/plain; charset=utf-8' };
export async function serveFile(res, root, name, { fixture = false, attachment = false } = {}) {
  try {
    const file = await contained(root, name);
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 16_000_000) throw new Error('Invalid file');
    res.writeHead(200, {
      'Content-Type': types[path.extname(name)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
      'Content-Security-Policy': fixture ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts allow-same-origin" : "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      ...(attachment ? { 'Content-Disposition': 'attachment' } : {})
    });
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
}
export async function fixtureServer(root) {
  const server = http.createServer((req, res) => {
    let name;
    try { name = decodeURIComponent(new URL(req.url, 'http://local').pathname).slice(1) || 'index.html'; } catch { res.writeHead(400); res.end(); return; }
    if(name.split('/').some(part=>part.startsWith('.')) || !['.html','.css','.js','.png','.svg','.jpg','.jpeg','.webp','.woff2'].includes(path.extname(name).toLowerCase())) { res.writeHead(404);res.end('Not found');return; }
    void serveFile(res, root, name, { fixture: true });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())) };
}
