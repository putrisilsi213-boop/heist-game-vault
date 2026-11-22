// Vaultbreak — page bootstrap: canvas setup, input, the animation loop,
// HUD updates and the start/win/lose overlays. The game itself lives in
// game.js; this file only wires it to the page.

import { VaultbreakGame } from './game.js';
import { WORLD } from './levels.js';

const canvas = document.getElementById('game');
canvas.width = WORLD.width;
canvas.height = WORLD.height;

const game = new VaultbreakGame(canvas);

const $ = (id) => document.getElementById(id);
const hudLoot = $('hud-loot');
const hudVaults = $('hud-vaults');
const hudTime = $('hud-time');
const hudAlarm = $('hud-alarm');
const hudAlarmFill = $('hud-alarm-fill');
const hudCams = $('hud-cams');
const hudMessage = $('hud-message');
const overlayStart = $('overlay-start');
const overlayEnd = $('overlay-end');
const endTitle = $('end-title');
const endStats = $('end-stats');
const btnStart = $('btn-start');
const btnAgain = $('btn-again');
const btnMute = $('btn-mute');

function formatTime(t) {
  const mins = Math.floor(t / 60);
  const secs = Math.floor(t % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function showOverlay(which) {
  overlayStart.classList.toggle('hidden', which !== 'start');
  overlayEnd.classList.toggle('hidden', which !== 'end');
}

function beginRun() {
  game.start();
  showOverlay(null);
  canvas.focus();
}

btnStart.addEventListener('click', beginRun);
btnAgain.addEventListener('click', beginRun);
btnMute.addEventListener('click', () => {
  game.sounds.ensure();
  const muted = game.sounds.toggleMute();
  btnMute.textContent = muted ? 'Unmute' : 'Mute';
});

// Keyboard: track held keys on the game, ignore repeats, keep arrows and
// space from scrolling the page.
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight',
]);
window.addEventListener('keydown', (ev) => {
  if (GAME_KEYS.has(ev.code)) ev.preventDefault();
  if (ev.code === 'KeyM') {
    game.sounds.ensure();
    btnMute.textContent = game.sounds.toggleMute() ? 'Unmute' : 'Mute';
    return;
  }
  if (ev.code === 'Enter' && game.state !== 'playing') {
    beginRun();
    return;
  }
  game.sounds.ensure();
  game.keys.add(ev.code);
});
window.addEventListener('keyup', (ev) => {
  game.keys.delete(ev.code);
});
window.addEventListener('blur', () => game.keys.clear());

// Click-to-move: translate the click into world coordinates.
canvas.addEventListener('pointerdown', (ev) => {
  game.sounds.ensure();
  const rect = canvas.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * WORLD.width;
  const y = ((ev.clientY - rect.top) / rect.height) * WORLD.height;
  game.setClickTarget(x, y);
});

// HUD refresh, once per frame.
function updateHud() {
  const snap = game.snapshot();
  hudLoot.textContent = `$${snap.lootValue} / $${snap.lootTotal}`;
  hudVaults.textContent = `${snap.vaultsCracked} / ${snap.vaultTotal} vaults`;
  hudTime.textContent = formatTime(snap.time);
  hudAlarm.textContent = `${Math.round(snap.alarm)}%`;
  hudAlarmFill.style.width = `${snap.alarm}%`;
  hudAlarmFill.classList.toggle('hot', snap.alarm >= 60);
  hudCams.textContent = snap.camerasDown ? 'Cameras: DOWN' : 'Cameras: live';
  hudCams.classList.toggle('down', snap.camerasDown);
  hudMessage.textContent = snap.message || (snap.interact ?? '');
}

// End-of-run overlay, shown once when the state flips.
let lastShownState = 'menu';
function updateOverlays() {
  if (game.state === lastShownState) return;
  lastShownState = game.state;
  if (game.state === 'won') {
    endTitle.textContent = 'Clean Getaway!';
    endTitle.classList.add('win');
    endStats.textContent = `${game.endReason} Vaults cracked: ${game.vaultsCracked}/${game.vaults.length}.`;
    showOverlay('end');
  } else if (game.state === 'lost') {
    endTitle.textContent = 'Busted!';
    endTitle.classList.remove('win');
    endStats.textContent = `${game.endReason} Loot kept: $${game.lootValue}.`;
    showOverlay('end');
  }
}

// The animation loop: fixed-dt steps so the simulation is stable.
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  updateHud();
  updateOverlays();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Headless playtest / screenshot hook. Read-only state plus a few debug
// helpers; the game never calls these itself.
window.__vaultbreak = {
  game,
  snapshot: () => game.snapshot(),
  start: () => beginRun(),
  debug: {
    teleport: (x, y) => {
      game.player.x = x;
      game.player.y = y;
      game.clickTarget = null;
    },
    setAlarm: (v) => {
      game.alarm = v;
    },
    holdKey: (code) => game.keys.add(code),
    releaseKey: (code) => game.keys.delete(code),
    winNow: () => {
      for (const l of game.loot) {
        l.visible = true;
        l.taken = true;
      }
      game.lootValue = game.lootTotal;
      for (const v of game.vaults) v.cracked = true;
      game.player.x = 480;
      game.player.y = 560;
      game.win('Clean getaway (debug).');
    },
  },
};
