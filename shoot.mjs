// Screenshot Vaultbreak with Playwright's cached Chromium (no download).
import { chromium } from '/home/hatch/workspace/makefun/node_modules/playwright-core/index.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';

const server = spawn(process.execPath, ['serve.ts'], { cwd: process.cwd(), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const errors = [];
const requests = [];
const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console.error] ' + m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e).slice(0, 300)));
page.on('request', (r) => requests.push(r.url()));
mkdirSync('screenshots', { recursive: true });
const shots = [
  { name: '01-cover-lobby', url: '/?shot=cover&level=1' },
  { name: '02-gallery-alarm', url: '/?shot=gallery&level=2' },
  { name: '03-vault-getaway', url: '/?shot=vault&level=3' },
  { name: '04-level-complete', url: '/?shot=win&level=1' },
];
for (const shot of shots) {
  await page.goto(`http://localhost:8080${shot.url}`, { waitUntil: 'load' });
  try { await page.waitForFunction(() => window.__shotReady, null, { timeout: 15000 }); }
  catch { console.log(`[${shot.name}] __shotReady timeout`); }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `screenshots/${shot.name}.jpg`, type: 'jpeg', quality: 80 });
  const kb = Math.round(statSync(`screenshots/${shot.name}.jpg`).size / 1024);
  console.log(`[${shot.name}] saved ${kb} KiB`);
}
await browser.close();
server.kill();
console.log('requests:', [...new Set(requests)].join(' | '));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors');
console.log('done');
