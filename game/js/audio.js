// Vaultbreak — synthesized WebAudio sounds. No audio files, no network.
let ctx = null; let muted = false;
export function isMuted() { return muted; }
export function toggleMute() { muted = !muted; return muted; }
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, dur, type = 'sine', vol = 0.08, when = 0, slideTo = null) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
export const sfx = {
  step() { tone(140 + Math.random() * 40, 0.05, 'triangle', 0.02); },
  coin() { tone(880, 0.09, 'sine', 0.07); tone(1320, 0.14, 'sine', 0.06, 0.07); },
  seal() { tone(523, 0.12, 'sine', 0.08); tone(659, 0.12, 'sine', 0.08, 0.1); tone(784, 0.22, 'sine', 0.08, 0.2); },
  seen() { tone(220, 0.35, 'sawtooth', 0.09, 0, 440); tone(110, 0.4, 'square', 0.05, 0.05); },
  caught() { tone(330, 0.5, 'sawtooth', 0.1, 0, 82); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'sine', 0.08, i * 0.11)); },
  hack() { tone(1200, 0.06, 'square', 0.05); tone(900, 0.06, 'square', 0.05, 0.07); tone(1500, 0.12, 'sine', 0.06, 0.14); },
  click() { tone(660, 0.05, 'sine', 0.05); },
};
