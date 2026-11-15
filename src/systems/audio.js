/** 极简 WebAudio 音效：不加载任何资源，全部实时合成 */
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.2;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.ctx = null;
    }
    return this.ctx;
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  tone(freq, to, dur, type = 'sine', gain = 0.5, delay = 0) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  coin() {
    this.tone(920, 1380, 0.09, 'triangle', 0.32);
    this.tone(1380, 1760, 0.07, 'sine', 0.16, 0.045);
  }

  hit() {
    this.tone(180, 60, 0.22, 'sawtooth', 0.35);
    this.tone(90, 45, 0.3, 'square', 0.18, 0.02);
  }

  boost() {
    this.tone(300, 900, 0.28, 'sawtooth', 0.1);
  }

  jump() {
    this.tone(320, 620, 0.14, 'triangle', 0.14);
  }

  smash() {
    this.tone(240, 70, 0.16, 'square', 0.28);
    this.tone(1100, 420, 0.07, 'sawtooth', 0.18);
  }

  heal() {
    this.tone(660, 880, 0.1, 'sine', 0.24);
    this.tone(880, 1320, 0.14, 'sine', 0.18, 0.08);
  }
}
