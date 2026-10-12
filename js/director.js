// The director. Scroll becomes one smoothed number; that number sets the camera on a single continuous path,
// Doom's gestures, each chapter's pieces, the light, the score and the words. Nothing jumps on a timer
// except the intro and the oath, which happen only when the reader asks for them.
import * as THREE from 'three';
import { DOMAINS } from './gfx/world.js';
import { PHOTOS } from './gfx/assets.js';
import { LINES, SKIP_LINES, IDLE_LINES, POKE_LINES, DOMAIN_NAMES } from './story.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const s5 = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const bump = (a, b, c, d, x) => ss(a, b, x) * (1 - ss(c, d, x));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const IDS = ['summons', 'prediction', 'thesis', 'armoury', 'archive', 'future', 'oath', 'bench', 'farewell'];
const NAMES = ['The Summons', 'The Prediction', 'Science & Sorcery', 'The Armoury', 'The Archive', '2027', 'The Oath', 'The Bench'];

// the camera's path through the whole page: G = chapter index + progress through it
// [G, position, look-at, fov, horizontal lens shift (the subject moves right for +)]
const K = (g, p, l, fov, sx) => ({ g, p: V(...p), l: V(...l), fov, sx });
const KEYS = [
  K(0.00, [0.03, 1.79, 0.62], [0, 1.77, 0], 30, 0),
  K(0.30, [0.12, 1.76, 1.4], [0, 1.71, 0], 31, 0),
  K(0.64, [0.5, 1.56, 3.4], [0.02, 1.28, 0], 34, 0.3),
  K(1.00, [0.62, 1.52, 3.2], [0, 1.3, 0], 34, 0.2),
  K(1.45, [0.4, 1.5, 2.3], [-0.08, 1.36, 0.1], 34, 0.0),
  K(1.95, [0.5, 1.62, 3.6], [0, 1.45, 0], 36, 0),
  K(2.25, [0, 1.75, 6.0], [0, 1.8, -0.8], 38, 0),
  K(2.62, [0, 1.9, 5.6], [0, 2.15, -0.9], 38, 0),
  K(2.92, [0.85, 1.95, 5.1], [0.2, 2.35, -0.9], 38, 0.24),
  K(3.15, [0.75, 1.75, 4.5], [0.3, 1.3, 0], 38, 0.24),
  K(3.92, [0.6, 1.7, 4.1], [0.3, 1.3, 0], 38, 0.24),
  K(4.06, [1.2, 1.6, 4.6], [0.1, 1.35, 0], 36, 0.44),
  K(4.24, [1.5, 1.7, 5.4], [0.25, 1.4, 0], 36, 0.44),
  K(4.4, [2.3, 1.85, 5.9], [0.6, 1.5, 0], 36, 0),
  K(4.96, [2.6, 1.95, 6.2], [0.6, 1.5, 0], 36, 0),
  K(5.12, [0.45, 1.7, 5.4], [0, 1.7, 0], 38, 0.22),
  K(5.45, [0.25, 1.75, 4.4], [0, 1.75, 0], 40, 0.04),
  K(5.85, [-1.1, 1.85, 4.9], [0.35, 1.65, 0], 38, -0.22),
  K(6.22, [0.62, 1.56, 2.5], [-0.06, 1.32, 0.12], 34, 0.3),
  K(6.95, [0.58, 1.54, 2.4], [-0.06, 1.32, 0.12], 34, 0.3),
  K(7.15, [0.5, 1.6, 4.2], [0, 1.35, 0], 36, 0),
  K(7.95, [0.45, 1.6, 5.0], [0, 1.35, 0], 34, 0),
  K(8.5, [0.35, 1.6, 6.0], [0, 1.4, -0.5], 30, 0),
  K(9.0, [0.3, 1.6, 6.5], [0, 1.45, -0.5], 28, 0)
];
const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
function camAt(G) {
  let i = 0;
  while (i < KEYS.length - 2 && G > KEYS[i + 1].g) i++;
  const a = KEYS[Math.max(0, i - 1)], b = KEYS[i], c = KEYS[i + 1], d = KEYS[Math.min(KEYS.length - 1, i + 2)];
  const u = clamp((G - b.g) / Math.max(1e-4, c.g - b.g), 0, 1);
  const t = s5(u) * 0.6 + u * 0.4;
  const v = (k) => new THREE.Vector3(cr(a[k].x, b[k].x, c[k].x, d[k].x, t), cr(a[k].y, b[k].y, c[k].y, d[k].y, t), cr(a[k].z, b[k].z, c[k].z, d[k].z, t));
  return { pos: v('p'), look: v('l'), fov: cr(a.fov, b.fov, c.fov, d.fov, t), sx: cr(a.sx, b.sx, c.sx, d.sx, t) };
}

// light and grade per chapter, blended across boundaries
const LOOK = [
  { key: 1.3, rim: 2.4, rim2: 1.1, hemi: 0.28, exp: 1.0, bloom: 0.9, fog: 0.055, vig: 0.85 },
  { key: 1.4, rim: 2.4, rim2: 1.1, hemi: 0.3, exp: 1.0, bloom: 0.9, fog: 0.055, vig: 0.85 },
  { key: 1.1, rim: 2.6, rim2: 1.2, hemi: 0.22, exp: 1.0, bloom: 1.0, fog: 0.045, vig: 0.9 },
  { key: 1.4, rim: 2.4, rim2: 1.2, hemi: 0.3, exp: 1.02, bloom: 0.95, fog: 0.05, vig: 0.85 },
  { key: 0.9, rim: 2.2, rim2: 0.9, hemi: 0.2, exp: 1.0, bloom: 0.95, fog: 0.06, vig: 0.9 },
  { key: 1.0, rim: 2.8, rim2: 1.0, hemi: 0.2, exp: 1.0, bloom: 1.0, fog: 0.045, vig: 0.88 },
  { key: 1.45, rim: 2.2, rim2: 1.1, hemi: 0.28, exp: 1.02, bloom: 0.9, fog: 0.045, vig: 0.85 },
  { key: 0.8, rim: 2.2, rim2: 0.9, hemi: 0.16, exp: 0.9, bloom: 0.9, fog: 0.06, vig: 0.9 },
  { key: 0.55, rim: 2.8, rim2: 1.0, hemi: 0.1, exp: 0.95, bloom: 0.95, fog: 0.08, vig: 0.95 }
];

export class Director {
  constructor(o) {
    Object.assign(this, o);   // engine, world, doom, ui, subs, audio, mem, calm, submit
    this.cam = this.engine.camera;
    this.p = window.scrollY; this.pS = this.p;
    this.vel = 0; this.motion = 0;
    this.G = 0;
    this.introDone = false;
    this.chosen = this.mem.domain;
    this.sworn = this.mem.sworn;
    this.pointer = { nx: 0, ny: 0, x: -1, y: -1, has: false, t: 0, overUI: false };
    this.lastInput = performance.now();
    this.idle = false; this.idleN = 0; this.idleT = 0;
    this.pokes = 0; this._pokeT = 0;
    this.dwell = {};
    this.raycaster = new THREE.Raycaster();
    this.mobile = window.innerWidth <= 760;
    this.gaze = V(0, 1.7, 5);
    this.envDocked = false;
    this.front = 0;
    this._bloomKick = 0;
    this.scrollState = { crumple: 0, crumpleGoal: 0, roll: 0, rollGoal: 0 };
    this._bind();
  }

  // ------------------------------------------------------------------ input
  _bind() {
    const mark = () => { this.lastInput = performance.now(); if (this.idle) { this.idle = false; this.doom.drumming = false; } };
    const ptr = (e) => {
      this.pointer.x = e.clientX; this.pointer.y = e.clientY; this.pointer.has = true; this.pointer.t = performance.now();
      this.pointer.nx = (e.clientX / innerWidth) * 2 - 1; this.pointer.ny = -(e.clientY / innerHeight) * 2 + 1;
      this.pointer.overUI = !!(e.target && e.target.closest && e.target.closest('.blk, .hud, .envelope, .letter, button, a, input, .reel, .flow'));
    };
    window.addEventListener('pointermove', (e) => { ptr(e); mark(); }, { passive: true });
    window.addEventListener('pointerdown', (e) => { ptr(e); mark(); }, { passive: true });
    window.addEventListener('keydown', mark);
    window.addEventListener('wheel', mark, { passive: true });
    window.addEventListener('touchmove', mark, { passive: true });
    window.addEventListener('scroll', () => { if (Math.abs(this.vel) > 20) mark(); }, { passive: true });
    window.addEventListener('click', (e) => this._click(e));
    window.addEventListener('resize', () => { this.mobile = window.innerWidth <= 760; setTimeout(() => this.ui.measure(), 60); });
    document.querySelectorAll('#plateList .plate').forEach((b) => b.addEventListener('click', () => this.choose(+b.dataset.i)));
    document.getElementById('chooseBtn').addEventListener('click', () => this.choose(this.front));
    document.getElementById('envelope').addEventListener('click', () => {
      if (this.chosen >= 0) { this.ui.openLetter(DOMAIN_NAMES[this.chosen]); return; }
      const lines = ['Do not open this.', 'Doom said do not open this.', 'Patience.', 'It opens when you choose.'];
      this._envPokes = (this._envPokes || 0) + 1;
      this.ui.envelopeWiggle(lines[Math.min(lines.length - 1, this._envPokes - 1)]);
      this.audio.play('paper', { vol: 0.3 });
    });
    document.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); this.jumpTo(a.dataset.go, a.dataset.go === 'oath'); }));
    document.querySelector('.skip').addEventListener('click', (e) => { e.preventDefault(); this.jumpTo('oath', true); });
    document.getElementById('brand').addEventListener('click', (e) => { e.preventDefault(); this.jumpTo('summons'); });
    const email = document.getElementById('email');
    email.addEventListener('input', () => { this.world.scrollDraw(email.value.trim()); document.getElementById('emailErr').textContent = ''; email.classList.remove('is-err'); });
    email.addEventListener('focus', () => { if (this.id !== 'oath') this.jumpTo('oath', true); });
    document.getElementById('form').addEventListener('submit', (e) => { e.preventDefault(); this._submit(); });
  }

  _click(e) {
    if (!this.introDone || (e.target.closest && e.target.closest('a, button, input, label, .envelope, .letter, .flow, form'))) return;
    this.raycaster.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), this.cam);
    if (this.id === 'armoury') { const i = this.world.pickPlate(this.raycaster); if (i >= 0) { this.choose(i); return; } }
    if (this.raycaster.intersectObjects(this.doom.meshes, false).length) this._poke();
  }

  _poke() {
    const now = performance.now();
    if (now - this._pokeT > 6000) this.pokes = 0;
    this._pokeT = now; this.pokes++;
    this.doom.eyes = 2.2;
    if (POKE_LINES[this.pokes]) this.subs.say(POKE_LINES[this.pokes]);
    if (this.pokes >= 10) {
      this.pokes = 0;
      this.ui.enough();
      this.subs.say('ENOUGH.', 2200);
      this.doom.play('fists');
      this.doom.eyes = 5;
      this.engine.post.flash.set(0.4, 1.0, 0.6, 0.3);
      this.audio.play('seal', { vol: 0.8, rate: 0.6 });
    }
  }

  // ------------------------------------------------------------------ navigation
  jumpTo(id, focusForm) {
    const el = document.getElementById(id === 'top' ? 'summons' : id);
    if (!el) return;
    this.ui.veilTo(true);
    setTimeout(() => {
      let y = el.getBoundingClientRect().top + window.scrollY;
      if (id === 'oath') y += window.innerHeight * 0.3;
      if (this.lenis) this.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
      this.p = this.pS = y;
      this._snap = true;
      if (y > this.ui.acts[1].top + this.ui.acts[1].h * 0.5) this._dockEnvelope(false);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.ui.veilTo(false);
        if (focusForm) setTimeout(() => document.getElementById('email').focus({ preventScroll: true }), 500);
      }));
    }, this.calm ? 40 : 520);
  }

  // ------------------------------------------------------------------ the choice
  choose(i) {
    if (i === undefined || i < 0 || this.chosen === i) return;
    this.chosen = i; this.mem.setDomain(i);
    const name = DOMAIN_NAMES[i];
    document.querySelectorAll('#plateList .plate').forEach((b) => b.classList.toggle('is-chosen', +b.dataset.i === i));
    const cl = document.getElementById('chosenLine'); cl.hidden = false; cl.textContent = `Your domain: ${name}. The envelope knew.`;
    this.audio.play('select', { vol: 0.5 }); this.audio.play('paper', { vol: 0.45, delay: 0.3 });
    this._dockEnvelope(false);
    this.subs.say(`*${name}.* As foretold.`);
    this.ui.openLetter(name);
  }

  _dockEnvelope(land) {
    if (this.envDocked) return;
    this.envDocked = true;
    this.ui.envelopeIn(land);
    if (land) this.audio.play('paper', { vol: 0.35 });
  }

  // ------------------------------------------------------------------ the oath
  async _submit() {
    const input = document.getElementById('email'), err = document.getElementById('emailErr'), btn = document.getElementById('sealBtn');
    const em = input.value.trim();
    if (this._sealing || this.sworn) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(em)) {
      err.textContent = em ? 'That is not an address. Again.' : 'Doom requires an address.';
      input.classList.add('is-err');
      const f = document.getElementById('form'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
      this.audio.play('crumple', { vol: 0.6 });
      this.subs.say('That is not an address. Again.');
      this.doom.play('crush', () => { this.scrollState.crumpleGoal = 0; });
      this.scrollState.crumpleGoal = 1;
      input.focus();
      return;
    }
    this._sealing = true;
    btn.classList.add('busy'); btn.disabled = true;
    try { await this.submit(em); }
    catch (e) { btn.classList.remove('busy'); btn.disabled = false; this._sealing = false; err.textContent = 'The ledger did not answer. Try again.'; return; }
    const local = em.split('@')[0].replace(/[._\-+]+/g, ' ').replace(/\d+/g, ' ').trim() || em.split('@')[0];
    const name = local.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').slice(0, 20);
    this.mem.swear(name);
    await this._seal(em);
  }

  async _seal(email) {
    const W = this.world, D = this.doom, ui = this.ui, G = window.gsap;
    W.scrollDraw(email, 1); W.scrollMat.emissiveIntensity = 0.3;
    this.audio.play('paper', { vol: 0.5 });
    await wait(500);
    // his free hand casts; the wax gathers out of nothing and stamps itself onto the floating scroll
    D.play('cast');
    await wait(this.calm ? 0 : 550);
    W.seal.visible = true; W.seal.scale.setScalar(0.01); this._sealSpin = 1;
    if (G && !this.calm) { G.to(W.seal.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(2.2)' }); G.to(this, { _sealSpin: 0, duration: 0.7, ease: 'power3.out' }); }
    else { W.seal.scale.setScalar(1); this._sealSpin = 0; }
    await wait(this.calm ? 200 : 560);
    this.audio.play('seal', { vol: 0.7 });
    W.seal.material.emissiveIntensity = 2.5;
    if (G) G.to(W.seal.material, { emissiveIntensity: 0.3, duration: 1.2 });
    await wait(700);
    this.scrollState.rollGoal = 1; this.audio.play('flip', { vol: 0.4 });
    await wait(650);
    // the sealed scroll dissolves upward into the motes
    this._dissolve = 1;
    await wait(this.calm ? 50 : 500);
    const post = this.engine.post;
    const c = D.chestWorld().project(this.cam);
    post.shock.set(c.x * 0.5 + 0.5, c.y * 0.5 + 0.5, 0, 0.9);
    if (G && !this.calm) G.to(post.shock, { z: 1.3, w: 0, duration: 1.3, ease: 'power2.out' });
    post.flash.set(0.45, 1.0, 0.65, 0.28);
    D.eyes = 3;
    this.audio.play('glass1', { vol: 0.55 }); this.audio.play('glass2', { vol: 0.4, delay: 0.12 });
    await ui.shatter(document.getElementById('oathBlk'), () => {
      document.getElementById('oathForm').hidden = true;
      const done = document.getElementById('oathDone'); done.hidden = false;
      document.getElementById('doneMsg').textContent = `We will write to ${email} as soon as Makeathon 2027 is announced.`;
      ui.reform(done.querySelector('.summoned'));
      done.focus({ preventScroll: true });
    });
    this.sworn = true; this._sealing = false;
    W.scroll.visible = false; W.seal.visible = false; this._dissolve = 0;
    this.subs.say('It is done. Doom will write to you first.');
  }

  // ------------------------------------------------------------------ the intro (time-based: the reader is not scrolling yet)
  async playIntro() {
    const D = this.doom, W = this.world, G = window.gsap, post = this.engine.post;
    D.eyes = 0; D.setHeat(1, 2.3);
    this.introLight = 1;
    W.embers.uniforms.uOpacity.value = 1;
    post.exposure = 0.6;
    post.flash.set(1.0, 0.45, 0.12, 0.4);
    const heat = { h: 1, top: 2.3 };
    if (G && !this.calm) {
      G.to(post, { exposure: 1, duration: 1.6 });
      G.to(heat, { h: 0, top: -0.4, duration: 3.6, ease: 'power2.inOut', onUpdate: () => D.setHeat(heat.h, heat.top) });
      G.to(this, { introLight: 0, duration: 4.2, ease: 'power2.in' });
      G.to(W.embers.uniforms.uOpacity, { value: 0, duration: 5, delay: 1.5 });
      await wait(3500);
    } else { D.setHeat(0); this.introLight = 0; W.embers.uniforms.uOpacity.value = 0; }
    D.eyes = 3.2;
    post.flash.set(0.3, 1.0, 0.55, 0.18);
    this.audio.play('seal', { vol: 0.35, rate: 0.5 });
    this.introDone = true;
    this.ui.showChrome();
  }
  skipIntro() { this.doom.setHeat(0); this.doom.eyes = 1; this.introLight = 0; this.introDone = true; this.ui.showChrome(); }

  // ------------------------------------------------------------------ the frame
  update(dt, time) {
    const ui = this.ui, W = this.world, D = this.doom, eng = this.engine;
    if (!ui.acts[0].h) ui.measure();
    // Lenis already eases the page; a second, slower ease drives the world so nothing ever jerks
    const prev = this.pS;
    this.p = window.scrollY;
    if (this._snap) { this.pS = this.p; this._snap = false; }
    this.pS = damp(this.pS, this.p, this.calm ? 30 : 4.5, dt);
    const v = (this.pS - prev) / Math.max(dt, 1e-3);
    this.vel = damp(this.vel, v, 5, dt);
    this.motion = damp(this.motion, clamp(Math.abs(this.vel) / 900, 0, 1), Math.abs(this.vel) > 30 ? 3 : 1.2, dt);
    const vh = window.innerHeight, P = this.pS;

    let idx = 0, t = 0;
    ui.acts.forEach((a, i) => {
      if (a.id === 'bench') {
        if (P >= a.top - 1) {
          if (P >= ui.fTop) { idx = 8; t = clamp((P - ui.fTop) / Math.max(1, ui.fH - vh), 0, 1); }
          else { idx = 7; t = clamp((P - a.top) / Math.max(1, ui.fTop - a.top), 0, 1); }
        }
      } else if (P >= a.top - 1) { idx = i; t = clamp((P - a.top) / Math.max(1, a.el.dataset.exit === 'scroll' ? a.h - vh : a.h), 0, 1); }
    });
    const id = IDS[idx];
    this.id = id === 'farewell' ? 'bench' : id; this.t = t;
    // how far a chapter that scrolls away with the page has left the screen (0 = pinned, 1 = gone)
    const act = ui.acts[Math.min(idx, ui.acts.length - 1)];
    this.exitK = act && act.el.dataset.exit === 'scroll' && idx < 7 ? clamp((P - (act.top + act.h - vh)) / (vh * 0.6), 0, 1) : 0;
    this.G = idx + t;
    const page = clamp(P / Math.max(1, ui.docH - vh), 0, 1);
    if (Math.abs(this.vel) < 400) this.dwell[this.id] = (this.dwell[this.id] || 0) + dt;

    const chapN = Math.min(8, idx + 1 + (this.exitK > 0.5 ? 1 : 0));
    ui.setChapter(chapN, NAMES[chapN - 1], NAMES[chapN] || '');
    if (!this._starts || this._startsH !== ui.docH) {
      this._startsH = ui.docH;
      this._starts = ui.acts.slice(1).map((a) => clamp(a.top / Math.max(1, ui.docH - vh), 0, 1));
    }
    ui.setProgress(page, this._starts);

    ui.acts.forEach((a, i) => {
      if (a.id === 'bench') return;
      if (i === idx) ui.updateAct(a, t, a.id !== 'summons' || this.introDone);
      else ui.hideAct(a);
    });
    if (id === 'farewell') ui.updateFarewell(t); else ui.updateFarewell(-1);
    const dn = this.chosen >= 0 ? DOMAIN_NAMES[this.chosen] : '';
    this.subs.update(this.introDone ? LINES[id] : null, t, dn);

    this._chapters(id, t, dt, time);

    // look and grade
    const ch = Math.min(8, idx), nx = Math.min(8, idx + 1), bl = idx === 4 ? 0 : ss(0.88, 1.0, t);
    const L = {}; for (const k in LOOK[0]) L[k] = lerp(LOOK[ch][k], LOOK[nx][k], bl);
    if (id === 'archive') { const ph = ss(0.25, 0.32, t); L.exp *= lerp(1, 0.4, ph); L.vig = lerp(L.vig, 1, ph); }
    const k = 1 - Math.exp(-3 * dt);
    W.key.intensity = lerp(W.key.intensity, L.key * (1 - 0.8 * (this.introLight || 0)), k);
    W.rim.intensity = lerp(W.rim.intensity, L.rim, k); W.rim2.intensity = lerp(W.rim2.intensity, L.rim2, k);
    W.hemi.intensity = lerp(W.hemi.intensity, L.hemi, k);
    W.forge.intensity = (this.introLight || 0) * 9;
    eng.scene.fog.density = lerp(eng.scene.fog.density, L.fog, k);
    if (this.introDone) eng.post.exposure = lerp(eng.post.exposure, L.exp, k);
    eng.post.bloom = lerp(eng.post.bloom, L.bloom + this._bloomKick, k * 2);
    eng.post.vignette = lerp(eng.post.vignette, L.vig, k);
    if ((this._flashScrub || 0) > eng.post.flash.w - dt * 1.2) eng.post.flash.set(0.35, 1.0, 0.6, this._flashScrub);
    else eng.post.flash.w = Math.max(0, eng.post.flash.w - dt * 1.2);
    eng.post.desat = this._desat || 0;

    // camera
    const cam = camAt(this.G);
    if (this.mobile) {
      cam.sx = 0;
      const d = cam.pos.clone().sub(cam.look); cam.pos.copy(cam.look).addScaledVector(d, 1.32); cam.fov += 6;
    }
    cam.fov += this._fovKick || 0;
    if (this.pointer.has && !this.calm && !this.mobile) {
      const right = V(1, 0, 0).applyQuaternion(this.cam.quaternion);
      this._par = this._par || V(0, 0, 0);
      this._par.lerp(V(this.pointer.nx * 0.06, this.pointer.ny * 0.035, 0), 1 - Math.exp(-2.5 * dt));
      cam.pos.addScaledVector(right, this._par.x).add(V(0, this._par.y, 0));
    }
    this.cam.position.copy(cam.pos);
    this.cam.lookAt(cam.look);
    this.cam.fov = cam.fov;
    const w = eng.vw, h = eng.vh;
    this.cam.setViewOffset(w, h, -cam.sx * w * 0.5, this.mobile ? h * 0.07 : 0, w, h);
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();

    this._gaze(id, t, dt);
    this._idle(dt);
    this.audio.update(this.motion, this._dip || 0, this._lift || 0);

    this._now = time;
    W.update(dt, time);
    D.update(dt, time);
    this._props(id, t, dt);
    this.ui.cursorDoom(!!this._overDoom);
  }

  // ------------------------------------------------------------------ chapter choreography (all scrubbed by t)
  _chapters(id, t, dt, time) {
    const D = this.doom, W = this.world;
    const n = IDS.indexOf(id);
    this._dip = 0; this._lift = 0; this._desat = 0; this._flashScrub = 0; this._bloomKick = 0; this._fovKick = 0;
    const pose = (a, b, k) => { if (!D.seq && !this.idle) D.setPoseMix(a, b, k); };

    if (n === 0) pose('hang', 'hang', 0);

    // II: the envelope rises in his hand, is offered, and flies to the corner
    this._envState = 0;
    if (n === 1) {
      if (t < 0.32) pose('hang', 'hold', ss(0.1, 0.3, t));
      else if (t < 0.58) pose('hold', 'offer', ss(0.34, 0.54, t));
      else pose('offer', 'hang', ss(0.6, 0.8, t));
      this._envState = t > 0.14 && t < 0.55 ? 1 : (t >= 0.55 && t < 0.8 ? 2 : 0);
      this._envFly = ss(0.55, 0.8, t);
      if (t >= 0.78) this._dockEnvelope(true);
    }

    // III: blueprint and runes, pushed together into the M
    let dShow = 0, reveal = 0, slide = 0, fuse = 0;
    if (n === 2) {
      dShow = ss(0.02, 0.1, t);
      reveal = ss(0.1, 0.42, t) * 1.1;
      slide = ss(0.46, 0.6, t);
      fuse = ss(0.56, 0.72, t);
      if (t < 0.44) pose('hang', 'armsOut', ss(0.12, 0.4, t));
      else if (t < 0.66) pose('armsOut', 'together', ss(0.46, 0.62, t));
      else pose('together', 'hang', ss(0.7, 0.86, t));
      // silence before the fusion, then the swell
      this._dip = bump(0.5, 0.57, 0.6, 0.62, t);
      this._desat = this._dip * 0.6;
      this._lift = bump(0.6, 0.64, 0.82, 0.96, t);
      this._flashScrub = bump(0.6, 0.615, 0.62, 0.66, t) * 0.035;
      this._bloomKick = bump(0.6, 0.62, 0.66, 0.8, t) * 0.45;
      const sh = this.engine.post.shock;
      if (t > 0.6 && t < 0.75) { const p = W.logo.position.clone().project(this.cam); sh.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5, ss(0.6, 0.75, t) * 1.2, 1 - ss(0.6, 0.75, t)); } else sh.w = 0;
    } else if (n === 3) { dShow = 1 - ss(0, 0.06, t); reveal = 1.1; slide = 1; fuse = 1; }
    W.setDuality(dShow, reveal, slide, fuse);

    // IV: the ring turns one plate at a time to face you; each opens and shows its engraving
    if (n === 3) {
      const show = ss(0.02, 0.1, t) * (1 - ss(0.965, 1.0, t));
      const s = clamp((t - 0.12) / 0.16, 0, 4.999);
      const k = Math.floor(s), f = s - k;
      const turn = t < 0.12 ? 0 : (k === 0 ? 0 : k - 1 + s5(f / 0.3));
      const angle = -turn * Math.PI * 2 / 5;
      const ex = t < 0.12 ? 0 : ss(0.35, 0.55, f) * (k === 4 ? 1 : 1 - ss(0.86, 1.0, f));
      this.front = k;
      W.setArmoury(show, angle, k, ex * show, this.chosen, this.cam);
      if (this._lastFront !== k) {
        this._lastFront = k;
        const d = DOMAINS[k];
        document.getElementById('inspectK').textContent = `Plate ${d.n} · ${d.unit}`;
        document.getElementById('inspectN').textContent = d.name;
        document.getElementById('inspectD').textContent = d.desc;
        document.querySelectorAll('#plateList .plate').forEach((b) => b.classList.toggle('is-front', +b.dataset.i === k));
      }
      pose('hang', 'present', ss(0.06, 0.16, t) * (1 - ss(0.95, 1.0, t)));
    } else W.setArmoury(0, 0, -1, 0, this.chosen, this.cam);

    // V: the gauntlet raised over the record; then the reel
    if (n === 4) {
      pose('hang', 'raise', ss(0.03, 0.09, t) * (1 - ss(0.2, 0.26, t)));
      const pm = D.palm(); W.palmLight.position.copy(pm.pos).addScaledVector(pm.nrm, 0.12); W.palmLight.intensity = bump(0.04, 0.1, 0.2, 0.25, t) * 3.2;
      this.ui.setStats(ss(0.04, 0.17, t));
      this.ui.setReel(clamp((t - 0.3) / 0.62, 0, 1) * 6, PHOTOS);
    } else W.palmLight.intensity = 0;

    // VI: the rings rise and spin; the ride into 2027; the sealed anomalies
    if (n === 5) {
      const show = ss(0.16, 0.32, t) * (1 - ss(0.95, 1.0, t));
      const warp = bump(0.38, 0.47, 0.5, 0.58, t);
      W.setTime(show, t * 2.0, warp, ss(0.52, 0.72, t), time);
      this.ui.setYear(ss(0.4, 0.5, t));
      this.ui.setSpec(ss(0.63, 0.86, t));
      this._dip = bump(0.33, 0.4, 0.42, 0.45, t);
      this._desat = this._dip * 0.5;
      this._lift = bump(0.43, 0.48, 0.56, 0.7, t);
      this._flashScrub = bump(0.48, 0.5, 0.5, 0.54, t) * 0.035;
      this._bloomKick = warp * 0.5;
      this._fovKick = warp * 14;
      pose('hang', 'behold', ss(0.2, 0.34, t) * (1 - ss(0.94, 1, t)));
    } else W.setTime(0, 0, 0, 0, time);

    // VII: palm up for the scroll
    if (n === 6) { if (this.sworn && !this._sealing) pose('hang', 'hang', 0); else pose('hang', 'conjure', ss(0.04, 0.22, t)); }

    // VIII: questions, then he turns and goes into the fog, and looks back
    W.fog.opacity = n === 8 ? ss(0.08, 0.45, t) : (n === 7 ? ss(0.6, 1, t) * 0.4 : 0);
    if (n === 7) pose('hang', 'hang', 0);
    if (n === 8) {
      pose('hang', 'hang', 0);
      D.root.rotation.y = s5(ss(0.06, 0.36, t)) * Math.PI;
      D.lookBack = ss(0.55, 0.75, t);
      this.ui.writeBye(ss(0.0, 0.46, t));
      if (t > 0.52 && !this._byeDone) this._farewell();
    } else { D.root.rotation.y = 0; D.lookBack = 0; }
    D.windScale = n === 8 ? 1.5 : 1;
  }

  _farewell() {
    this._byeDone = true;
    const name = this.chosen >= 0 ? DOMAIN_NAMES[this.chosen] : '';
    const line = document.getElementById('byeLine');
    line.innerHTML = name ? `Doom will see you at the bench, <b>${name}</b>.` : 'Doom will see you at the bench.';
    this.ui._byeSpans = null;
    this.ui.writeBye(1);
    let miss = null;
    for (const k of ['armoury', 'archive', 'future', 'thesis']) { const short = (this.dwell[k] || 0) < 2.5; if (k === 'armoury' ? short && this.chosen < 0 : short) { miss = k; break; } }
    const skip = document.getElementById('byeSkip');
    if (miss) {
      const [text, cta] = SKIP_LINES[miss];
      skip.innerHTML = `${text} <a href="#${miss}">${cta} →</a>`;
      skip.hidden = false;
      skip.querySelector('a').addEventListener('click', (e) => { e.preventDefault(); this.jumpTo(miss); });
    } else skip.hidden = true;
  }

  // ------------------------------------------------------------------ his eyes lead the reader
  _gaze(id, t, dt) {
    const D = this.doom, cam = this.cam;
    const dist = Math.max(0.8, cam.position.distanceTo(D.headWorld()));
    const fromEl = (sel) => {
      const el = document.querySelector(sel); if (!el) return null;
      const r = el.getBoundingClientRect(); if (!r.width) return null;
      const p = V(((r.left + r.width / 2) / innerWidth) * 2 - 1, -((r.top + r.height / 2) / innerHeight) * 2 + 1, 0.5).unproject(cam).sub(cam.position).normalize();
      return cam.position.clone().addScaledVector(p, dist * 0.4);
    };
    const C = cam.position.clone();
    let g = C;
    if (this.introDone && !this.idle) {
      switch (id) {
        case 'summons': g = (t < 0.46 ? fromEl('#subsLine') : fromEl('#summons .blk--hero')) || C; break;
        case 'prediction': g = this._envState ? this.world.envelope3d.position.clone() : (this.envDocked ? fromEl('#envelope') || C : C); break;
        case 'thesis': g = t < 0.28 ? this.world.bp.position.clone() : t < 0.44 ? this.world.ru.position.clone() : t < 0.68 ? this.world.logo.position.clone() : fromEl('#thesis .blk--left') || C; break;
        case 'armoury': g = this.world.plates[this.front || 0].getWorldPosition(V(0, 0, 0)); break;
        case 'archive': g = (t < 0.26 ? fromEl('#stats') : fromEl('#reelFrame')) || C; break;
        case 'future': g = t < 0.36 ? fromEl('#future .blk--left') || C : t < 0.6 ? C : fromEl('#spec') || C; break;
        case 'oath': g = document.activeElement && document.activeElement.id === 'email' ? this.world.scroll.position.clone() : fromEl('#oathBlk') || C; break;
        case 'farewell': g = t < 0.5 ? D.root.position.clone().add(V(0, 1.6, -6)) : C; break;
        default: g = C;
      }
    }
    this.gaze.lerp(g, 1 - Math.exp(-4 * dt));
    D.gazeAt(this.gaze);
  }

  // he drums his fingers when you stop
  _idle(dt) {
    const quiet = (performance.now() - this.lastInput) / 1000;
    if (!this.introDone || this._sealing) return;
    if (!this.idle && quiet > 8 && ['summons', 'prediction', 'armoury', 'future', 'oath', 'bench'].includes(this.id)) {
      this.idle = true; this.idleT = 0;
      this.doom.setPose('hang');
      this.doom.drumming = true;
    }
    if (this.idle) {
      this.idleT += dt;
      if (this.idleT > 6 && this.idleN < IDLE_LINES.length) { this.subs.say(IDLE_LINES[this.idleN++]); this.idleT = -8; }
    }
  }

  // ------------------------------------------------------------------ things in his hands
  _props(id, t, dt) {
    const W = this.world, D = this.doom, env = W.envelope3d;
    if (this._envState === 1) {
      const p = D.palm();
      env.visible = true;
      env.position.copy(p.pos).addScaledVector(p.nrm, 0.02);
      env.quaternion.copy(this.cam.quaternion);
      env.scale.setScalar(1);
      this._envFrom = env.position.clone();
    } else if (this._envState === 2) {
      env.visible = true;
      const to = this.cam.position.clone().add(V(0.3, -0.18, -0.55).applyQuaternion(this.cam.quaternion));
      env.position.lerpVectors(this._envFrom || D.palm().pos, to, s5(this._envFly));
      env.quaternion.copy(this.cam.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), this._envFly * 1.2));
      env.scale.setScalar(1 - 0.3 * this._envFly);
    } else env.visible = false;

    const st = this.scrollState;
    st.crumple = damp(st.crumple, st.crumpleGoal, st.crumpleGoal > st.crumple ? 9 : 2.5, dt);
    st.roll = damp(st.roll, st.rollGoal, 5, dt);
    W.scrollU.uCrumple.value = st.crumple; W.scrollU.uRoll.value = st.roll;
    // the scroll levitates above his open palm: held up by a turning rune circle and rising motes
    const show = id === 'oath' && (!this.sworn || this._sealing) && t > 0.12 && this.exitK < 0.3;
    this._magic = damp(this._magic || 0, show ? 1 : 0, show ? 2.5 : 4, dt);
    this._diss = damp(this._diss || 0, this._dissolve ? 1 : 0, 3.2, dt);
    const mg = this._magic, now = this._now || 0, crush = st.crumple;
    W.runeDisc.visible = mg > 0.01;
    W.scroll.visible = mg > 0.01 && this._diss < 0.98;
    W.magic.uniforms.uOpacity.value = mg * (1 + this._diss * 1.5);
    W.magic.uniforms.uRise.value = 0.14 + this._diss * 0.9;
    if (mg > 0.01) {
      const p = D.palm(), up = V(0, 1, 0);
      const base = p.pos.clone().addScaledVector(up, 0.035);
      const bob = 0.012 * Math.sin(now * 1.7) + 0.006 * Math.sin(now * 2.9);
      const lift = (0.17 + bob) * mg * (1 - 0.6 * crush) + this._diss * 0.25;
      const pos = base.clone().addScaledVector(up, lift);
      W.scroll.position.copy(pos);
      W.scroll.quaternion.copy(this.cam.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05 * Math.sin(now * 1.1), 0.12 * Math.sin(now * 0.8), 0.035 * Math.sin(now * 1.3))));
      W.scroll.scale.setScalar(Math.max(0.001, 1.15 * mg * (1 - this._diss)));
      W.runeDisc.position.copy(base);
      W.runeDisc.rotation.set(-Math.PI / 2, 0, now * 0.6);
      W.runeDisc.scale.setScalar((0.75 + 0.25 * mg) * (1 + this._diss * 0.6));
      W.runeDisc.material.opacity = mg * (0.7 + 0.2 * Math.sin(now * 2.3)) * (1 - 0.7 * crush) * (1 - this._diss * 0.6);
      W.magicGroup.position.copy(base).addScaledVector(up, -0.03);
      W.magicLight.position.copy(pos).addScaledVector(up, -0.06);
      W.magicLight.intensity = mg * (0.8 + 0.25 * Math.sin(now * 3.1)) * (1 - 0.6 * crush) + this._diss * 1.2;
      const zq = V(0, 0, 1).applyQuaternion(W.scroll.quaternion), xq = V(1, 0, 0).applyQuaternion(W.scroll.quaternion);
      W.seal.position.copy(pos).addScaledVector(zq, 0.014).addScaledVector(xq, 0.17 * st.roll);
      W.seal.quaternion.copy(W.scroll.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2)).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), (this._sealSpin || 0) * 9));
      if (this._diss > 0.01) { W.seal.scale.setScalar(Math.max(0.001, 1 - this._diss)); if (this._diss > 0.95) W.seal.visible = false; }
      W.fill.position.copy(pos).add(V(0.1, 0.15, 0.4)); W.fill.intensity = 0.9 * mg;
    } else { W.fill.intensity = 0; W.magicLight.intensity = 0; if (!this._sealing) W.seal.visible = false; }
    // hovering Doom changes the cursor: a hint that he can be poked
    if (this.pointer.has && !this.pointer.overUI && !this.ui.coarse && performance.now() - this.pointer.t < 1500) {
      this._hoverCheck = (this._hoverCheck || 0) + 1;
      if (this._hoverCheck % 6 === 0) {
        this.raycaster.setFromCamera(new THREE.Vector2(this.pointer.nx, this.pointer.ny), this.cam);
        this._overDoom = this.raycaster.intersectObjects(D.meshes, false).length > 0;
      }
    } else this._overDoom = false;
  }
}
