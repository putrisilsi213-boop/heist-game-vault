// Vaultbreak — top-down heist. Original game: Kit, a thief, cracks the vaults
// of the Halcyon Bank and slips out the getaway door. Guards patrol with vision
// cones, wall cameras sweep red cones, walls and safes block sight and movement,
// dark shadow zones hide you, running is loud, sneaking (Shift) is slow and
// quiet. Press E at the hack console to kill the cameras for 12 seconds.
// Being seen (or filmed) raises the ALARM meter; at 100% the guards chase.
import { LEVELS } from './levels.js';
import { sfx, toggleMute, isMuted } from './audio.js';

const W = 960, H = 600;
const $ = (id) => document.getElementById(id);

function inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
function circleRect(cx, cy, rad, r) {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < rad * rad;
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

export class Game {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.state = 'menu'; this.levelIdx = 0;
    this.hearts = 3; this.score = 0; this.spotted = 0; this.time = 0;
    this.alarm = 0; this.lootGot = false; this.gemsGot = 0;
    this.camOffT = 0; this.hackCd = 0; this.camT = 0;
    this.keys = {}; this.moveTarget = null; this.stepT = 0; this.flash = 0;
    this.best = JSON.parse(localStorage.getItem('vaultbreak-best') || '{}');
    this.loadLevel(0, true);
    this.bindInput();
    this.last = performance.now();
    const loop = (t) => { const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t; this.tick(dt); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  solids() { const L = this.level; return L.walls.concat(L.crates); }
  loadLevel(i, fresh = false) {
    this.levelIdx = i; this.level = LEVELS[i];
    const L = this.level;
    this.player = { x: L.playerStart[0], y: L.playerStart[1], r: 13, dir: 0 };
    this.guards = L.guards.map((g) => ({
      x: g.path[0][0], y: g.path[0][1], r: 14, path: g.path, wp: 1, dir: 0,
      pause: 0, speed: g.speed, range: g.range, fov: g.fov,
      mode: 'patrol', loseT: 0, inv: null, seenT: 0,
    }));
    this.cameras = L.cameras.map((c) => ({ ...c, dir: c.base, on: true }));
    this.lootGot = false; this.alarm = 0; this.time = 0; this.spotted = 0;
    this.camOffT = 0; this.hackCd = 0; this.camT = 0;
    this.gems = L.gems.map((c) => ({ x: c[0], y: c[1], got: false }));
    this.gemsGot = 0; this.moveTarget = null;
    if (fresh) { this.hearts = 3; this.score = 0; }
    this.updateHud();
  }

  startLevel(i) {
    this.loadLevel(i); this.state = 'playing';
    $('menu-overlay').hidden = true; $('end-overlay').hidden = true;
    this.updateHud();
  }
  toMenu() { this.state = 'menu'; $('menu-overlay').hidden = false; $('end-overlay').hidden = true; this.renderMenuCards(); }
  fail() {
    this.state = 'failed';
    $('end-title').textContent = 'Busted at the vault door';
    $('end-stars').textContent = '✕ ✕ ✕';
    $('end-detail').textContent = `The bank keeps its diamonds. Score ${this.score} — try a quieter route.`;
    $('next-btn').hidden = true; $('end-overlay').hidden = false; sfx.caught();
  }
  completeLevel() {
    const timeBonus = Math.max(0, this.level.par - Math.floor(this.time)) * 5;
    this.score += timeBonus;
    const stars = this.spotted === 0 && this.time <= this.level.par ? 3 : this.spotted <= 1 ? 2 : 1;
    const key = 'L' + (this.levelIdx + 1);
    if (!this.best[key] || this.score > this.best[key]) { this.best[key] = this.score; localStorage.setItem('vaultbreak-best', JSON.stringify(this.best)); }
    this.state = this.levelIdx === LEVELS.length - 1 ? 'gameComplete' : 'levelComplete';
    $('end-title').textContent = this.state === 'gameComplete' ? 'The Star Diamond is yours — clean getaway' : 'Vault cracked — clean getaway';
    $('end-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    $('end-detail').textContent = `${this.level.name} · ${this.gemsGot} gems · time ${this.fmtTime()} (par ${this.level.par}s) · spotted ${this.spotted}× · time bonus +${timeBonus} · score ${this.score}`;
    $('next-btn').hidden = this.state === 'gameComplete';
    $('next-btn').textContent = 'Next vault → (N)';
    $('end-overlay').hidden = false; sfx.win();
  }

  fmtTime() { const s = Math.floor(this.time); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  // --- line of sight: sample the segment; walls and safes block it ---
  losBlocked(x1, y1, x2, y2) {
    const solids = this.solids();
    const d = Math.hypot(x2 - x1, y2 - y1); const steps = Math.max(1, Math.ceil(d / 6));
    for (let i = 1; i < steps; i++) {
      const x = x1 + ((x2 - x1) * i) / steps, y = y1 + ((y2 - y1) * i) / steps;
      for (const r of solids) if (inRect(x, y, r)) return true;
    }
    return false;
  }
  inShadow(x, y) { return this.level.shadows.some((b) => Math.hypot(x - b.x, y - b.y) < b.r); }
  // strength 0..1 that a watcher at (x,y) facing dir with range/fov sees the player
  watcherSees(x, y, dir, range, fov) {
    const p = this.player; const d = Math.hypot(p.x - x, p.y - y);
    if (d > range) return 0;
    if (this.inShadow(p.x, p.y) && d > 42) return 0;
    if (Math.abs(angDiff(Math.atan2(p.y - y, p.x - x), dir)) > fov / 2) return 0;
    if (this.losBlocked(x, y, p.x, p.y)) return 0;
    const prox = 1 - (d / range) * 0.55;
    return prox * (this.sneaking ? 0.45 : 1);
  }
  guardSees(g) { return this.watcherSees(g.x, g.y, g.dir, g.range, g.fov); }
  cameraSees(cam) {
    if (this.camOffT > 0) return 0;
    return this.watcherSees(cam.x, cam.y, cam.dir, cam.range, cam.fov);
  }
  nearConsole() {
    const c = this.level.console;
    return Math.hypot(this.player.x - c[0], this.player.y - c[1]) < 62;
  }
  hack() {
    if (this.state !== 'playing') return;
    if (!this.nearConsole()) return;
    if (this.hackCd > 0) { this.toast(`Cameras rebooting — hack ready in ${Math.ceil(this.hackCd)}s.`); return; }
    this.camOffT = 12; this.hackCd = 24; sfx.hack();
    this.toast('Cameras hacked — blind for 12 seconds!');
    this.updateHud();
  }

  moveCircle(e, dx, dy) {
    const solids = this.solids();
    let nx = e.x + dx;
    if (!solids.some((r) => circleRect(nx, e.y, e.r, r))) e.x = Math.max(18 + e.r, Math.min(942 - e.r, nx));
    let ny = e.y + dy;
    if (!solids.some((r) => circleRect(e.x, ny, e.r, r))) e.y = Math.max(18 + e.r, Math.min(582 - e.r, ny));
  }

  tick(dt) {
    if (this.state === 'playing') this.update(dt);
    this.render();
    if (this.flash > 0) this.flash -= dt;
  }

  update(dt) {
    this.time += dt;
    this.camT += dt;
    if (this.camOffT > 0) this.camOffT -= dt;
    if (this.hackCd > 0) this.hackCd -= dt;
    // sweep the cameras
    for (const cam of this.cameras) cam.dir = cam.base + Math.sin(this.camT * cam.speed) * cam.sweep;
    const p = this.player;
    this.sneaking = !!(this.keys['shift']);
    const speed = this.sneaking ? 95 : 175;
    let dx = 0, dy = 0;
    if (this.keys['arrowup'] || this.keys['w']) dy -= 1;
    if (this.keys['arrowdown'] || this.keys['s']) dy += 1;
    if (this.keys['arrowleft'] || this.keys['a']) dx -= 1;
    if (this.keys['arrowright'] || this.keys['d']) dx += 1;
    if (dx || dy) {
      const n = Math.hypot(dx, dy); dx /= n; dy /= n; this.moveTarget = null;
      p.dir = Math.atan2(dy, dx);
      this.moveCircle(p, dx * speed * dt, dy * speed * dt);
      this.stepT += dt; if (this.stepT > (this.sneaking ? 0.55 : 0.32)) { this.stepT = 0; sfx.step(); }
    } else if (this.moveTarget) {
      const d = Math.hypot(this.moveTarget.x - p.x, this.moveTarget.y - p.y);
      if (d < 8) this.moveTarget = null;
      else {
        const vx = (this.moveTarget.x - p.x) / d, vy = (this.moveTarget.y - p.y) / d;
        p.dir = Math.atan2(vy, vx);
        const ox = p.x, oy = p.y;
        this.moveCircle(p, vx * speed * dt, vy * speed * dt);
        if (Math.hypot(p.x - ox, p.y - oy) < 0.5) this.moveTarget = null; // blocked
      }
    }
    const hidden = this.inShadow(p.x, p.y);
    p.hidden = hidden;

    // pickups
    for (const c of this.gems) if (!c.got && Math.hypot(p.x - c.x, p.y - c.y) < 26) { c.got = true; this.gemsGot++; this.score += 50; sfx.coin(); }
    if (!this.lootGot && Math.hypot(p.x - this.level.vault[0], p.y - this.level.vault[1]) < 32) {
      this.lootGot = true; this.score += 200; sfx.seal(); this.toast('Star Diamond taken — now reach the getaway door!');
    }
    if (this.lootGot && inRect(p.x, p.y, this.level.exit)) { this.completeLevel(); return; }

    // cameras: filming raises the alarm faster than a guard's glance
    let camSee = 0;
    for (const cam of this.cameras) camSee = Math.max(camSee, this.cameraSees(cam));

    // guards
    let anySee = camSee * 1.4; let chaser = null;
    for (const g of this.guards) {
      const see = this.guardSees(g);
      if (see > 0) { anySee = Math.max(anySee, see); g.seenT += dt; } else g.seenT = Math.max(0, g.seenT - dt * 2);
      if (g.mode === 'patrol') {
        if (this.alarm >= 100) { g.mode = 'chase'; }
        else if (g.pause > 0) g.pause -= dt;
        else {
          const t = g.path[g.wp]; const d = Math.hypot(t[0] - g.x, t[1] - g.y);
          if (d < 6) { g.wp = (g.wp + 1) % g.path.length; g.pause = 0.9; }
          else { const vx = (t[0] - g.x) / d, vy = (t[1] - g.y) / d; g.dir = Math.atan2(vy, vx); this.moveCircle(g, vx * g.speed * dt, vy * g.speed * dt); }
        }
        // noise: running player heard nearby
        if (!this.sneaking && (dx || dy) && Math.hypot(p.x - g.x, p.y - g.y) < 110 && !hidden) { g.mode = 'search'; g.inv = { x: p.x, y: p.y }; }
      } else if (g.mode === 'chase') {
        chaser = g;
        const d = Math.hypot(p.x - g.x, p.y - g.y);
        if (d > 1) {
          const vx = (p.x - g.x) / d, vy = (p.y - g.y) / d; g.dir = Math.atan2(vy, vx);
          this.moveCircle(g, vx * (g.speed + 55) * dt, vy * (g.speed + 55) * dt);
        }
        if (d < 24) { this.caught(); return; }
        if (see <= 0 && camSee <= 0) { g.loseT += dt; if (g.loseT > 3) { g.mode = 'search'; g.inv = { x: p.x, y: p.y }; g.loseT = 0; } }
        else g.loseT = 0;
      } else { // search
        const t = g.inv || g.path[g.wp]; const d = Math.hypot(t[0] - g.x, t[1] - g.y);
        if (d < 8) { g.mode = 'patrol'; g.inv = null; }
        else { const vx = (t[0] - g.x) / d, vy = (t[1] - g.y) / d; g.dir = Math.atan2(vy, vx); this.moveCircle(g, vx * g.speed * dt, vy * g.speed * dt); }
        if (this.alarm >= 100) g.mode = 'chase';
      }
    }
    if (anySee > 0) {
      const was = this.alarm;
      this.alarm = Math.min(100, this.alarm + anySee * 55 * dt);
      if (was < 100 && this.alarm >= 100) { this.spotted++; sfx.seen(); this.toast('ALARM! Break line of sight!'); }
    } else this.alarm = Math.max(0, this.alarm - 30 * dt);
    if (chaser) this.alarm = 100;
    this.updateHud();
  }

  caught() {
    this.hearts--; this.flash = 0.6; sfx.caught();
    if (this.hearts <= 0) { this.updateHud(); this.fail(); return; }
    this.toast(`Caught! ${this.hearts} ${this.hearts === 1 ? 'chance' : 'chances'} left — back to the start.`);
    const L = this.level;
    this.player.x = L.playerStart[0]; this.player.y = L.playerStart[1];
    this.moveTarget = null; this.alarm = 0; this.camOffT = 0;
    for (const g of this.guards) { g.x = g.path[0][0]; g.y = g.path[0][1]; g.wp = 1; g.mode = 'patrol'; g.inv = null; g.loseT = 0; }
    this.updateHud();
  }

  toast(msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(this._toastT); this._toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }

  updateHud() {
    $('level-name').textContent = `Level ${this.levelIdx + 1} · ${this.level.name}`;
    $('loot-state').textContent = this.lootGot ? '◆ Star Diamond taken — reach the getaway' : '◇ Star Diamond not yet taken';
    $('gem-count').textContent = String(this.gemsGot);
    $('score-value').textContent = String(this.score);
    $('time-value').textContent = this.fmtTime();
    $('hearts').textContent = '♥'.repeat(Math.max(0, this.hearts)) + '♡'.repeat(Math.max(0, 3 - this.hearts));
    const det = $('alarm-fill'); det.style.width = this.alarm.toFixed(0) + '%';
    det.style.background = this.alarm >= 100 ? '#e5484d' : this.alarm >= 55 ? '#f5a524' : '#7dd3a8';
    $('alarm-label').textContent = this.alarm >= 100 ? '🚨 ALARM — RUN!' : this.alarm >= 55 ? 'Suspicious…' : this.player?.hidden ? 'Hidden in shadow' : 'Unseen';
    $('cam-state').textContent = this.camOffT > 0
      ? `📷 Cameras blind ${Math.ceil(this.camOffT)}s`
      : this.nearConsole() && this.hackCd <= 0 ? '💻 Press E — hack the cameras' : `📷 ${this.cameras.length} camera${this.cameras.length === 1 ? '' : 's'} live`;
    $('best-line').textContent = this.best['L' + (this.levelIdx + 1)] ? `Best on this level: ${this.best['L' + (this.levelIdx + 1)]}` : 'No best score yet on this level';
  }

  renderMenuCards() {
    const wrap = $('level-cards'); wrap.innerHTML = '';
    LEVELS.forEach((L, i) => {
      const b = document.createElement('button');
      b.className = 'level-card'; b.type = 'button';
      b.innerHTML = `<b>${i + 1} · ${L.name}</b><span>${L.sub}</span><span class="par">Par ${L.par}s · ${L.guards.length} guards · ${L.cameras.length} camera${L.cameras.length === 1 ? '' : 's'} · best ${this.best['L' + (i + 1)] || '—'}</span>`;
      b.onclick = () => { sfx.click(); this.startLevel(i); };
      wrap.appendChild(b);
    });
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      this.keys[k] = true;
      if (k === 'm') { const m = toggleMute(); $('mute-btn').textContent = m ? '🔇' : '🔊'; }
      if (k === 'e' && !e.repeat) this.hack();
      if (k === 'escape') { if (this.state === 'playing') this.toMenu(); else if (this.state !== 'menu') this.toMenu(); }
      if (k === 'r' && this.state !== 'menu') this.startLevel(this.levelIdx);
      if (k === 'n' && (this.state === 'levelComplete')) this.startLevel(this.levelIdx + 1);
      if (k === 'enter' && this.state === 'menu') this.startLevel(0);
      if (['1', '2', '3'].includes(k) && this.state === 'menu') this.startLevel(Number(k) - 1);
      if (k === 'shift') this.sneaking = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    this.cv.addEventListener('click', (e) => {
      if (this.state !== 'playing') return;
      const r = this.cv.getBoundingClientRect();
      this.moveTarget = { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    });
    $('mute-btn').onclick = () => { const m = toggleMute(); $('mute-btn').textContent = m ? '🔇' : '🔊'; };
    $('menu-btn').onclick = () => this.toMenu();
    $('replay-btn').onclick = () => { sfx.click(); this.startLevel(this.levelIdx); };
    $('next-btn').onclick = () => { sfx.click(); this.startLevel(this.levelIdx + 1); };
    $('end-menu-btn').onclick = () => this.toMenu();
  }

  conePolygon(x, y, dir, range, fov) {
    const pts = [[x, y]];
    const steps = Math.max(8, Math.floor(fov / 0.07));
    for (let i = 0; i <= steps; i++) {
      const a = dir - fov / 2 + (fov * i) / steps;
      let r = range;
      for (let d = 8; d <= range; d += 8) {
        const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
        if (this.solids().some((s) => inRect(px, py, s))) { r = d; break; }
      }
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    return pts;
  }
  drawCone(x, y, dir, range, fov, fill) {
    const c = this.ctx; const poly = this.conePolygon(x, y, dir, range, fov);
    c.beginPath(); c.moveTo(poly[0][0], poly[0][1]);
    for (const p of poly.slice(1)) c.lineTo(p[0], p[1]);
    c.closePath(); c.fillStyle = fill; c.fill();
  }

  render() {
    const c = this.ctx; const L = this.level;
    c.clearRect(0, 0, W, H);
    // marble floor
    c.fillStyle = '#171c2b'; c.fillRect(0, 0, W, H);
    for (let y = 0; y < 15; y++) for (let x = 0; x < 24; x++) {
      if ((x + y) % 2 === 0) { c.fillStyle = '#1b2136'; c.fillRect(x * 40, y * 40, 40, 40); }
    }
    // gold carpet runner (decorative)
    c.fillStyle = 'rgba(212,175,55,0.10)'; c.fillRect(0, 280, W, 40);
    // getaway door
    const ex = L.exit;
    const eg = c.createRadialGradient(ex.x + 28, ex.y + 38, 6, ex.x + 28, ex.y + 38, 90);
    eg.addColorStop(0, this.lootGot ? 'rgba(80,220,140,0.5)' : 'rgba(80,220,140,0.18)');
    eg.addColorStop(1, 'rgba(80,220,140,0)');
    c.fillStyle = eg; c.fillRect(ex.x - 60, ex.y - 60, 180, 200);
    c.fillStyle = this.lootGot ? '#2fbf71' : '#2a7a4d';
    c.fillRect(ex.x, ex.y, ex.w, ex.h);
    c.strokeStyle = '#b8f5d0'; c.lineWidth = 3; c.strokeRect(ex.x, ex.y, ex.w, ex.h);
    c.fillStyle = '#eafff2'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center';
    c.fillText('GETAWAY', ex.x + 28, ex.y + 44);
    // shadow zones
    for (const b of L.shadows) {
      c.fillStyle = '#0d1120'; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill();
      c.strokeStyle = '#2c3550'; c.lineWidth = 2; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.stroke();
      c.fillStyle = '#4a5570'; c.font = 'bold 10px sans-serif'; c.fillText('SHADOW', b.x, b.y + 3);
    }
    // safes (cover)
    for (const r of L.crates) {
      c.fillStyle = '#4a4f5e'; c.fillRect(r.x, r.y, r.w, r.h);
      c.strokeStyle = '#d4af37'; c.lineWidth = 3; c.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      c.beginPath(); c.arc(r.x + r.w / 2, r.y + r.h / 2, 12, 0, 7); c.stroke();
      c.fillStyle = '#d4af37'; c.beginPath(); c.arc(r.x + r.w / 2, r.y + r.h / 2, 4, 0, 7); c.fill();
    }
    // walls
    for (const r of L.walls) {
      c.fillStyle = '#3a4358'; c.fillRect(r.x, r.y, r.w, r.h);
      c.fillStyle = '#55618a'; if (r.h < r.w) c.fillRect(r.x, r.y, r.w, 5); else c.fillRect(r.x, r.y, 5, r.h);
    }
    // hack console
    const cn = L.console;
    c.fillStyle = this.hackCd > 0 ? '#3a3f4d' : '#1f6f8b'; c.fillRect(cn[0] - 16, cn[1] - 12, 32, 24);
    c.strokeStyle = '#7ee7ff'; c.lineWidth = 2; c.strokeRect(cn[0] - 16, cn[1] - 12, 32, 24);
    c.fillStyle = '#bfefff'; c.font = 'bold 9px sans-serif'; c.fillText('HACK', cn[0], cn[1] + 3);
    if (this.nearConsole() && this.state === 'playing') {
      c.fillStyle = '#7ee7ff'; c.font = 'bold 12px sans-serif'; c.fillText('press E', cn[0], cn[1] - 22);
    }
    // gems
    for (const co of this.gems) if (!co.got) {
      const bob = Math.sin(performance.now() / 300 + co.x) * 2;
      c.save(); c.translate(co.x, co.y + bob); c.rotate(Math.PI / 4);
      c.fillStyle = '#37e08b'; c.fillRect(-7, -7, 14, 14);
      c.strokeStyle = '#c9ffe4'; c.lineWidth = 1.5; c.strokeRect(-7, -7, 14, 14);
      c.restore();
    }
    // the vault + Star Diamond
    if (!this.lootGot) {
      const s = this.level.vault; const bob = Math.sin(performance.now() / 300) * 4;
      c.fillStyle = '#2c3145'; c.fillRect(s[0] - 34, s[1] - 26, 68, 52);
      c.strokeStyle = '#d4af37'; c.lineWidth = 3; c.strokeRect(s[0] - 34, s[1] - 26, 68, 52);
      c.save(); c.translate(s[0], s[1] + bob); c.rotate(Math.PI / 4);
      c.fillStyle = '#ffd94d'; c.fillRect(-12, -12, 24, 24);
      c.strokeStyle = '#fff3b0'; c.lineWidth = 2; c.strokeRect(-12, -12, 24, 24);
      c.restore();
      c.fillStyle = '#fff3b0'; c.font = 'bold 11px sans-serif'; c.fillText('STAR DIAMOND', s[0], s[1] + 44);
    }
    // camera cones (red) + camera bodies
    for (const cam of this.cameras) {
      if (this.camOffT <= 0) this.drawCone(cam.x, cam.y, cam.dir, cam.range, cam.fov, 'rgba(229,72,77,0.22)');
      c.fillStyle = this.camOffT > 0 ? '#555b6e' : '#e5484d';
      c.beginPath(); c.arc(cam.x, cam.y, 8, 0, 7); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(cam.x, cam.y, 8, 0, 7); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(cam.x + Math.cos(cam.dir) * 5, cam.y + Math.sin(cam.dir) * 5, 2.5, 0, 7); c.fill();
    }
    // guard vision cones + guards
    for (const g of this.guards) {
      this.drawCone(g.x, g.y, g.dir, g.range, g.fov,
        g.mode === 'chase' ? 'rgba(229,72,77,0.30)' : g.mode === 'search' ? 'rgba(245,165,36,0.25)' : 'rgba(245,196,66,0.20)');
      c.fillStyle = g.mode === 'chase' ? '#e5484d' : '#274b8f';
      c.beginPath(); c.arc(g.x, g.y, 14, 0, 7); c.fill();
      c.strokeStyle = '#ffd9d9'; c.lineWidth = 2; c.beginPath(); c.arc(g.x, g.y, 14, 0, 7); c.stroke();
      c.strokeStyle = '#ffe9a8'; c.lineWidth = 3; c.beginPath(); c.moveTo(g.x, g.y); c.lineTo(g.x + Math.cos(g.dir) * 20, g.y + Math.sin(g.dir) * 20); c.stroke();
      c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(g.x + Math.cos(g.dir) * 20, g.y + Math.sin(g.dir) * 20, 3.5, 0, 7); c.fill();
      if (g.mode === 'chase') { c.fillStyle = '#fff'; c.font = 'bold 20px sans-serif'; c.fillText('!', g.x, g.y - 22); }
      else if (g.mode === 'search') { c.fillStyle = '#ffd166'; c.font = 'bold 18px sans-serif'; c.fillText('?', g.x, g.y - 22); }
    }
    // move target marker
    if (this.moveTarget && this.state === 'playing') {
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2;
      c.beginPath(); c.arc(this.moveTarget.x, this.moveTarget.y, 8, 0, 7); c.stroke();
    }
    // player — Kit the thief
    const p = this.player;
    if (!(p.hidden && this.state === 'playing')) {
      c.fillStyle = '#3d2b63'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill();
      c.strokeStyle = '#b79ced'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.stroke();
      c.fillStyle = '#f2e6c9'; c.beginPath(); c.arc(p.x + Math.cos(p.dir) * 5, p.y + Math.sin(p.dir) * 5, 5, 0, 7); c.fill();
      if (this.lootGot) { c.fillStyle = '#ffd94d'; c.beginPath(); c.arc(p.x, p.y - 16, 4, 0, 7); c.fill(); }
    } else {
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = 'bold 11px sans-serif'; c.fillText('hidden', p.x, p.y - 20);
    }
    // running noise ring
    if (this.state === 'playing' && !this.sneaking && (this.keys['w'] || this.keys['a'] || this.keys['s'] || this.keys['d'] || this.keys['arrowup'] || this.keys['arrowdown'] || this.keys['arrowleft'] || this.keys['arrowright'])) {
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.setLineDash([4, 6]); c.beginPath(); c.arc(p.x, p.y, 52, 0, 7); c.stroke(); c.setLineDash([]);
    }
    if (this.flash > 0) { c.fillStyle = `rgba(229,72,77,${this.flash * 0.5})`; c.fillRect(0, 0, W, H); }
    if (this.state === 'menu') {
      c.fillStyle = 'rgba(8,12,22,0.55)'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#d4af37'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center';
      c.fillText('VAULTBREAK', W / 2, 250);
      c.fillStyle = '#dfe6f2'; c.font = '16px sans-serif';
      c.fillText('Crack the Halcyon Bank. Dodge the guards and cameras. Take the Star Diamond.', W / 2, 282);
    }
  }
}
