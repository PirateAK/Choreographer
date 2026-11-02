// Zero-dependency static server for local preview.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const root = process.cwd();
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function pickPort() {
  const candidates = [Number(process.argv[2]), Number(process.env.APP_PORT), Number(process.env.PORT)];
  for (const c of candidates) {
    if (Number.isInteger(c) && c > 0 && c < 65536) return c;
  }
  return 3001;
}

const port = pickPort();

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    if (path === '/') path = '/index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root + sep) && file !== root) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': types[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log('Choreographer running at http://127.0.0.1:' + port);
});
