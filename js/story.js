// What Doom knows about you, and what he says. His lines are written in by your scrolling.
// Memory lives in localStorage and is a convenience only: every read and write may fail.

const KEY = 'mk.';
const get = (k) => { try { return localStorage.getItem(KEY + k); } catch (e) { return null; } };
const set = (k, v) => { try { localStorage.setItem(KEY + k, v); } catch (e) { /* private mode */ } };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const DOMAIN_NAMES = ['Enclosure', 'Firmware', 'Circuit', 'Sensing', 'Power'];

export class Memory {
  constructor() {
    const today = new Date().toISOString().slice(0, 10);
    this.last = get('last');
    this.returning = !!this.last && this.last !== today;
    set('last', today);
    set('visits', String(parseInt(get('visits') || '0', 10) + 1));
    const d = get('domain');
    this.domain = d !== null && d !== '' && !isNaN(+d) ? +d : -1;
    this.name = get('name') || '';
    this.sworn = get('sworn') === '1';
  }
  setDomain(i) { this.domain = i; set('domain', String(i)); }
  swear(name) { this.sworn = true; this.name = name; set('sworn', '1'); set('name', name); }
  get domainName() { return this.domain >= 0 ? DOMAIN_NAMES[this.domain] : ''; }
}

// ---------------------------------------------------------------- Act 0: the cold read
export function coldRead(mem, mobile, now = new Date()) {
  const h = now.getHours();
  const time = `${h % 12 === 0 ? 12 : h % 12}:${String(now.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  let tail;
  if (mem.returning) tail = 'You returned. As predicted.';
  else if (h < 5 || h >= 21) tail = 'Doom does not sleep either.';
  else if (h < 12) tail = 'Doom has been awake for hours.';
  else if (h < 17) tail = 'Doom expected you sooner.';
  else tail = 'The forge is still warm.';
  const second = mobile ? 'A small screen. Doom has conquered smaller.' : (mem.returning && mem.sworn && mem.name ? `${mem.name}. Your oath still stands.` : '');
  return [`It is ${time}. ${tail}`, second];
}

// ---------------------------------------------------------------- the script: [from, to] in each chapter's progress
// {D} becomes "Firmware. " once a domain is chosen. *word* renders green. side: where the line sits.
export const LINES = {
  summons: [{ a: 0.0, b: 0.52, text: '*Makeathon.* Real hardware. Real code. Doom requires your presence.', side: 'center' }],
  prediction: [{ a: 0.06, b: 0.97, text: 'Do not open this. Doom already knows what you will choose.', side: 'center' }],
  thesis: [
    { a: 0.0, b: 0.4, text: 'Your teachers keep these two apart. Doom does not.', side: 'center' },
    { a: 0.6, b: 0.99, text: 'Science and sorcery. Here, they are *one* machine.', side: 'right' }],
  armoury: [{ a: 0.0, b: 0.13, text: 'Five plates. Five disciplines. Choose the one you would wear.', side: 'center' }],
  archive: [
    { a: 0.0, b: 0.22, text: '{D}Pay attention. This is what your predecessors built.', side: 'right' },
    { a: 0.24, b: 0.33, text: 'Doom kept the evidence.', side: 'center' }],
  future: [
    { a: 0.02, b: 0.34, text: 'Doom has seen 2027. You may not. *Yet.*', side: 'right' },
    { a: 0.62, b: 0.98, text: 'When the seals break, Doom will tell you first.', side: 'left' }],
  oath: [{ a: 0.04, b: 0.7, text: "{D}Inscribe your name in Doom's ledger.", side: 'right' }]
};

export const SKIP_LINES = {
  thesis: ['You skipped the thesis. Doom noticed.', 'Read it'],
  armoury: ['You did not study the armoury. Doom noticed.', 'Return to it'],
  archive: ['You walked past the archive. Doom noticed.', 'Go back'],
  future: ['You ignored what is coming. Doom noticed.', 'Look again']
};
export const IDLE_LINES = ['Doom is waiting.', 'Your hesitation is noted.', 'Doom does not repeat himself. Scroll.'];
export const POKE_LINES = { 3: 'Doom is not a button.', 6: 'Careful.', 8: 'You test a patience that does not exist.' };

// ---------------------------------------------------------------- subtitles
// Scrubbed lines reveal word by word with progress; event lines (a reply, an idle remark) take over briefly.
export class Subs {
  constructor(el, wrap) {
    this.el = el; this.wrap = wrap;
    this.cur = null; this.curK = -1; this.side = '';
    this.event = null;
  }
  _render(text) {
    const words = text.split(/\s+/);
    this.el.innerHTML = words.map((w) => {
      const g = /^\*.*\*[.,!?]*$/.test(w);
      return `<span class="w${g ? ' g' : ''}">${w.replace(/\*/g, '').replace(/</g, '&lt;')}</span>`;
    }).join(' ');
    this.spans = Array.from(this.el.children);
  }
  _place(side) {
    if (side === this.side) return;
    this.side = side;
    this.wrap.classList.toggle('left', side === 'left');
    this.wrap.classList.toggle('right', side === 'right');
  }
  // a line Doom says right now, whole, for a reading-length moment
  say(text, ms) {
    const words = text.replace(/\*/g, '').split(/\s+/).length;
    this.event = { text, until: performance.now() + (ms || Math.min(6000, 1600 + words * 320)) };
    this.cur = null;
    return text;
  }
  get current() { return this.event ? this.event.text : (this.cur || ''); }
  update(lines, t, domain) {
    const now = performance.now();
    if (this.event) {
      if (now < this.event.until) {
        if (this.cur !== '#' + this.event.text) { this._render(this.event.text); this.cur = '#' + this.event.text; this.spans.forEach((s) => s.classList.add('on')); this._place('center'); }
        this.el.style.opacity = '1';
        return;
      }
      this.event = null; this.cur = null;
    }
    let line = null;
    if (lines) for (const L of lines) if (t >= L.a && t <= L.b) { line = L; break; }
    if (!line) { if (this.cur) { this.el.innerHTML = ''; this.cur = null; } return; }
    const text = line.text.replace('{D}', domain ? `*${domain}.* ` : '');
    if (text !== this.cur) { this._render(text); this.cur = text; this.curK = -1; this._place(line.side || 'center'); }
    // words arrive over the first 60% of the window; the line fades in its last 8%
    const span = (line.b - line.a);
    const k = Math.max(1, Math.ceil(clamp((t - line.a) / (span * 0.6), 0, 1) * this.spans.length - 0.0001));
    if (k !== this.curK) { this.spans.forEach((s, i) => s.classList.toggle('on', i < k)); this.curK = k; }
    const fade = clamp((line.b - t) / (span * 0.08), 0, 1);
    this.el.style.opacity = fade.toFixed(3);
  }
}
