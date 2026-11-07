import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import WebTorrent from 'webtorrent';

const PORT = +process.env.PORT || 3000;
const TOKEN = process.env.TOKEN;
const DL = process.env.DOWNLOADS || './downloads';
if (!TOKEN) { console.error('Definí TOKEN=una-clave-larga'); process.exit(1); }

const DIST = fileURLToPath(new URL('./dist', import.meta.url));
const client = new WebTorrent();
client.on('error', (e) => console.error(e.message));

const MIME = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.mkv': 'video/x-matroska', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon'
};
const mime = (f) => MIME[extname(f).toLowerCase()] || 'application/octet-stream';
const json = (res, code, data) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
const authed = (given) => {
  const a = Buffer.from(String(given)), b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
};
const view = (t) => ({
  infoHash: t.infoHash, name: t.name, progress: t.progress, speed: t.downloadSpeed, peers: t.numPeers,
  files: t.files.map((f, index) => ({ index, name: f.name, length: f.length }))
});
const body = (req) => new Promise((ok) => {
  let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => { try { ok(JSON.parse(s)); } catch { ok({}); } });
});

function streamFile(req, res, file) {
  const size = file.length;
  let start = 0, end = size - 1, code = 200;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) {
    if (m[1] !== '') { start = +m[1]; if (m[2] !== '') end = Math.min(+m[2], size - 1); }
    else if (m[2] !== '') start = Math.max(size - +m[2], 0);
    if (start > end || start >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }); return res.end(); }
    code = 206;
  }
  const h = { 'content-type': mime(file.name), 'accept-ranges': 'bytes', 'content-length': end - start + 1 };
  if (code === 206) h['content-range'] = `bytes ${start}-${end}/${size}`;
  res.writeHead(code, h);
  const s = file.createReadStream({ start, end });
  s.pipe(res);
  res.on('close', () => s.destroy());
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    if (p.startsWith('/api/') || p.startsWith('/stream/')) {
      if (!authed(req.headers['x-token'] || url.searchParams.get('t') || '')) return json(res, 401, { error: 'unauthorized' });
      if (p === '/api/torrents' && req.method === 'GET') return json(res, 200, client.torrents.map(view));
      if (p === '/api/torrents' && req.method === 'POST') {
        const { magnet } = await body(req);
        if (!magnet || !magnet.startsWith('magnet:')) return json(res, 400, { error: 'magnet inválido' });
        client.add(magnet, { path: DL }).on('error', (e) => console.error(e.message));
        return json(res, 200, { ok: true });
      }
      const del = /^\/api\/torrents\/([0-9a-f]{40})$/i.exec(p);
      if (del && req.method === 'DELETE') {
        const t = await client.get(del[1]);
        if (t) await new Promise((r) => t.destroy({ destroyStore: true }, r));
        return json(res, 200, { ok: true });
      }
      const st = /^\/stream\/([0-9a-f]{40})\/(\d+)$/i.exec(p);
      if (st) {
        const t = await client.get(st[1]);
        const f = t?.files[+st[2]];
        if (!f) return json(res, 404, { error: 'no encontrado' });
        return streamFile(req, res, f);
      }
      return json(res, 404, { error: 'not found' });
    }
    let f = normalize(join(DIST, p === '/' ? 'index.html' : p));
    if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) f = join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': mime(f), 'cache-control': f.endsWith('sw.js') ? 'no-cache' : 'public, max-age=3600' });
    createReadStream(f).pipe(res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'error interno' });
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
