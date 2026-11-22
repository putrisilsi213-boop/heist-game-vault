// Interactive playtest: real keyboard play + click-to-move, no ?shot= staging.
import { chromium } from '/home/hatch/workspace/makefun/node_modules/playwright-core/index.mjs';
import { spawn } from 'node:child_process';

const server = spawn(process.execPath, ['serve.ts'], { cwd: process.cwd(), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const errors = [];
const requests = [];
const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console.error] ' + m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e).slice(0, 200)));
page.on('request', (r) => requests.push(r.url()));
const txt = (sel) => page.$eval(sel, (el) => el.textContent);
const state = () => page.evaluate(() => ({ s: window.__game.state, x: Math.round(window.__game.player.x), y: Math.round(window.__game.player.y), alarm: Math.round(window.__game.alarm), hearts: window.__game.hearts, score: window.__game.score, loot: window.__game.lootGot, camOff: Math.round(window.__game.camOffT * 10) / 10 }));

await page.goto('http://localhost:8080/', { waitUntil: 'load' });
await page.waitForTimeout(400);
console.log('menu visible:', await page.$eval('#menu-overlay', (el) => !el.hidden));
await page.click('.level-card');
await page.waitForTimeout(400);
console.log('after start:', await state(), '| level:', await txt('#level-name'));
// walk right with keyboard for 1.2s — player must move, no errors
const before = await state();
await page.keyboard.down('d');
await page.waitForTimeout(1200);
await page.keyboard.up('d');
const after = await state();
console.log('walk right:', before, '->', after, '| moved:', after.x > before.x + 50);
// sneak key registers
await page.keyboard.down('Shift');
await page.waitForTimeout(200);
console.log('sneaking:', await page.evaluate(() => window.__game.sneaking));
await page.keyboard.up('Shift');
// click-to-move: click a point ahead on the canvas
const box = await page.$eval('#canvas', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await page.mouse.click(box.x + box.w * 0.5, box.y + box.h * 0.5);
await page.waitForTimeout(1200);
console.log('after click-to-move:', await state());
// teleport into a guard cone to verify alarm rises (freeze the guard first)
await page.evaluate(() => { const g = window.__game; g.moveTarget = null; const gd = g.guards[0]; gd.mode = 'patrol'; gd.x = 420; gd.y = 300; gd.dir = 0; gd.pause = 99; g.player.x = gd.x + 60; g.player.y = gd.y; console.log('guardSees=', g.guardSees(gd)); });
await page.waitForTimeout(1500);
console.log('in guard cone, alarm:', await state());
// break LOS behind a safe: alarm must fall
await page.evaluate(() => { const g = window.__game; g.player.x = 212; g.player.y = 232; g.guards[0].dir = Math.PI; });
await page.waitForTimeout(2000);
console.log('behind cover, alarm falling:', await state());
// camera cone: teleport in front of camera 0, alarm must rise
await page.evaluate(() => { const g = window.__game; g.moveTarget = null; g.camOffT = 0; const c = g.cameras[0]; g.player.x = c.x; g.player.y = c.y + 120; c.dir = Math.PI / 2; c.sweep = 0; });
await page.waitForTimeout(1500);
console.log('in camera cone, alarm:', await state());
// hack: teleport to console, press E, cameras must go blind
await page.evaluate(() => { const g = window.__game; g.player.x = g.level.console[0]; g.player.y = g.level.console[1]; g.alarm = 0; });
await page.keyboard.press('e');
await page.waitForTimeout(300);
console.log('after hack (E at console):', await state(), '| cam line:', await txt('#cam-state'));
// Esc back to menu, then start level 2 by keyboard
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
console.log('menu visible after Esc:', await page.$eval('#menu-overlay', (el) => !el.hidden));
await page.keyboard.press('2');
await page.waitForTimeout(400);
console.log('after pressing 2:', await txt('#level-name'), '|', await state());
// win path: teleport to vault then exit
await page.evaluate(() => { const g = window.__game; g.player.x = g.level.vault[0]; g.player.y = g.level.vault[1]; });
await page.waitForTimeout(300);
console.log('loot state:', await txt('#loot-state'));
await page.evaluate(() => { const g = window.__game; g.player.x = g.level.exit.x + 28; g.player.y = g.level.exit.y + 38; });
await page.waitForTimeout(500);
console.log('after exit:', await state(), '| end overlay:', await page.$eval('#end-overlay', (el) => !el.hidden), '| title:', await txt('#end-title'));
await browser.close();
server.kill();
console.log('requests:', [...new Set(requests)].join(' | '));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors');
console.log('playtest done');
