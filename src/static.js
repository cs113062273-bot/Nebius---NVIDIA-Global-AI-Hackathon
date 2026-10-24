import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { contained } from './files.js';

export const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.patch': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.yml': 'text/plain; charset=utf-8' };
Object.assign(types,{'.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'});
export async function serveFile(res, root, name, { fixture = false, attachment = false, recorder = null } = {}) {
  try {
    const file = await contained(root, name);
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 16_000_000) throw new Error('Invalid file');
    res.writeHead(200, {
      'Content-Type': types[path.extname(name)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
      'Content-Security-Policy': fixture ? "default-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts allow-same-origin allow-forms" : "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-src http://127.0.0.1:*; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      ...(attachment ? { 'Content-Disposition': 'attachment' } : {})
    });
    const bytes=await fs.readFile(file);
    res.end(recorder&&name.endsWith('.html')?Buffer.from(bytes.toString('utf8').replace(/<head([^>]*)>/i,'<head$1><script src="/__tabstitch_recorder.js"></script>')):bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
}
export async function fixtureServer(root, {recorder=null}={}) {
  const server = http.createServer((req, res) => {
    let name;
    try { name = decodeURIComponent(new URL(req.url, 'http://local').pathname).slice(1) || 'index.html'; } catch { res.writeHead(400); res.end(); return; }
    if(recorder&&name==='__tabstitch_recorder.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(recorder);return;}
    if(name.split('/').some(part=>part.startsWith('.')) || !['.html','.css','.js','.json','.png','.svg','.jpg','.jpeg','.webp','.gif','.ico','.woff2','.woff','.ttf','.txt'].includes(path.extname(name).toLowerCase())) { res.writeHead(404);res.end('Not found');return; }
    void serveFile(res, root, name, { fixture: true,recorder });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())) };
}
