// Vaultbreak — screenshot capture over Chrome DevTools Protocol.
// Takes the four dossier screenshots at 1280x800:
//   01-cover-lobby.jpg      the start screen over the lobby
//   02-gallery-alarm.jpg    mid-heist with the alarm meter climbing
//   03-vault-getaway.jpg    vault A cracked, loot on the floor
//   04-level-complete.jpg   the win overlay after a clean getaway
// Each JPEG must stay under 262144 bytes (the competition's screenshot cap);
// the quality steps down until it fits.
//
// Usage: node shoot.mjs [baseUrl]   (default http://127.0.0.1:8137/)
// Expects serve.ts already running. Writes into screenshots/.

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:8137/';
const DEBUG_PORT = 9224;
// System chromium-browser is a snap stub here; use the Playwright-cached
// headless shell instead.
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`;
const OUT = new URL('./screenshots/', import.meta.url).pathname;
const MAX_BYTES = 262144;

let ws = null;
let msgId = 0;
const pending = new Map();
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
  return new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
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

async function shot(name) {
  for (const quality of [78, 60, 45, 30]) {
    const r = await send('Page.captureScreenshot', { format: 'jpeg', quality });
    const bytes = Buffer.from(r.data, 'base64');
    if (bytes.length <= MAX_BYTES || quality === 30) {
      writeFileSync(join(OUT, name), bytes);
      console.log(`${name}: ${bytes.length} bytes (quality ${quality})`);
      return bytes.length;
    }
  }
  return 0;
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
        pending.get(msg.id)(msg.result ?? {});
        pending.delete(msg.id);
      }
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await sleep(1500);

    // 1. Cover: the start screen over the lobby.
    await shot('01-cover-lobby.jpg');

    // 2. Alarm: mid-heist, standing in the exit camera's cone with the
    // meter already high, so the red vignette shows.
    await evaljs(`window.__vaultbreak.start()`);
    await sleep(300);
    await evaljs(`window.__vaultbreak.debug.teleport(480, 320)`);
    await evaljs(`window.__vaultbreak.debug.setAlarm(62)`);
    await sleep(600);
    await shot('02-gallery-alarm.jpg');

    // 3. Vault: crack vault A for real, then stand inside with the loot out.
    await evaljs(`window.__vaultbreak.start()`);
    await sleep(300);
    await evaljs(`window.__vaultbreak.debug.teleport(160, 200)`);
    await key('KeyE', 'e', 'keyDown');
    await sleep(3200);
    await key('KeyE', 'e', 'keyUp');
    await evaljs(`window.__vaultbreak.debug.teleport(160, 150)`);
    await sleep(400);
    await shot('03-vault-getaway.jpg');

    // 4. Complete: the win overlay.
    await evaljs(`window.__vaultbreak.debug.winNow()`);
    await sleep(400);
    await shot('04-level-complete.jpg');

    console.log('screenshots done');
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error(`FATAL ${err.message}`);
  process.exit(2);
});
