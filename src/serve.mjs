/* A static server for looking at the built site.

   It exists because the pages are ES modules: a browser refuses to import one
   over file://, so docs/ cannot be checked by opening the file. It also
   resolves a directory to its index.html, the way GitHub Pages does, so the
   links behave here exactly as they will when published.
*/

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

export function serve({ root = 'docs', port = 4321 } = {}) {
  const base = resolve(root);
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = normalize(join(base, url));
    if (!file.startsWith(base)) { res.writeHead(403).end('no'); return; }
    try {
      const s = await stat(file);
      if (s.isDirectory()) file = join(file, 'index.html');
      await stat(file);
    } catch {
      try { await stat(file + '.html'); file += '.html'; }
      catch {
        const f = join(base, '404.html');
        try { await stat(f); res.writeHead(404, { 'content-type': TYPES['.html'] }); createReadStream(f).pipe(res); }
        catch { res.writeHead(404).end('not found'); }
        return;
      }
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  server.listen(port, () => console.log(`  serving ${base} on http://localhost:${port}/`));
  return server;
}
