// Music: "Lightless Dawn" by Kevin MacLeod (incompetech.com), CC BY 4.0, streamed and looped.
// The score breathes with the reader: it opens up and swells while you scroll and settles when you stop.
// Before the big moments it drops toward silence (scrubbed by scroll, so the dip lands exactly on the beat).
// A few soft cues (Kenney, CC0): paper, a wax seal, glass, a crumple, a select.
const CUES = ['paper', 'seal', 'glass1', 'glass2', 'crumple', 'select', 'flip'];

export class Audio {
  constructor(base = './assets/audio/') {
    this.base = base;
    this.enabled = false;
    this.ctx = null;
    this.buf = {};
    this.motion = 0; this.dip = 0;
    this._lastSet = 0; this._f = 0; this._g = 0;
  }

  async enable() {
    this.enabled = true;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return false; }
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.0001;
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.5;
      this.lp = this.ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 1400; this.lp.Q.value = 0.4;
      this.musicGain.connect(this.lp); this.lp.connect(this.master); this.master.connect(this.ctx.destination);
      this.el = new window.Audio(this.base + 'lightless-dawn.mp3');
      this.el.loop = true; this.el.crossOrigin = 'anonymous'; this.el.preload = 'auto';
      try { this.ctx.createMediaElementSource(this.el).connect(this.musicGain); } catch (e) { /* fall back to the element's own output */ }
      this._loadCues();
    }
    if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch (e) { /* ignored */ } }
    try { await this.el.play(); } catch (e) { /* needs a gesture; the next click retries */ }
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(1, t, 0.8);
    return true;
  }

  disable() {
    this.enabled = false;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.25);
    setTimeout(() => { if (!this.enabled && this.el) this.el.pause(); }, 1200);
  }

  async _loadCues() {
    await Promise.all(CUES.map(async (n) => {
      try {
        const a = await (await fetch(this.base + n + '.mp3')).arrayBuffer();
        this.buf[n] = await new Promise((res, rej) => this.ctx.decodeAudioData(a, res, rej));
      } catch (e) { /* a missing cue is never fatal */ }
    }));
  }

  play(name, { vol = 0.5, rate = 1, delay = 0 } = {}) {
    if (!this.enabled || !this.ctx || !this.buf[name]) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.buf[name]; s.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(this.master); s.start(this.ctx.currentTime + delay);
  }

  // called every frame: m = how much the reader is moving (0..1), dip = scrubbed silence (0..1), lift = a swell (0..1)
  update(m, dip = 0, lift = 0) {
    if (!this.enabled || !this.ctx) return;
    const now = performance.now();
    if (now - this._lastSet < 60) return;
    this._lastSet = now;
    const f = (1100 + 7500 * Math.pow(m, 0.7) + 6000 * lift) * (1 - 0.85 * dip);
    const g = (0.42 + 0.33 * m + 0.25 * lift) * (1 - 0.92 * dip);
    const t = this.ctx.currentTime;
    if (Math.abs(f - this._f) > 40) { this.lp.frequency.setTargetAtTime(Math.max(180, f), t, 0.35); this._f = f; }
    if (Math.abs(g - this._g) > 0.01) { this.musicGain.gain.setTargetAtTime(Math.max(0.0001, g), t, 0.3); this._g = g; }
  }
}
