// The DOM half: scrubbed blocks, the frame trace and chapter HUD, the photo reel, counters, the spec scan,
// the envelope and its letter, the glass that shatters, the cursor, the questions.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const pad = (n) => String(n).padStart(2, '0');

export class UI {
  constructor(opts) {
    this.calm = opts.calm;
    this.coarse = matchMedia('(pointer: coarse)').matches;
    this.acts = $$('.act').map((el) => ({ el, id: el.id, n: +el.dataset.act, name: el.dataset.name, len: parseFloat(el.dataset.len || '0'), items: $$('[data-in]', el).filter((x) => !x.closest('#farewell')) }));
    this.farewell = $('#farewell');
    this.farewellItems = $$('[data-in]', this.farewell);
    this.reelImgs = $$('#reelFrame img');
    this.reelScan = $('#reelScan');
    this.reelTicks = $$('#reelTicks i');
    this.statEls = $$('#stats dd');
    this.specRows = $$('#spec div');
    this._blk = new Map();
    this._faq();
    this._sizes();
    this._buildTrace();
    window.addEventListener('resize', () => { this._sizes(); this._buildTrace(); });
  }

  _sizes() {
    const vh = window.innerHeight;
    if (this._lastW === window.innerWidth && Math.abs((this._lastH || 0) - vh) < 120) return;
    this._lastW = window.innerWidth; this._lastH = vh;
    document.documentElement.style.setProperty('--vh', (vh / 100) + 'px');
    for (const a of this.acts) if (a.len) a.el.style.setProperty('--len', a.len);
    this.farewell.style.setProperty('--flen', this.farewell.dataset.len);
  }

  measure() {
    const y = window.scrollY;
    for (const a of this.acts) { const r = a.el.getBoundingClientRect(); a.top = r.top + y; a.h = r.height; }
    const fr = this.farewell.getBoundingClientRect(); this.fTop = fr.top + y; this.fH = fr.height;
    this.docH = document.documentElement.scrollHeight;
  }

  // ---------------------------------------------------------------- the frame: a progress line around the border, a node per chapter
  _buildTrace() {
    const frame = $('#frame'), svg = $('#trace'), rect = $('#traceFg');
    const w = frame.clientWidth + 2, h = frame.clientHeight + 2;
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    rect.setAttribute('x', 0.75); rect.setAttribute('y', 0.75); rect.setAttribute('width', w - 1.5); rect.setAttribute('height', h - 1.5);
    this._per = 2 * (w + h);
    this._fw = w; this._fh = h;
    const nodes = $('#nodes');
    nodes.innerHTML = '';
    this.nodeEls = [];
    for (let i = 1; i < 8; i++) { const n = document.createElement('i'); nodes.appendChild(n); this.nodeEls.push(n); }
    this._nodeAt = [];
  }
  _pt(u) {
    const w = this._fw, h = this._fh; let d = clamp(u, 0, 1) * this._per;
    if (d <= w) return [d, 0]; d -= w; if (d <= h) return [w, d]; d -= h; if (d <= w) return [w - d, h]; d -= w; return [0, h - d];
  }
  setProgress(p, chapterStarts) {
    $('#traceFg').style.strokeDasharray = `${p.toFixed(4)} 1`;
    chapterStarts.forEach((u, i) => {
      const n = this.nodeEls[i]; if (!n) return;
      if (this._nodeAt[i] !== u) { const [x, y] = this._pt(u); n.style.left = x + 'px'; n.style.top = y + 'px'; this._nodeAt[i] = u; }
      n.classList.toggle('lit', p >= u - 0.0005);
    });
  }

  showChrome() { for (const s of ['#hud', '#frame', '#chap', '#next']) $(s).classList.add('on'); }
  setChapter(n, name, next) {
    if (this._ch === n) return; this._ch = n;
    $('#chapN').textContent = pad(n); $('#chapT').textContent = name;
    $('#nextT').textContent = next || 'The end';
    $('#next').style.visibility = next ? 'visible' : 'hidden';
  }

  // ---------------------------------------------------------------- scrubbed blocks: opacity and travel written from progress
  scrub(el, t, gate = true) {
    const a = parseFloat(el.dataset.in), b = parseFloat(el.dataset.out);
    const fin = ss(a, a + 0.06, t), fout = b >= 1 ? 1 : 1 - ss(b - 0.05, b, t);
    let o = gate ? fin * fout : 0;
    if (t < a - 0.0001 || t > b + 0.0001) o = 0;
    const prev = this._blk.get(el);
    if (prev !== undefined && Math.abs(prev - o) < 0.002) return o;
    this._blk.set(el, o);
    const y = (1 - fin) * 34 - (1 - fout) * 28;
    el.style.opacity = o.toFixed(3);
    el.style.visibility = o > 0.004 ? 'visible' : 'hidden';
    const centre = el.classList.contains('blk') && !el.classList.contains('blk--hero') && !el.classList.contains('blk--note') && !this._mobile();
    el.style.transform = el.classList.contains('year') ? `translate(-50%, -50%) scale(${(0.94 + 0.06 * fin).toFixed(4)})` : (centre || (el.classList.contains('reel') && !this._mobile()) ? `translateY(calc(-50% + ${y.toFixed(1)}px))` : `translateY(${y.toFixed(1)}px)`);
    if (o > 0.6 && !el.classList.contains('rv')) el.classList.add('rv');
    else if (o < 0.05 && el.classList.contains('rv')) el.classList.remove('rv');
    return o;
  }
  _mobile() { return window.innerWidth <= 760; }
  updateAct(act, t, gate) { for (const el of act.items) this.scrub(el, t, gate); }
  updateFarewell(t) { for (const el of this.farewellItems) this.scrub(el, t); }
  hideAct(act) { for (const el of act.items) if (this._blk.get(el) !== 0) this.scrub(el, -1); }

  // ---------------------------------------------------------------- V: counters and the reel
  setStats(k) {
    if (this._statK === k) return; this._statK = k;
    this.statEls.forEach((el, i) => {
      const e = ss(i * 0.08, 0.6 + i * 0.08, k);
      el.textContent = Math.round(+el.dataset.n * e) + (e > 0.995 ? el.dataset.s : '');
    });
  }
  // r: 0..6 continuous — photo i wipes in over [i, i + 0.45]
  setReel(r, photos) {
    let cur = 0, scan = -1;
    this.reelImgs.forEach((img, i) => {
      const p = ss(i, i + 0.45, r);
      if (p > 0) cur = i;
      if (p > 0.001 && p < 0.999) scan = p;
      const key = p.toFixed(3);
      if (img.dataset.p === key) return;
      img.dataset.p = key;
      img.style.clipPath = i === 0 && p >= 0.999 ? 'none' : `inset(0 0 ${((1 - p) * 100).toFixed(2)}% 0)`;
      img.style.transform = `scale(${(1.08 - 0.08 * p).toFixed(4)})`;
    });
    this.reelScan.style.opacity = scan >= 0 ? '1' : '0';
    if (scan >= 0) this.reelScan.style.transform = `translateY(${(scan * this.reelScan.parentNode.clientHeight).toFixed(1)}px)`;
    if (cur !== this._reel) {
      this._reel = cur;
      $('#reelNum').textContent = pad(cur + 1);
      $('#reelTitle').textContent = photos[cur].title;
      $('#reelSub').textContent = photos[cur].sub;
      this.reelTicks.forEach((t, i) => { t.classList.toggle('now', i === cur); t.classList.toggle('past', i < cur); });
      const cap = $('.reel-cap');
      if (window.gsap && !this.calm) window.gsap.fromTo(cap.children, { opacity: 0.2, y: 10 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out' });
    }
  }

  // ---------------------------------------------------------------- VI: the year and the spec
  setYear(k) {
    const n = $('#yearN'), y = $('#year');
    const arrived = k >= 1;
    const v = k <= 0 ? '2026' : arrived ? '2027' : ['2026', '2O26', '2Ø27', '20Z7', '2027'][Math.min(4, Math.floor(k * 5))];
    if (n.textContent !== v) n.textContent = v;
    y.classList.toggle('arrived', arrived);
  }
  setSpec(k) {
    this.specRows.forEach((r, i) => r.classList.toggle('on', k > i / this.specRows.length));
  }

  // ---------------------------------------------------------------- the envelope
  envelopeIn(land) {
    const e = $('#envelope');
    if (!e.hidden) return;
    e.hidden = false;
    if (land && !this.calm) { e.classList.add('land'); setTimeout(() => e.classList.remove('land'), 1100); }
  }
  envelopeWiggle(text) {
    const e = $('#envelope');
    if (text) $('#envTip').textContent = text;
    e.classList.remove('wiggle'); void e.offsetWidth; e.classList.add('wiggle', 'tip');
    clearTimeout(this._tipT); this._tipT = setTimeout(() => e.classList.remove('tip'), 2200);
  }
  openLetter(domain, lead = 'You chose') {
    return new Promise((resolve) => {
      const L = $('#letter');
      $('#letterScript').textContent = lead;
      $('#letterTitle').innerHTML = (domain + '.').split('').map((c, i) => `<span class="ch" style="animation-delay:${(0.9 + i * 0.09).toFixed(2)}s">${c}</span>`).join('');
      $('#envelope').classList.add('opened');
      L.hidden = false;
      requestAnimationFrame(() => L.classList.add('on'));
      let done = false;
      const close = () => {
        if (done) return; done = true;
        clearTimeout(auto);
        L.classList.remove('on');
        setTimeout(() => { L.hidden = true; resolve(); }, 450);
        $('#envTip').textContent = `You chose ${domain}.`;
        $('#envelope').setAttribute('aria-label', `Doom's prediction: you chose ${domain}.`);
        $('.env-addr').textContent = `You chose ${domain}`;
      };
      const auto = setTimeout(close, 6500);
      $('#letterClose').onclick = close;
      L.onclick = (e) => { if (e.target === L) close(); };
      const esc = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } };
      document.addEventListener('keydown', esc);
      setTimeout(() => $('#letterClose').focus({ preventScroll: true }), 600);
    });
  }

  enough() { const e = $('#enough'); e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }
  veilTo(on) { $('#veil').classList.toggle('on', on); }

  // ---------------------------------------------------------------- the glass: the interface shatters and re-forms
  shatter(el, onMid) {
    const G = window.gsap;
    if (!G || this.calm) { onMid && onMid(); return Promise.resolve(); }
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = Math.max(r.width, r.height) * 0.9;
    const N = this.coarse ? 10 : 16, shards = [];
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.2, a1 = ((k + 1) / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      let prev = [[cx, cy], [cx, cy]];
      for (const ring of [0.35, 1.0]) {
        const rr = ring * (0.8 + Math.random() * 0.4);
        const p0 = [cx + Math.cos(a0) * rr * R, cy + Math.sin(a0) * rr * R], p1 = [cx + Math.cos(a1) * rr * R, cy + Math.sin(a1) * rr * R];
        shards.push([prev[0], p0, p1, prev[1]]); prev = [p0, p1];
      }
    }
    const holder = $('#glass');
    holder.innerHTML = '';
    const clone = el.cloneNode(true);
    clone.removeAttribute('id'); clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    const nodes = shards.map((poly) => {
      const d = document.createElement('div');
      d.className = 'shard';
      d.style.clipPath = `polygon(${poly.map(([x, y]) => `${x}px ${y}px`).join(',')})`;
      const c = clone.cloneNode(true);
      Object.assign(c.style, { position: 'absolute', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', margin: 0, opacity: 1, visibility: 'visible', transform: 'none' });
      d.appendChild(c); holder.appendChild(d);
      return { d, mx: poly.reduce((s, p) => s + p[0], 0) / 4 - cx, my: poly.reduce((s, p) => s + p[1], 0) / 4 - cy };
    });
    el.style.visibility = 'hidden';
    return new Promise((resolve) => {
      const tl = G.timeline({ onComplete: () => { holder.innerHTML = ''; resolve(); } });
      nodes.forEach(({ d, mx, my }) => {
        const L = Math.hypot(mx, my) || 1;
        tl.to(d, { x: mx / L * (180 + Math.random() * 380), y: my / L * (180 + Math.random() * 380) + 120, rotation: (Math.random() - 0.5) * 120, rotationX: (Math.random() - 0.5) * 160, rotationY: (Math.random() - 0.5) * 160, z: Math.random() * 300, opacity: 0, duration: 1.1, ease: 'power3.out' }, 0);
      });
      tl.call(() => { el.style.visibility = ''; onMid && onMid(); }, null, 0.55);
    });
  }
  reform(el) {
    let k = 0;
    el.innerHTML = el.textContent.split(' ').map((w) => `<span style="display:inline-block;white-space:nowrap">${w.split('').map((c) => `<span class="ch" style="animation-delay:${(k++ * 0.035).toFixed(3)}s">${c}</span>`).join('')}</span>`).join(' ');
  }

  // the farewell line is written by scrolling too
  writeBye(k) {
    const el = $('#byeLine');
    if (!this._byeSpans || el.dataset.v !== el.textContent) {
      const html = el.innerHTML;
      if (!/class="w/.test(html)) {
        const tmp = document.createElement('div'); tmp.innerHTML = html;
        const parts = [];
        tmp.childNodes.forEach((n) => {
          if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach((w) => parts.push(w.trim() ? `<span class="w">${w}</span>` : w));
          else parts.push(`<span class="w g">${n.textContent}</span>`);
        });
        el.innerHTML = parts.join('');
      }
      this._byeSpans = $$('.w', el); el.dataset.v = el.textContent;
    }
    const n = Math.floor(clamp(k, 0, 1) * this._byeSpans.length + 0.0001);
    this._byeSpans.forEach((s, i) => s.classList.toggle('on', i < n));
  }

  // ---------------------------------------------------------------- cursor: the dot is exact, the ring trails
  initCursor() {
    if (this.coarse) return;
    const cur = $('#cur'), ring = $('#curRing'), dot = $('#curDot');
    let x = -100, y = -100, rx = -100, ry = -100, on = false;
    document.documentElement.classList.add('cur-on');
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      if (!on) { on = true; cur.classList.add('live'); rx = x; ry = y; }
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const t = e.target;
      cur.classList.toggle('link', !!(t.closest && t.closest('a, button, .plate')));
      cur.classList.toggle('text', !!(t.closest && t.closest('input')));
    }, { passive: true });
    document.addEventListener('mouseleave', () => { on = false; cur.classList.remove('live'); });
    const loop = () => {
      rx += (x - rx) * 0.35; ry += (y - ry) * 0.35;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    this.cursor = cur;
  }
  cursorDoom(on) { if (this.cursor) this.cursor.classList.toggle('doom', on); }

  _faq() {
    $$('#faqList button').forEach((b) => b.addEventListener('click', () => {
      const open = b.getAttribute('aria-expanded') === 'true';
      $$('#faqList button').forEach((o) => { o.setAttribute('aria-expanded', 'false'); $('#' + o.getAttribute('aria-controls')).hidden = true; });
      if (!open) { b.setAttribute('aria-expanded', 'true'); $('#' + b.getAttribute('aria-controls')).hidden = false; }
      this.onFaq && this.onFaq();
    }));
  }
}

export { $, $$ };
