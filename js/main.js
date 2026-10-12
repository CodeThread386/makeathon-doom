// Makeathon 2027 — boot.
// The cold read types while the world downloads, and the forge lights as soon as both are done (about three seconds).
// The reader enters with music, without it, or goes to the plain version (the original O·Machine site).
// Music and motion are on by default; scrolling at the choice enters with music, and scrolling during the intro finishes it.
import { Memory, Subs, coldRead } from './story.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';

const html = document.documentElement;
const q = new URLSearchParams(location.search);
const shot = q.get('shot');            // ?shot=archive:0.5 jumps straight to a moment (previews and tests)
const store = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Replace with the real sign-up request. It must return a promise that rejects on failure.
function submitEmail(email) {
  return new Promise((resolve) => setTimeout(resolve, 700));
}

const mem = new Memory();
const audio = new Audio();
window.__audio = audio;
let calm = html.classList.contains('is-calm');
let musicOn = !shot && read('mk.sound') !== 'off';

if (html.classList.contains('is-plain')) plainMode();
else cinematic().catch((e) => { console.error(e); toPlain(); });

// without WebGL2 (or if the cinematic version fails) the plain version is the original O·Machine site
function toPlain() { location.replace('./plain/'); }

function plainMode() {
  const ui = new UI({ calm: true });
  ui.showChrome();
  document.getElementById('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('email'), err = document.getElementById('emailErr');
    const em = input.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(em)) { err.textContent = em ? 'That email address looks incomplete.' : 'Please enter your email address.'; input.classList.add('is-err'); input.focus(); return; }
    document.getElementById('sealBtn').classList.add('busy');
    try { await submitEmail(em); } catch (x) { err.textContent = 'Could not sign you up. Please try again.'; document.getElementById('sealBtn').classList.remove('busy'); return; }
    document.getElementById('oathForm').hidden = true;
    const done = document.getElementById('oathDone'); done.hidden = false;
    document.getElementById('doneMsg').textContent = `We will write to ${em} as soon as Makeathon 2027 is announced.`;
    done.focus();
  });
}

async function cinematic() {
  const [{ Engine }, assets, { makeMaterials, Doom }, { World }, { Director }] = await Promise.all([
    import('./gfx/engine.js'), import('./gfx/assets.js'), import('./gfx/doom.js'), import('./gfx/world.js'), import('./director.js')
  ]);
  let engine;
  try { engine = new Engine(document.getElementById('world'), { preserve: !!shot }); } catch (e) { toPlain(); return; }
  if (!engine.isWebGL2) { toPlain(); return; }
  const ui = new UI({ calm });
  ui.initCursor();
  const subs = new Subs(document.getElementById('subsLine'), document.getElementById('subs'));
  if (!shot) { html.style.overflow = 'hidden'; window.scrollTo(0, 0); armMusic(); }

  // the first scroll, key or tap skips: it finishes the typing, then the intro
  let skipped = false, onSkip = null;
  const skip = (e) => {
    if (e && e.type === 'keydown' && (!['Enter', ' ', 'ArrowDown', 'PageDown', 'Escape'].includes(e.key) || (e.target.closest && e.target.closest('button, a')))) return;
    skipped = true;
    if (onSkip) onSkip();
  };
  const SKIPS = ['wheel', 'keydown', 'touchmove'];
  if (!shot) {
    SKIPS.forEach((ev) => window.addEventListener(ev, skip, { passive: true }));
  }

  let progress = 0;
  const fontsReady = document.fonts ? Promise.all(['600 40px "Barlow Condensed"', '500 40px "Barlow Condensed"', '500 20px "DM Mono"'].map((f) => document.fonts.load(f))).catch(() => null) : Promise.resolve();
  const coreP = Promise.all([assets.loadCore(engine, (p) => { progress = p; }), fontsReady]).then(([c]) => c);

  const cold = shot ? null : playColdRead(() => progress);
  if (cold) onSkip = cold.finish;

  const core = await coreP;
  const mats = makeMaterials(core.tex);
  const world = new World(engine, core);
  const doom = new Doom(engine, core.gltf, mats);
  engine.scene.add(doom.root);

  // one smoothing layer: Lenis eases the page, the director follows it closely
  let lenis = null;
  const startLenis = () => {
    if (lenis || !window.Lenis) return;
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1, syncTouch: false });
    director.lenis = lenis;
    if (window.gsap) { window.gsap.ticker.add((t) => lenis && lenis.raf(t * 1000)); window.gsap.ticker.lagSmoothing(0); }
    else { const raf = (t) => { if (lenis) { lenis.raf(t); requestAnimationFrame(raf); } }; requestAnimationFrame(raf); }
  };
  const stopLenis = () => { if (lenis) { lenis.destroy(); lenis = null; director.lenis = null; } };

  const director = new Director({ engine, world, doom, ui, subs, audio, mem, calm, submit: submitEmail });
  window.__doom = { engine, world, doom, director };
  engine.onUpdate.push((dt, t) => director.update(dt, t));
  ui.measure();
  ui.onFaq = () => ui.measure();
  if (window.ResizeObserver) new ResizeObserver(() => ui.measure()).observe(document.querySelector('main'));
  director.update(0.016, 0);
  // compile every shader before the first frame, in parallel where the browser allows, so the cold read keeps typing
  const parallel = engine.renderer.compileAsync && engine.renderer.extensions.has('KHR_parallel_shader_compile');
  try { await (parallel ? engine.renderer.compileAsync(engine.scene, engine.camera) : engine.renderer.compile(engine.scene, engine.camera)); } catch (e) { /* the first frames compile instead */ }
  engine.start();

  if (mem.sworn && mem.name) {
    director.sworn = true;
    document.getElementById('oathForm').hidden = true;
    document.getElementById('oathDone').hidden = false;
  }
  if (mem.domain >= 0) document.querySelectorAll('#plateList .plate').forEach((b) => b.classList.toggle('is-chosen', +b.dataset.i === mem.domain));

  wireToggles(director, () => (calm ? stopLenis() : startLenis()));

  if (shot) {
    const [id, tt] = shot.split(':');
    director.skipIntro();
    ui.measure();
    const a = ui.acts.find((x) => x.id === id);
    let y = 0;
    if (id === 'farewell') y = ui.fTop + (parseFloat(tt) || 0) * (ui.fH - innerHeight);
    else if (a) y = a.top + (parseFloat(tt) || 0) * Math.max(0, (a.len ? (a.el.dataset.exit === 'scroll' ? a.h - innerHeight : a.h) : ui.fTop - a.top));
    window.scrollTo(0, y);
    director.p = director.pS = y; director._snap = true;
    if (y > ui.acts[1].top + ui.acts[1].h * 0.8) director._dockEnvelope(false);
    if (q.get('domain')) director.chosen = +q.get('domain');
    setTimeout(() => { window.__ready = true; }, 400);
    return;
  }

  const withMusic = await cold.choice;
  if (withMusic !== musicOn) { musicOn = withMusic; store('mk.sound', musicOn ? 'on' : 'off'); setSoundBtns(musicOn); }
  if (musicOn) audio.enable();
  cold.done();
  const coldEl = document.getElementById('cold');
  coldEl.classList.add('ignite');
  await wait(skipped ? 0 : 180);
  coldEl.classList.add('gone');
  // nothing is locked from here: the page scrolls while the forge cools, and scrolling finishes the intro
  html.style.overflow = '';
  if (!calm) startLenis();
  ui.measure();
  onSkip = () => director.finishIntro();
  const intro = director.playIntro();
  if (skipped) director.finishIntro();
  await intro;
  onSkip = null;
  SKIPS.forEach((ev) => window.removeEventListener(ev, skip));
}

// types the cold read quickly, then offers the choice; finish() completes the typing, or takes the default at the choice
function playColdRead(getProgress) {
  const [l1, l2] = coldRead(mem, matchMedia('(pointer: coarse)').matches);
  const e1 = document.getElementById('cold1'), e2 = document.getElementById('cold2'), load = document.getElementById('coldLoad');
  const choiceEl = document.getElementById('coldChoice');
  const caret = '<span class="caret"></span>';
  let fast = calm, pick = null;
  const type = async (el, text) => {
    for (let i = 1; i <= text.length && !fast; i++) {
      el.innerHTML = text.slice(0, i).replace(/</g, '&lt;') + caret;
      const ch = text[i - 1];
      await wait(ch === '.' ? 140 : ch === ',' ? 80 : 20);
    }
    el.textContent = text;
  };
  const ticker = setInterval(() => { const p = getProgress(); load.textContent = p < 1 ? `The forge is heating · ${Math.round(p * 100)}%` : ''; }, 200);
  const choice = new Promise((resolve) => {
    pick = (music) => { if (!choiceEl.classList.contains('on')) return; choiceEl.classList.remove('on'); resolve(music); };
    document.getElementById('enterSound').addEventListener('click', () => { audio.enable(); pick(true); });
    document.getElementById('enterSilent').addEventListener('click', () => pick(false));
  });
  (async () => {
    if (!fast) await wait(150);
    await type(e1, l1);
    if (l2) { if (!fast) await wait(220); await type(e2, l2); }
    if (!fast) await wait(200);
    choiceEl.classList.add('on');
    if (!calm) document.getElementById('enterSound').focus({ preventScroll: true });
  })();
  return {
    choice,
    finish: () => { if (choiceEl.classList.contains('on')) pick(musicOn); else fast = true; },
    done: () => { clearInterval(ticker); load.textContent = ''; }
  };
}

// music is on by default; browsers only let it start after a click or a key press, so the first one starts it
function armMusic() {
  setSoundBtns(musicOn);
  const kick = () => { if (musicOn && !audio.playing) audio.enable(); };
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => window.addEventListener(ev, kick, { capture: true, passive: true }));
  const ua = navigator.userActivation;
  if (musicOn && !(ua && !ua.hasBeenActive)) audio.enable();
}

async function toggleMusic() {
  musicOn = !musicOn;
  store('mk.sound', musicOn ? 'on' : 'off');
  setSoundBtns(musicOn);
  if (musicOn) await audio.enable(); else audio.disable();
}

function setSoundBtns(on) {
  for (const id of ['btnSound']) {
    const b = document.getElementById(id);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.querySelector('b').textContent = on ? 'On' : 'Off';
  }
}

function wireToggles(director, onCalmChange) {
  setSoundBtns(musicOn);
  document.getElementById('btnSound').addEventListener('click', toggleMusic);
  const mot = document.getElementById('btnMotion');
  const paint = () => { mot.setAttribute('aria-pressed', calm ? 'false' : 'true'); mot.querySelector('b').textContent = calm ? 'Off' : 'On'; };
  paint();
  mot.addEventListener('click', () => {
    calm = !calm;
    html.classList.toggle('is-calm', calm);
    director.calm = calm; director.ui.calm = calm;
    store('mk.motion', calm ? 'off' : 'on');
    onCalmChange();
    paint();
  });
}
