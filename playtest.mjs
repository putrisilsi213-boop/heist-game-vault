// Vaultbreak — headless playtest over Chrome DevTools Protocol.
// No test framework: launches the system chromium, drives the real page
// with real key/mouse input, and asserts the mechanics end to end:
// movement, click-to-move, sneak, hack, vault crack, loot, win and lose.
//
// Usage: node playtest.mjs [baseUrl]   (default http://127.0.0.1:8137/)
// Expects serve.ts already running. Exit code 0 = all checks passed.

import { spawn } from 'node:child_process';

const BASE = process.argv[2] ?? 'http://127.0.0.1:8137/';
const DEBUG_PORT = 9223;
// System chromium-browser is a snap stub here; use the Playwright-cached
// headless shell instead.
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`;
const results = [];
let ws = null;
let msgId = 0;
const pending = new Map();
const pageErrors = [];

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForJson(path, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}${path}`);
      if (res.ok) return await res.json();
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error(`DevTools endpoint ${path} never came up`);
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaljs(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`evaluate failed: ${JSON.stringify(r.exceptionDetails)}`);
  return r.result.value;
}

async function key(code, key, type) {
  await send('Input.dispatchKeyEvent', { type, code, key });
}

async function keyHold(code, keyName, ms) {
  await key(code, keyName, 'keyDown');
  await sleep(ms);
  await key(code, keyName, 'keyUp');
}

async function clickAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

// Canvas client coordinates for a world point.
async function toClient(wx, wy) {
  const rect = await evaljs(`(() => { const r = document.getElementById('game').getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);
  return { x: rect.left + (wx / 960) * rect.width, y: rect.top + (wy / 600) * rect.height };
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--window-size=1280,800',
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    await waitForJson('/json/version');
    const target = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(BASE)}`, { method: 'PUT' }).then((r) => r.json());
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id).resolve(msg.result ?? {});
        pending.delete(msg.id);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        pageErrors.push(JSON.stringify(msg.params.exceptionDetails?.exception?.description ?? msg.params));
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        pageErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await sleep(1500);

    const hasHook = await evaljs(`!!window.__vaultbreak`);
    check('page loads and exposes __vaultbreak', hasHook === true);

    let snap = await evaljs(`window.__vaultbreak.snapshot()`);
    check('starts at the menu', snap.state === 'menu', `state=${snap.state}`);

    await evaljs(`window.__vaultbreak.start()`);
    await sleep(300);
    snap = await evaljs(`window.__vaultbreak.snapshot()`);
    check('start button begins play', snap.state === 'playing', `state=${snap.state}`);

    // 1. WASD movement: hold W, the player must move up.
    const before = await evaljs(`window.__vaultbreak.snapshot().player`);
    await keyHold('KeyW', 'w', 700);
    const after = await evaljs(`window.__vaultbreak.snapshot().player`);
    check('WASD moves the player', after.y < before.y - 20, `y ${before.y} -> ${after.y}`);

    // 2. Click-to-move: click ahead of the player, it must walk there.
    const click = await toClient(after.x + 120, after.y);
    await clickAt(Math.round(click.x), Math.round(click.y));
    await sleep(1200);
    const moved = await evaljs(`window.__vaultbreak.snapshot().player`);
    check('click-to-move walks the player', moved.x > after.x + 40, `x ${after.x} -> ${moved.x}`);

    // 3. Sneak: Shift held while moving flags sneaking.
    await key('ShiftLeft', 'Shift', 'keyDown');
    await key('KeyW', 'w', 'keyDown');
    await sleep(400);
    const sneaking = await evaljs(`window.__vaultbreak.snapshot().player.sneaking`);
    await key('KeyW', 'w', 'keyUp');
    await key('ShiftLeft', 'Shift', 'keyUp');
    check('Shift sneaks', sneaking === true);

    // 4. Hack: park the guards far away so the scripted hack is not
    // interrupted by a chase, then stand at the console, sneak (halving
    // the camera's detection rate) and hold E; the cameras must go down.
    await evaljs(`window.__vaultbreak.game.guards.forEach(g => { g.x = 900; g.y = 550; g.chasing = false; })`);
    await evaljs(`window.__vaultbreak.debug.teleport(480, 285)`);
    await key('ShiftLeft', 'Shift', 'keyDown');
    await key('KeyE', 'e', 'keyDown');
    await sleep(3600);
    await key('KeyE', 'e', 'keyUp');
    await key('ShiftLeft', 'Shift', 'keyUp');
    snap = await evaljs(`window.__vaultbreak.snapshot()`);
    check('holding E hacks the console', snap.consoleHacked === true && snap.camerasDown === true,
      `hacked=${snap.consoleHacked} camerasDown=${snap.camerasDown}`);

    // 5. Crack vault A, then collect its three loot stacks.
    await evaljs(`window.__vaultbreak.debug.teleport(160, 200)`);
    await key('KeyE', 'e', 'keyDown');
    await sleep(3200);
    await key('KeyE', 'e', 'keyUp');
    snap = await evaljs(`window.__vaultbreak.snapshot()`);
    check('holding E cracks vault A', snap.vaultsCracked === 1, `cracked=${snap.vaultsCracked}`);
    for (const [lx, ly] of [[110, 100], [210, 100], [160, 185]]) {
      await evaljs(`window.__vaultbreak.debug.teleport(${lx}, ${ly})`);
      await sleep(250);
    }
    snap = await evaljs(`window.__vaultbreak.snapshot()`);
    check('walking over loot collects it', snap.lootCollected === 3 && snap.lootValue === 500,
      `collected=${snap.lootCollected} value=$${snap.lootValue}`);

    // 6. Crack vaults B and C the same way and grab everything.
    for (const [vx, vy, bags] of [
      [480, 200, [[430, 100], [530, 100], [480, 185]]],
      [800, 200, [[750, 100], [850, 100], [800, 185]]],
    ]) {
      await evaljs(`window.__vaultbreak.debug.teleport(${vx}, ${vy})`);
      await key('KeyE', 'e', 'keyDown');
      await sleep(3200);
      await key('KeyE', 'e', 'keyUp');
      for (const [lx, ly] of bags) {
        await evaljs(`window.__vaultbreak.debug.teleport(${lx}, ${ly})`);
        await sleep(250);
      }
    }
    snap = await evaljs(`window.__vaultbreak.snapshot()`);
    check('all 3 vaults cracked, all loot taken', snap.vaultsCracked === 3 && snap.lootCollected === 9,
      `vaults=${snap.vaultsCracked} loot=${snap.lootCollected}/9 value=$${snap.lootValue}`);

    // 7. Reach the exit with everything: win.
    await evaljs(`window.__vaultbreak.debug.teleport(480, 560)`);
    await sleep(400);
    snap = await evaljs(`window.__vaultbreak.snapshot()`);
    check('reaching the exit with all loot wins', snap.state === 'won', `state=${snap.state} reason=${snap.endReason}`);

    // 8. Lose path: restart, walk into a guard, get caught.
    await evaljs(`window.__vaultbreak.start()`);
    await sleep(300);
    const guard = await evaljs(`(() => { const g = window.__vaultbreak.game.guards[0]; return { x: g.x, y: g.y }; })()`);
    await evaljs(`window.__vaultbreak.debug.teleport(${Math.round(guard.x)}, ${Math.round(guard.y)})`);
    await sleep(400);
    snap = await evaljs(`window.__vaultbreak.snapshot()`);
    check('a guard catching the player loses', snap.state === 'lost', `state=${snap.state} reason=${snap.endReason}`);

    check('no page errors during the run', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`FATAL ${err.message}`);
  process.exit(2);
});
