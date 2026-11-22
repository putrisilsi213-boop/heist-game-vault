// Vaultbreak — the game engine: movement, collision, vision cones,
// detection, the alarm meter, hacking, vault cracking, loot and win/lose.
// Rendering is plain Canvas 2D; the loop and DOM wiring live in main.js.

import { LEVEL, WORLD } from './levels.js';
import { SoundBank } from './audio.js';

const TAU = Math.PI * 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

// Smallest signed difference between two angles, in (-PI, PI].
function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Liang-Barsky clipping: does the segment (x1,y1)-(x2,y2) cross rect r?
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

// True when no wall blocks the straight line from eye to target.
function losClear(x1, y1, x2, y2, walls) {
  for (const w of walls) {
    if (segmentHitsRect(x1, y1, x2, y2, w)) return false;
  }
  return true;
}

// Is the target inside the watcher's vision cone (range + field of view)
// with a clear line of sight?
function canSee(eyeX, eyeY, facing, fov, range, tx, ty, walls) {
  const d = dist(eyeX, eyeY, tx, ty);
  if (d > range) return false;
  if (d < 1) return true;
  const toTarget = Math.atan2(ty - eyeY, tx - eyeX);
  if (Math.abs(angleDiff(toTarget, facing)) > fov / 2) return false;
  return losClear(eyeX, eyeY, tx, ty, walls);
}

// Move a circle (entity with x, y, radius) axis by axis so it slides
// along walls instead of sticking to them.
function moveCircle(e, dx, dy, walls) {
  const nx = clamp(e.x + dx, e.radius + 16, WORLD.width - 16 - e.radius);
  if (!circleHitsWalls(nx, e.y, e.radius, walls)) e.x = nx;
  const ny = clamp(e.y + dy, e.radius + 16, WORLD.height - 16 - e.radius);
  if (!circleHitsWalls(e.x, ny, e.radius, walls)) e.y = ny;
}

function circleHitsWalls(x, y, r, walls) {
  for (const w of walls) {
    const cx = clamp(x, w.x, w.x + w.w);
    const cy = clamp(y, w.y, w.y + w.h);
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  return false;
}

export class VaultbreakGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sounds = new SoundBank();
    this.keys = new Set();
    this.state = 'menu'; // menu | playing | won | lost
    this.time = 0;
    this.alarm = 0;
    this.lootValue = 0;
    this.message = '';
    this.messageUntil = 0;
    this.clickTarget = null;
    this.interact = null; // { kind: 'console' | 'vault', ref } | null
    this.interactProgress = 0;
    this.camerasDownUntil = 0;
    this.lastAlarmBeepAt = 0;
    this.endReason = '';
    this.reset();
  }

  reset() {
    const s = LEVEL.playerStart;
    this.player = { x: s.x, y: s.y, radius: 12, facing: -Math.PI / 2, sneaking: false, moving: false };
    this.guards = LEVEL.guards.map((g) => ({
      name: g.name,
      waypoints: g.waypoints,
      speed: g.speed,
      x: g.waypoints[0].x,
      y: g.waypoints[0].y,
      radius: 13,
      waypointIndex: 1,
      facing: 0,
      alertedUntil: 0,
      lastSeenAt: -99,
      chasing: false,
    }));
    this.cameras = LEVEL.cameras.map((c) => ({ ...c, angle: c.baseAngle, t: Math.random() * 10 }));
    this.vaults = LEVEL.vaults.map((v) => ({ ...v, cracked: false }));
    this.loot = LEVEL.loot.map((l) => ({ ...l, taken: false, visible: false }));
    this.consoleHacked = false;
    this.time = 0;
    this.alarm = 0;
    this.lootValue = 0;
    this.clickTarget = null;
    this.interact = null;
    this.interactProgress = 0;
    this.camerasDownUntil = 0;
    this.endReason = '';
    this.setMessage('Crack all 3 vaults, grab the loot, reach the exit.', 6);
  }

  start() {
    this.reset();
    this.state = 'playing';
    this.sounds.ensure();
    this.setMessage('Crack all 3 vaults, grab the loot, reach the exit.', 6);
  }

  setMessage(text, seconds = 4) {
    this.message = text;
    this.messageUntil = this.time + seconds;
  }

  get lootTotal() {
    return this.loot.reduce((n, l) => n + l.value, 0);
  }

  get vaultsCracked() {
    return this.vaults.filter((v) => v.cracked).length;
  }

  get lootCollected() {
    return this.loot.filter((l) => l.taken).length;
  }

  get camerasDown() {
    return this.time < this.camerasDownUntil;
  }

  get allLootTaken() {
    return this.loot.every((l) => l.taken);
  }

  setClickTarget(x, y) {
    if (this.state !== 'playing') return;
    this.clickTarget = { x: clamp(x, 24, WORLD.width - 24), y: clamp(y, 24, WORLD.height - 24) };
    this.sounds.click();
  }

  win(reason) {
    if (this.state !== 'playing') return;
    this.state = 'won';
    this.endReason = reason;
    this.sounds.win();
  }

  lose(reason) {
    if (this.state !== 'playing') return;
    this.state = 'lost';
    this.endReason = reason;
    this.sounds.caught();
  }

  // -- per-frame update -------------------------------------------------

  update(dt) {
    if (this.state !== 'playing') return;
    this.time += dt;

    this.updatePlayer(dt);
    this.updateGuards(dt);
    this.updateCameras(dt);
    this.updateDetection(dt);
    this.updateInteract(dt);
    this.updateLoot();
    this.updateExit();
  }

  updatePlayer(dt) {
    const p = this.player;
    const k = this.keys;
    let mx = 0;
    let my = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my += 1;

    // Any WASD/arrow press cancels a click-to-move order.
    if (mx !== 0 || my !== 0) this.clickTarget = null;

    if (mx === 0 && my === 0 && this.clickTarget) {
      const d = dist(p.x, p.y, this.clickTarget.x, this.clickTarget.y);
      if (d < 8) {
        this.clickTarget = null;
      } else {
        mx = (this.clickTarget.x - p.x) / d;
        my = (this.clickTarget.y - p.y) / d;
      }
    }

    p.sneaking = k.has('ShiftLeft') || k.has('ShiftRight');
    const speed = p.sneaking ? 80 : 150;
    const len = Math.hypot(mx, my);
    p.moving = len > 0;
    if (p.moving) {
      const nx = (mx / len) * speed * dt;
      const ny = (my / len) * speed * dt;
      moveCircle(p, nx, ny, LEVEL.walls);
      p.facing = Math.atan2(my, mx);
      this.sounds.step();
    }
  }

  updateGuards(dt) {
    const p = this.player;
    for (const g of this.guards) {
      const speedBoost = this.alarm >= 50 ? 1.2 : 1;
      let tx;
      let ty;
      let speed = g.speed * speedBoost;
      if (g.chasing) {
        tx = p.x;
        ty = p.y;
        speed = 96 * speedBoost;
        if (this.time - g.lastSeenAt > 4) g.chasing = false;
      } else {
        const wp = g.waypoints[g.waypointIndex];
        tx = wp.x;
        ty = wp.y;
      }
      const d = dist(g.x, g.y, tx, ty);
      if (d > 2) {
        const step = Math.min(d, speed * dt);
        const nx = ((tx - g.x) / d) * step;
        const ny = ((ty - g.y) / d) * step;
        moveCircle(g, nx, ny, LEVEL.walls);
        g.facing = Math.atan2(ny, nx);
      } else if (!g.chasing) {
        g.waypointIndex = (g.waypointIndex + 1) % g.waypoints.length;
      }
      // A guard that catches the player ends the run on the spot.
      if (dist(g.x, g.y, p.x, p.y) < g.radius + p.radius + 2) {
        this.lose(`Caught by the ${g.name}!`);
      }
    }
  }

  updateCameras(dt) {
    for (const c of this.cameras) {
      c.t += dt;
      c.angle = c.baseAngle + Math.sin(c.t * c.speed) * c.sweep;
    }
  }

  updateDetection(dt) {
    const p = this.player;
    const sneakFactor = p.sneaking ? 0.5 : 1;
    let seen = false;
    let seenByGuard = false;

    for (const g of this.guards) {
      if (canSee(g.x, g.y, g.facing, 1.3, 170, p.x, p.y, LEVEL.walls)) {
        seen = true;
        seenByGuard = true;
        g.lastSeenAt = this.time;
        if (!g.chasing) {
          g.chasing = true;
          this.sounds.spotted();
          this.setMessage(`Spotted by the ${g.name}! Break line of sight!`, 3);
        }
        this.alarm += 30 * sneakFactor * dt;
      }
    }

    if (!this.camerasDown) {
      for (const c of this.cameras) {
        if (canSee(c.x, c.y, c.angle, 1.05, 190, p.x, p.y, LEVEL.walls)) {
          seen = true;
          this.alarm += 24 * sneakFactor * dt;
        }
      }
    }

    if (!seen) {
      this.alarm = Math.max(0, this.alarm - 5 * dt);
    } else if (this.alarm >= 60 && this.time - this.lastAlarmBeepAt > 0.7) {
      this.lastAlarmBeepAt = this.time;
      this.sounds.alarmBeep();
    }
    this.alarm = clamp(this.alarm, 0, 100);
    if (seenByGuard) this.alarm = Math.min(100, this.alarm);
    if (this.alarm >= 100) this.lose('The alarm hit 100% — security locked the building down!');
  }

  nearestInteractable() {
    const p = this.player;
    const c = LEVEL.console;
    const ccx = c.x + c.w / 2;
    const ccy = c.y + c.h / 2;
    if (!this.consoleHacked && dist(p.x, p.y, ccx, ccy) < 70) {
      return { kind: 'console', label: 'Hold E — hack the cameras' };
    }
    for (const v of this.vaults) {
      if (v.cracked) continue;
      const vx = v.x + v.w / 2;
      const vy = v.y + v.h / 2;
      if (dist(p.x, p.y, vx, vy) < 80) {
        return { kind: 'vault', label: `Hold E — crack the ${v.name}`, ref: v };
      }
    }
    return null;
  }

  updateInteract(dt) {
    const target = this.nearestInteractable();
    const holdingE = this.keys.has('KeyE');
    if (!target || !holdingE) {
      if (this.interact && !holdingE) this.interactProgress = Math.max(0, this.interactProgress - dt * 0.5);
      this.interact = target;
      if (!target) this.interactProgress = 0;
      return;
    }
    this.interact = target;
    const needed = target.kind === 'console' ? 3 : 2.5;
    this.interactProgress += dt / needed;
    if (Math.random() < dt * 4) this.sounds.hackTick();
    if (this.interactProgress >= 1) {
      this.interactProgress = 0;
      if (target.kind === 'console') this.finishHack();
      else this.finishCrack(target.ref);
    }
  }

  finishHack() {
    this.consoleHacked = true;
    this.camerasDownUntil = this.time + 20;
    this.alarm = Math.max(0, this.alarm - 25);
    this.sounds.hackDone();
    this.setMessage('Cameras disabled for 20 seconds. Move fast!', 4);
  }

  finishCrack(vault) {
    vault.cracked = true;
    for (const l of this.loot) {
      if (l.vault === vault.id) l.visible = true;
    }
    this.sounds.crackDone();
    this.setMessage(`${vault.name} cracked — grab the loot inside!`, 4);
  }

  updateLoot() {
    const p = this.player;
    for (const l of this.loot) {
      if (!l.visible || l.taken) continue;
      if (dist(p.x, p.y, l.x, l.y) < 24) {
        l.taken = true;
        this.lootValue += l.value;
        this.sounds.pickup();
        if (this.allLootTaken) {
          this.setMessage('All loot grabbed — get to the exit!', 5);
        }
      }
    }
  }

  updateExit() {
    if (!this.allLootTaken) return;
    const p = this.player;
    const e = LEVEL.exit;
    if (p.x > e.x && p.x < e.x + e.w && p.y > e.y && p.y < e.y + e.h) {
      const mins = Math.floor(this.time / 60);
      const secs = Math.floor(this.time % 60).toString().padStart(2, '0');
      this.win(`Clean getaway in ${mins}:${secs} with $${this.lootValue} in loot.`);
    }
  }

  // -- rendering ----------------------------------------------------------

  drawCone(x, y, angle, fov, range, color) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range, angle - fov / 2, angle + fov / 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  render() {
    const ctx = this.ctx;
    const W = WORLD.width;
    const H = WORLD.height;
    ctx.clearRect(0, 0, W, H);

    // Floor.
    ctx.fillStyle = '#14161d';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 32; x < W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 32; y < H; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Vault room floors.
    ctx.fillStyle = 'rgba(212,175,55,0.07)';
    for (const v of this.vaults) ctx.fillRect(v.x - 72, v.y - 70, 200, 180);

    // Exit zone.
    const e = LEVEL.exit;
    ctx.fillStyle = this.allLootTaken ? 'rgba(74,222,128,0.35)' : 'rgba(74,222,128,0.12)';
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.strokeRect(e.x + 1, e.y + 1, e.w - 2, e.h - 2);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', e.x + e.w / 2, e.y + e.h / 2 + 5);

    // Vision cones (under the entities, over the floor).
    for (const g of this.guards) {
      const seeing = this.state === 'playing' && canSee(g.x, g.y, g.facing, 1.3, 170, this.player.x, this.player.y, LEVEL.walls);
      this.drawCone(g.x, g.y, g.facing, 1.3, 170, seeing ? 'rgba(239,68,68,0.20)' : 'rgba(250,204,21,0.13)');
    }
    if (!this.camerasDown) {
      for (const c of this.cameras) {
        const seeing = this.state === 'playing' && canSee(c.x, c.y, c.angle, 1.05, 190, this.player.x, this.player.y, LEVEL.walls);
        this.drawCone(c.x, c.y, c.angle, 1.05, 190, seeing ? 'rgba(239,68,68,0.18)' : 'rgba(96,165,250,0.12)');
      }
    }

    // Walls.
    for (const w of LEVEL.walls) {
      ctx.fillStyle = '#2b2f3a';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#3d4252';
      ctx.fillRect(w.x, w.y, w.w, 3);
    }

    // Hack console.
    const c = LEVEL.console;
    ctx.fillStyle = this.consoleHacked ? '#14532d' : '#0e7490';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
    ctx.fillStyle = '#a5f3fc';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText(this.consoleHacked ? 'HACKED' : 'HACK', c.x + c.w / 2, c.y + c.h / 2 + 3);

    // Vaults.
    for (const v of this.vaults) {
      ctx.fillStyle = v.cracked ? '#3f3f46' : '#52525b';
      ctx.fillRect(v.x, v.y, v.w, v.h);
      ctx.strokeStyle = v.cracked ? '#4ade80' : '#d4af37';
      ctx.lineWidth = 3;
      ctx.strokeRect(v.x + 1.5, v.y + 1.5, v.w - 3, v.h - 3);
      ctx.beginPath();
      ctx.arc(v.x + v.w / 2, v.y + v.h / 2, 9, 0, TAU);
      ctx.fillStyle = v.cracked ? '#4ade80' : '#d4af37';
      ctx.fill();
      ctx.fillStyle = '#18181b';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(v.id, v.x + v.w / 2, v.y + v.h / 2 + 4);
      if (!v.cracked) {
        ctx.fillStyle = '#d4af37';
        ctx.font = '10px system-ui, sans-serif';
        ctx.fillText(v.name.toUpperCase(), v.x + v.w / 2, v.y - 8);
      }
    }

    // Loot stacks.
    for (const l of this.loot) {
      if (!l.visible || l.taken) continue;
      const pulse = 1 + Math.sin(this.time * 5 + l.x) * 0.08;
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-9, -6, 18, 12);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-9, -2, 18, 3);
      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillText('$', 0, 3);
      ctx.restore();
    }

    // Cameras.
    for (const cam of this.cameras) {
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.rotate(cam.angle);
      ctx.fillStyle = this.camerasDown ? '#374151' : '#dc2626';
      ctx.fillRect(-6, -6, 12, 12);
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.arc(8, 0, 4, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // Guards.
    for (const g of this.guards) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.beginPath();
      ctx.arc(0, 0, g.radius, 0, TAU);
      ctx.fillStyle = g.chasing ? '#dc2626' : '#f97316';
      ctx.fill();
      ctx.strokeStyle = '#fff7ed';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.rotate(g.facing);
      ctx.fillStyle = '#fff7ed';
      ctx.beginPath();
      ctx.moveTo(g.radius + 4, 0);
      ctx.lineTo(g.radius - 4, -5);
      ctx.lineTo(g.radius - 4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Player.
    const p = this.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, TAU);
    ctx.fillStyle = p.sneaking ? '#0ea5e9' : '#22c55e';
    ctx.fill();
    ctx.strokeStyle = '#f0fdf4';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.rotate(p.facing);
    ctx.fillStyle = '#f0fdf4';
    ctx.beginPath();
    ctx.moveTo(p.radius + 3, 0);
    ctx.lineTo(p.radius - 5, -5);
    ctx.lineTo(p.radius - 5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Click-to-move marker.
    if (this.clickTarget) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.clickTarget.x, this.clickTarget.y, 7, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.clickTarget.x - 10, this.clickTarget.y);
      ctx.lineTo(this.clickTarget.x + 10, this.clickTarget.y);
      ctx.moveTo(this.clickTarget.x, this.clickTarget.y - 10);
      ctx.lineTo(this.clickTarget.x, this.clickTarget.y + 10);
      ctx.stroke();
    }

    // Interact progress ring over the player.
    if (this.interact && this.interactProgress > 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 8, -Math.PI / 2, -Math.PI / 2 + this.interactProgress * TAU);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // Red vignette as the alarm climbs.
    if (this.alarm > 40) {
      const a = ((this.alarm - 40) / 60) * 0.35;
      const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
      grad.addColorStop(0, 'rgba(220,38,38,0)');
      grad.addColorStop(1, `rgba(220,38,38,${a.toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Snapshot for the HUD and for headless playtests.
  snapshot() {
    return {
      state: this.state,
      time: Math.round(this.time * 100) / 100,
      alarm: Math.round(this.alarm * 10) / 10,
      lootValue: this.lootValue,
      lootTotal: this.lootTotal,
      lootCollected: this.lootCollected,
      lootCount: this.loot.length,
      vaultsCracked: this.vaultsCracked,
      vaultTotal: this.vaults.length,
      camerasDown: this.camerasDown,
      consoleHacked: this.consoleHacked,
      player: { x: Math.round(this.player.x), y: Math.round(this.player.y), sneaking: this.player.sneaking },
      message: this.time < this.messageUntil ? this.message : '',
      endReason: this.endReason,
      interact: this.interact ? this.interact.label : null,
      interactProgress: Math.round(this.interactProgress * 100) / 100,
    };
  }
}
