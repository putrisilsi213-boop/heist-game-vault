// Vaultbreak — tiny static file server for local playtesting.
// Serves this directory: / loads game/index.html, /game/... the game
// files, /screenshots/... the screenshots. No dependencies, Node stdlib
// only. Run with: node serve.ts [port]   (default port 8137)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.argv[2] ?? 8137);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let rel = url.pathname === '/' ? 'game/index.html' : url.pathname.slice(1);
    // A request for a game asset may arrive rooted at / (the page is
    // served as the site root) or under /game/; try both.
    const candidates = [resolve(join(root, normalize(rel))), resolve(join(root, 'game', normalize(rel)))];
    let path = null;
    for (const cand of candidates) {
      if (!cand.startsWith(root)) continue;
      try {
        const st = await stat(cand);
        if (st.isFile()) {
          path = cand;
          break;
        }
      } catch { /* try the next candidate */ }
    }
    if (path === null) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const bytes = await readFile(path);
    res.writeHead(200, {
      'content-type': MIME[extname(path)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`serving ${root} at http://127.0.0.1:${port}/`);
});
