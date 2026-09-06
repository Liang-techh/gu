const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.GU_PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const candidate = path.resolve(root, `.${requestPath === '/' ? '/index.html' : requestPath}`);
  if (!candidate.startsWith(root) || !fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[path.extname(candidate)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(candidate).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Gu RPG demo: http://localhost:${port}/`));
