// E2E用ローカルサーバ: リポジトリを配信し、importmapのCDN参照を
// node_modules/three へ差し替える（サンドボックス/CI のオフライン実行用）
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const PORT = process.env.PORT || 8910;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.css': 'text/css',
};

createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  // /three/... → node_modules/three/...
  const fp = p.startsWith('/three/')
    ? join(ROOT, 'node_modules/three', p.slice(7))
    : join(ROOT, p);
  if (!existsSync(fp)) { res.writeHead(404); res.end('not found'); return; }
  let body = readFileSync(fp);
  if (p.endsWith('game.html')) {
    body = body.toString()
      .replace('https://unpkg.com/three@0.170.0/build/three.module.js', '/three/build/three.module.js')
      .replace('https://unpkg.com/three@0.170.0/examples/jsm/', '/three/examples/jsm/');
  }
  res.writeHead(200, { 'content-type': MIME[extname(fp)] || 'application/octet-stream' });
  res.end(body);
}).listen(PORT, () => console.log(`serving ${ROOT} at http://localhost:${PORT}`));
