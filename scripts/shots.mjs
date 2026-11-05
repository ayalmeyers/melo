// Serves an Expo web export and screenshots key screens at iPhone 15 size. usage: node scripts/shots.mjs <exportDir> <outDir> [routes...]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const [root, out, ...given] = process.argv.slice(2);
const routes = given.length ? given : ['/', '/discover', '/item/blonde', '/item/gnx', '/me', '/user/niaplays', '/artist/frank', '/genre/afro', '/charts', '/activity', '/post/p2', '/forecasts', '/compose', '/login'];
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(8799);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ ...devices['iPhone 15'] })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
for (const r of routes) {
  await page.goto(`http://localhost:8799${r}`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2500);
  const name = r.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.screenshot({ path: `${out}/${name}-full.png`, fullPage: true });
}
const broken = await page.evaluate(() => [...document.images].filter(i => i.complete && !i.naturalWidth).map(i => i.src));
fs.writeFileSync(`${out}/report.json`, JSON.stringify({ errors, broken }, null, 2));
console.log(JSON.stringify({ errors: errors.slice(0, 10), broken: broken.slice(0, 10) }));
await browser.close(); server.close();
