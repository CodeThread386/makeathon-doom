// Canvas-drawn textures for things that carry words: the blueprint, the runes of code,
// the engraved armour plates, the oath scroll, and a soft fog sprite.
import * as THREE from 'three';

const AMBER = '#f2b84b', GREEN = '#46eb93';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ----------------------------------------------------------------- science: an engineering drawing
export function blueprintTexture() {
  const W = 1024, H = 1365, [c, x] = canvas(W, H);
  x.fillStyle = '#04100d'; x.fillRect(0, 0, W, H);
  // grid
  for (let i = 0; i <= W; i += 24) { x.strokeStyle = i % 120 === 0 ? 'rgba(242,184,75,0.16)' : 'rgba(242,184,75,0.06)'; x.lineWidth = 1; x.beginPath(); x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, H); x.stroke(); }
  for (let j = 0; j <= H; j += 24) { x.strokeStyle = j % 120 === 0 ? 'rgba(242,184,75,0.16)' : 'rgba(242,184,75,0.06)'; x.beginPath(); x.moveTo(0, j + 0.5); x.lineTo(W, j + 0.5); x.stroke(); }
  x.strokeStyle = AMBER; x.fillStyle = AMBER; x.lineWidth = 2.5;
  // frame + title block
  x.strokeRect(36, 36, W - 72, H - 72); x.lineWidth = 1.2; x.strokeRect(48, 48, W - 96, H - 96);
  x.lineWidth = 2;
  x.strokeRect(W - 420, H - 190, 372, 142);
  x.beginPath(); x.moveTo(W - 420, H - 140); x.lineTo(W - 48, H - 140); x.moveTo(W - 230, H - 140); x.lineTo(W - 230, H - 48); x.stroke();
  x.font = '600 26px "DM Mono", monospace'; x.fillText('MKT-27 · ELECTRICAL', W - 405, H - 155);
  x.font = '500 18px "DM Mono", monospace'; x.fillText('DWG 01 / 07', W - 405, H - 100); x.fillText('SCALE 1:2', W - 405, H - 68);
  x.fillText('SELECT', W - 210, H - 100); x.fillText('VIT VELLORE', W - 210, H - 68);
  // motor cross-section: stator with slots, rotor, shaft
  const cx = 360, cy = 380;
  x.lineWidth = 2.5;
  for (const r of [250, 205, 120, 112, 34]) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke(); }
  for (let k = 0; k < 36; k++) {
    const a = k / 36 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    x.save(); x.translate(cx + ca * 160, cy + sa * 160); x.rotate(a); x.strokeRect(-26, -7, 52, 14); x.restore();
  }
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * Math.PI * 2 + 0.4;
    x.beginPath(); x.arc(cx, cy, 92, a, a + 1.1); x.arc(cx, cy, 62, a + 1.1, a, true); x.closePath(); x.stroke();
  }
  // centre lines and dimension
  x.setLineDash([18, 6, 4, 6]); x.lineWidth = 1.2;
  x.beginPath(); x.moveTo(cx - 290, cy); x.lineTo(cx + 290, cy); x.moveTo(cx, cy - 290); x.lineTo(cx, cy + 290); x.stroke();
  x.setLineDash([]);
  x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(cx - 250, cy + 300); x.lineTo(cx + 250, cy + 300); x.moveTo(cx - 250, cy + 286); x.lineTo(cx - 250, cy + 314); x.moveTo(cx + 250, cy + 286); x.lineTo(cx + 250, cy + 314); x.stroke();
  x.font = '500 20px "DM Mono", monospace'; x.textAlign = 'center'; x.fillText('Ø 500', cx, cy + 290); x.textAlign = 'left';
  x.fillText('A — A', cx - 30, 92);
  // a schematic: an H-bridge with a microcontroller
  const sx = 120, sy = 760;
  x.lineWidth = 2.2;
  const wire = (pts) => { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach((p) => x.lineTo(p[0], p[1])); x.stroke(); };
  const fet = (px, py) => { x.strokeRect(px - 16, py - 26, 32, 52); wire([[px - 30, py], [px - 16, py]]); x.beginPath(); x.moveTo(px + 6, py - 10); x.lineTo(px + 6, py + 10); x.stroke(); };
  wire([[sx, sy], [sx + 520, sy]]); wire([[sx, sy + 300], [sx + 520, sy + 300]]);
  for (const px of [sx + 140, sx + 380]) { wire([[px, sy], [px, sy + 70]]); fet(px, sy + 96); wire([[px, sy + 122], [px, sy + 178]]); fet(px, sy + 204); wire([[px, sy + 230], [px, sy + 300]]); }
  x.beginPath(); x.arc(sx + 260, sy + 150, 34, 0, Math.PI * 2); x.stroke();
  x.font = '700 26px "DM Mono", monospace'; x.textAlign = 'center'; x.fillText('M', sx + 260, sy + 160); x.textAlign = 'left';
  wire([[sx + 140, sy + 150], [sx + 226, sy + 150]]); wire([[sx + 294, sy + 150], [sx + 380, sy + 150]]);
  x.strokeRect(sx + 610, sy + 60, 170, 200);
  for (let k = 0; k < 7; k++) { wire([[sx + 580, sy + 80 + k * 26], [sx + 610, sy + 80 + k * 26]]); wire([[sx + 780, sy + 80 + k * 26], [sx + 810, sy + 80 + k * 26]]); }
  x.font = '600 20px "DM Mono", monospace'; x.fillText('MCU', sx + 668, sy + 168);
  x.font = '500 16px "DM Mono", monospace';
  x.fillText('Q1', sx + 160, sy + 100); x.fillText('Q2', sx + 160, sy + 208); x.fillText('Q3', sx + 400, sy + 100); x.fillText('Q4', sx + 400, sy + 208);
  x.fillText('VBUS 48V', sx, sy - 14); x.fillText('GND', sx, sy + 326);
  // a waveform strip
  x.lineWidth = 2; x.beginPath();
  for (let i = 0; i <= 640; i++) { const px = 120 + i, py = 1160 + Math.sin(i / 640 * Math.PI * 6) * 40 * (i % 80 < 40 ? 1 : 0.92); i ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.stroke();
  x.font = '500 16px "DM Mono", monospace'; x.fillText('PHASE A · 50 HZ', 120, 1225);
  const t = tex(c); return t;
}

// ----------------------------------------------------------------- sorcery: runes made of code
const TOKENS = ['while(1)', '0x3F', '=>', '{ }', 'if', 'ISR', '0b1011', 'PWM', 'MAIN', 'ADC', '&&', '<<', 'void', 'loop()', 'HAL', 'I2C', 'UART', 'return', 'NULL', 'λ'];
export function runeTexture(seed = 7, size = 1024) {
  const [c, x] = canvas(size, size);
  x.fillStyle = '#000'; x.fillRect(0, 0, size, size);
  const R = rng(seed), C = size / 2;
  x.translate(C, C);
  x.strokeStyle = GREEN; x.fillStyle = GREEN; x.shadowColor = GREEN; x.shadowBlur = 12;
  const ring = (r, w) => { x.lineWidth = w; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke(); };
  ring(C * 0.96, 4); ring(C * 0.9, 1.5); ring(C * 0.66, 3); ring(C * 0.6, 1.5); ring(C * 0.34, 2.5);
  // token ring
  x.font = `600 ${size * 0.034}px "DM Mono", monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
  let a = 0;
  while (a < Math.PI * 2 - 0.1) {
    const tok = TOKENS[(R() * TOKENS.length) | 0];
    const span = (tok.length * size * 0.021 + size * 0.03) / (C * 0.78);
    x.save(); x.rotate(a + span / 2); x.translate(0, -C * 0.78); x.fillText(tok, 0, 0); x.restore();
    a += span;
  }
  // binary inner ring
  x.font = `500 ${size * 0.022}px "DM Mono", monospace`;
  for (let k = 0; k < 64; k++) { x.save(); x.rotate(k / 64 * Math.PI * 2); x.translate(0, -C * 0.47); x.fillText(R() > 0.5 ? '1' : '0', 0, 0); x.restore(); }
  // a heptagram
  x.lineWidth = 2.5; x.beginPath();
  for (let k = 0; k <= 7; k++) { const t = (k * 3 / 7) * Math.PI * 2 - Math.PI / 2; const px = Math.cos(t) * C * 0.6, py = Math.sin(t) * C * 0.6; k ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.stroke();
  // ticks
  for (let k = 0; k < 120; k++) { x.lineWidth = k % 10 === 0 ? 3 : 1; x.save(); x.rotate(k / 120 * Math.PI * 2); x.beginPath(); x.moveTo(0, -C * 0.9); x.lineTo(0, -C * (k % 10 === 0 ? 0.84 : 0.875)); x.stroke(); x.restore(); }
  x.font = `700 ${size * 0.07}px Cinzel, serif`; x.fillText('{ }', 0, 0);
  return tex(c);
}

// ----------------------------------------------------------------- armour plates: outer emblem, inner engraving
const ICONS = {
  Enclosure: (x, s) => { x.strokeRect(-s * 0.3, -s * 0.22, s * 0.6, s * 0.44); x.beginPath(); x.moveTo(-s * 0.3, -s * 0.22); x.lineTo(-s * 0.18, -s * 0.34); x.lineTo(s * 0.42, -s * 0.34); x.lineTo(s * 0.3, -s * 0.22); x.moveTo(s * 0.42, -s * 0.34); x.lineTo(s * 0.42, s * 0.1); x.lineTo(s * 0.3, s * 0.22); x.stroke(); },
  Firmware: (x, s) => { x.strokeRect(-s * 0.24, -s * 0.24, s * 0.48, s * 0.48); for (let k = -2; k <= 2; k++) { x.beginPath(); x.moveTo(k * s * 0.09, -s * 0.24); x.lineTo(k * s * 0.09, -s * 0.36); x.moveTo(k * s * 0.09, s * 0.24); x.lineTo(k * s * 0.09, s * 0.36); x.moveTo(-s * 0.24, k * s * 0.09); x.lineTo(-s * 0.36, k * s * 0.09); x.moveTo(s * 0.24, k * s * 0.09); x.lineTo(s * 0.36, k * s * 0.09); x.stroke(); } },
  Circuit: (x, s) => { x.beginPath(); x.moveTo(-s * 0.4, 0); x.lineTo(-s * 0.22, 0); for (let k = 0; k < 6; k++) x.lineTo(-s * 0.18 + k * s * 0.07, (k % 2 ? 1 : -1) * s * 0.1); x.lineTo(s * 0.24, 0); x.lineTo(s * 0.4, 0); x.stroke(); x.beginPath(); x.arc(-s * 0.4, 0, s * 0.03, 0, 7); x.arc(s * 0.4, 0, s * 0.03, 0, 7); x.fill(); },
  Sensing: (x, s) => { for (const r of [0.1, 0.22, 0.34]) { x.beginPath(); x.arc(-s * 0.2, 0, s * r, -0.7, 0.7); x.stroke(); } x.beginPath(); x.arc(-s * 0.2, 0, s * 0.04, 0, 7); x.fill(); },
  Power: (x, s) => { x.beginPath(); x.moveTo(s * 0.06, -s * 0.38); x.lineTo(-s * 0.16, s * 0.04); x.lineTo(s * 0.02, s * 0.04); x.lineTo(-s * 0.06, s * 0.38); x.lineTo(s * 0.18, -s * 0.06); x.lineTo(0, -s * 0.06); x.closePath(); x.stroke(); }
};
export function plateTextures(name, numeral, desc, unit) {
  // the plate is ~0.65 m wide and 0.82 m tall and narrows toward the bottom: keep the canvas in those
  // proportions and the words in the upper three quarters, so nothing is stretched or squeezed
  const W = 812, H = 1024;
  const [co, xo] = canvas(W, H);
  xo.fillStyle = '#000'; xo.fillRect(0, 0, W, H);
  xo.strokeStyle = '#fff'; xo.fillStyle = '#fff'; xo.lineWidth = 12; xo.lineJoin = 'round'; xo.lineCap = 'round';
  xo.save(); xo.translate(W / 2, H * 0.3); ICONS[name](xo, W * 0.62); xo.restore();
  xo.textAlign = 'center'; xo.textBaseline = 'middle';
  fit(xo, name.toUpperCase(), '600', 150, '"Barlow Condensed", sans-serif', W * 0.86);
  xo.fillText(name.toUpperCase(), W / 2, H * 0.6);
  xo.font = '500 52px "DM Mono", monospace'; xo.fillText(numeral, W / 2, H * 0.72);
  const [ci, xi] = canvas(W, H);
  xi.fillStyle = '#000'; xi.fillRect(0, 0, W, H);
  xi.fillStyle = '#fff'; xi.strokeStyle = '#fff'; xi.textAlign = 'center'; xi.textBaseline = 'middle';
  xi.font = '500 40px "DM Mono", monospace'; xi.fillText(`PLATE ${numeral}`, W / 2, H * 0.12);
  xi.globalAlpha = 0.75; xi.fillText(unit, W / 2, H * 0.17); xi.globalAlpha = 1;
  xi.lineWidth = 3; xi.beginPath(); xi.moveTo(W * 0.3, H * 0.215); xi.lineTo(W * 0.7, H * 0.215); xi.stroke();
  fit(xi, name.toUpperCase(), '600', 168, '"Barlow Condensed", sans-serif', W * 0.88);
  xi.fillText(name.toUpperCase(), W / 2, H * 0.32);
  xi.font = '500 62px Barlow, sans-serif';
  wrap(xi, desc, W / 2, H * 0.47, W * 0.8, 74);
  return { outer: tex(co, false), inner: tex(ci, false) };
}
function fit(x, text, weight, size, family, maxW) {
  x.font = `${weight} ${size}px ${family}`;
  while (x.measureText(text).width > maxW && size > 40) { size -= 4; x.font = `${weight} ${size}px ${family}`; }
}
function wrap(x, text, cx, y, maxW, lh) {
  const words = text.split(' '); let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (x.measureText(t).width > maxW && line) { x.fillText(line, cx, y); line = w; y += lh; } else line = t;
  }
  if (line) x.fillText(line, cx, y);
}

// ----------------------------------------------------------------- the oath scroll (live ink)
export function scrollTexture() {
  const W = 1024, H = 640, [c, x] = canvas(W, H);
  const t = tex(c);
  const base = document.createElement('canvas'); base.width = W; base.height = H;
  const b = base.getContext('2d');
  const g = b.createRadialGradient(W * 0.4, H * 0.35, 40, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, '#f1e5c4'); g.addColorStop(0.6, '#dccaa0'); g.addColorStop(1, '#b89e6c');
  b.fillStyle = g; b.fillRect(0, 0, W, H);
  const R = rng(3);
  for (let i = 0; i < 2200; i++) { b.fillStyle = `rgba(90,60,25,${R() * 0.05})`; b.fillRect(R() * W, R() * H, 1 + R() * 3, 1 + R() * 3); }
  b.strokeStyle = 'rgba(60,40,15,0.35)'; b.lineWidth = 2; b.strokeRect(40, 40, W - 80, H - 80);
  b.fillStyle = 'rgba(40,26,10,0.85)'; b.textAlign = 'center';
  b.font = '700 44px Cinzel, serif'; b.fillText('THE OATH', W / 2, 120);
  b.font = '500 26px Cinzel, serif'; b.fillText('I answer the summons of Makeathon MMXXVII.', W / 2, 180);
  b.strokeStyle = 'rgba(40,26,10,0.55)'; b.lineWidth = 2; b.beginPath(); b.moveTo(170, 400); b.lineTo(W - 170, 400); b.stroke();
  b.font = '500 20px "DM Mono", monospace'; b.fillText('INSCRIBED ADDRESS', W / 2, 440);
  const draw = (text, glow) => {
    x.drawImage(base, 0, 0);
    if (text) {
      x.save(); x.textAlign = 'center'; x.fillStyle = '#1d140a';
      let s = 64; x.font = `400 ${s}px "Pinyon Script", cursive`;
      while (x.measureText(text).width > W - 300 && s > 26) { s -= 2; x.font = `400 ${s}px "Pinyon Script", cursive`; }
      if (glow) { x.shadowColor = 'rgba(70,235,147,0.9)'; x.shadowBlur = 18 * glow; }
      x.fillText(text, W / 2, 385); x.restore();
    }
    t.needsUpdate = true;
  };
  draw('');
  return { texture: t, draw };
}

// ----------------------------------------------------------------- fog / glow sprites
export function softSprite(size = 128, noise = true) {
  const [c, x] = canvas(size, size);
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  if (noise) {
    const id = x.getImageData(0, 0, size, size), d = id.data, R = rng(11);
    for (let i = 0; i < d.length; i += 4) d[i + 3] *= 0.7 + R() * 0.3;
    x.putImageData(id, 0, 0);
  }
  return tex(c, false);
}

// the M logo's polygons (from favicon.svg), in SVG units
export const M_POLYS = [
  { k: 'a', p: [[5, 4], [56.5, 52], [58, 106], [4.5, 54.5]] },
  { k: 'b', p: [[302, 4], [250.5, 52], [249, 106], [302.5, 54.5]] },
  { k: 'a', p: [[4.5, 67], [57, 119], [58.5, 235], [79, 258], [81, 299], [4, 209]] },
  { k: 'b', p: [[302.5, 67], [250, 119], [248.5, 235], [228, 258], [226, 299], [303, 209]] },
  { k: 'a', p: [[70, 92], [152.5, 169], [152.5, 224.5], [70, 147]] },
  { k: 'b', p: [[237, 92], [154.5, 169], [154.5, 224.5], [237, 147]] },
  { k: 's', p: [[70, 56], [153.5, 135], [237, 56], [237, 92], [153.5, 170], [70, 92]] },
  { k: 'g', p: [[36.5, 113], [53.5, 130], [53.5, 226], [50, 231], [36, 213]] },
  { k: 'g', p: [[270.5, 113], [253.5, 130], [253.5, 226], [257, 231], [271, 213]] }
];
