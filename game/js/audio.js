// Vaultbreak — tiny WebAudio synth. No audio files: every sound is a few
// oscillators shaped in code, created lazily on the first user gesture so
// the page never needs autoplay permission up front.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastStepAt = 0;
  }

  // Create (or resume) the audio context. Call from any user gesture.
  ensure() {
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctor();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  // One shaped oscillator note. `when` is a delay in seconds, `slideTo`
  // glides the pitch for alarm-style sounds.
  tone(freq, dur, type = 'sine', vol = 0.1, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const start = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  click() {
    this.tone(1200, 0.05, 'square', 0.05);
  }

  step() {
    // Soft footstep tick, throttled so it cannot machine-gun.
    const now = performance.now();
    if (now - this.lastStepAt < 260) return;
    this.lastStepAt = now;
    this.tone(170, 0.05, 'sine', 0.035);
  }

  pickup() {
    this.tone(660, 0.09, 'triangle', 0.12);
    this.tone(990, 0.13, 'triangle', 0.12, 0.07);
  }

  hackTick() {
    this.tone(1400, 0.04, 'square', 0.04);
  }

  hackDone() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.11, i * 0.07));
  }

  crackDone() {
    this.tone(392, 0.12, 'triangle', 0.12);
    this.tone(523, 0.12, 'triangle', 0.12, 0.08);
    this.tone(784, 0.2, 'triangle', 0.12, 0.16);
  }

  alarmBeep() {
    this.tone(880, 0.12, 'square', 0.05, 0, 620);
  }

  spotted() {
    this.tone(220, 0.3, 'sawtooth', 0.09, 0, 440);
  }

  caught() {
    [440, 349, 262, 196].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.1, i * 0.16));
  }

  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.12, i * 0.1));
  }
}
