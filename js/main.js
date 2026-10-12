// Makeathon 2027 — boot.
// The cold read plays while the world downloads; the forge ignites when both are ready.
import { Memory, Subs, coldRead } from './story.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';

const html = document.documentElement;
const q = new URLSearchParams(location.search);
const shot = q.get('shot');            // ?shot=archive:0.5 jumps straight to a moment (previews and tests)
const store = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Replace with the real sign-up request. It must return a promise that rejects on failure.
function submitEmail(email) {
  return new Promise((resolve) => setTimeout(resolve, 700));
}

const mem = new Memory();
const audio = new Audio();
window.__audio = audio;
let calm = html.classList.contains('is-calm');

if (html.classList.contains('is-plain')) plainMode();
else cinematic().catch((e) => { console.error(e); toPlain(); });

function toPlain() {
  html.classList.remove('is-cine'); html.classList.add('is-plain');
  document.getElementById('cold').classList.add('gone');
  html.style.overflow = '';
  plainMode();
}

function plainMode() {
  const ui = new UI({ calm: true });
  ui.showChrome();
  const btn = document.getElementById('btnPlain');
  btn.textContent = 'Cinematic version'; btn.href = './';
  btn.addEventListener('click', () => store('mk.plain', null));
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
  const subs = new Subs(document.getElementById('subsLine'), document.getElementById('subs'));
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  if (!shot) { html.style.overflow = 'hidden'; window.scrollTo(0, 0); }

  let progress = 0;
  const fontsReady = document.fonts ? Promise.all(['700 40px Cinzel', '600 20px "DM Mono"', '400 40px "Pinyon Script"', '600 40px "Barlow Condensed"'].map((f) => document.fonts.load(f))).catch(() => null) : Promise.resolve();
  const coreP = Promise.all([assets.loadCore(engine, (p) => { progress = p; }), fontsReady]).then(([c]) => c);

  const choice = shot ? null : playColdRead(mobile, () => progress);

  const core = await coreP;
  const mats = makeMaterials(core.tex);
  const world = new World(engine, core);
  const doom = new Doom(engine, core.gltf, mats);
  engine.scene.add(doom.root);

  // heavy, slow, smooth scrolling (off when motion is off)
  let lenis = null;
  const startLenis = () => {
    if (lenis || !window.Lenis) return;
    lenis = new window.Lenis({ lerp: 0.06, smoothWheel: true, wheelMultiplier: 0.33, touchMultiplier: 0.6, syncTouch: false });
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
  engine.renderer.compile(engine.scene, engine.camera);
  engine.start();
  ui.initCursor();

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

  await choice;
  const cold = document.getElementById('cold');
  cold.classList.add('ignite');
  await wait(320);
  cold.classList.add('gone');
  if (!calm) { startLenis(); if (lenis) lenis.stop(); }
  const intro = director.playIntro();
  await wait(calm ? 200 : 3600);
  html.style.overflow = '';
  if (lenis) lenis.start();
  ui.measure();
  await intro;
}

// types the cold read; resolves when the reader picks music or silence (or simply carries on)
function playColdRead(mobile, getProgress) {
  const [l1, l2] = coldRead(mem, mobile);
  const e1 = document.getElementById('cold1'), e2 = document.getElementById('cold2'), load = document.getElementById('coldLoad');
  const choiceEl = document.getElementById('coldChoice');
  const caret = '<span class="caret"></span>';
  const type = async (el, text, cps) => {
    for (let i = 1; i <= text.length; i++) {
      el.innerHTML = text.slice(0, i).replace(/</g, '&lt;') + caret;
      const ch = text[i - 1];
      await wait(calm ? 0 : (ch === '.' ? 260 : ch === ',' ? 140 : 1000 / cps));
    }
    el.innerHTML = text;
  };
  const ticker = setInterval(() => { const p = getProgress(); load.textContent = p < 1 ? `The forge is heating · ${Math.round(p * 100)}%` : ''; }, 200);
  return new Promise((resolve) => {
    let done = false;
    const go = (sound) => {
      if (done) return; done = true;
      clearInterval(ticker); load.textContent = '';
      ['keydown', 'wheel', 'touchmove'].forEach((ev) => window.removeEventListener(ev, carry));
      resolve(sound);
    };
    const carry = (e) => { if (e.type === 'keydown' && !['Enter', ' ', 'ArrowDown', 'PageDown'].includes(e.key)) return; if (choiceEl.classList.contains('on')) go(false); };
    document.getElementById('enterSound').addEventListener('click', async () => { await audio.enable(); setSoundBtn(true); store('mk.sound', 'on'); go(true); });
    document.getElementById('enterSilent').addEventListener('click', () => go(false));
    document.getElementById('coldSkip').addEventListener('click', () => go(false));
    (async () => {
      await wait(calm ? 50 : 650);
      await type(e1, l1, mem.returning ? 30 : 24);
      if (l2) { await wait(calm ? 0 : 520); await type(e2, l2, 26); }
      await wait(calm ? 0 : 450);
      choiceEl.classList.add('on');
      ['keydown', 'wheel', 'touchmove'].forEach((ev) => window.addEventListener(ev, carry, { passive: true }));
      setTimeout(() => go(false), 14000);
    })();
  });
}

function setSoundBtn(on) {
  const b = document.getElementById('btnSound');
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.querySelector('b').textContent = on ? 'On' : 'Off';
}

function wireToggles(director, onCalmChange) {
  document.getElementById('btnSound').addEventListener('click', async () => {
    if (audio.enabled) { audio.disable(); setSoundBtn(false); store('mk.sound', 'off'); }
    else { await audio.enable(); setSoundBtn(true); store('mk.sound', 'on'); }
  });
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
  document.getElementById('btnPlain').addEventListener('click', () => store('mk.plain', '1'));
}
