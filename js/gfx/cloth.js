// The cape: position-based cloth on the graphics card.
// Verlet integration and Jacobi constraint relaxation run as fragment passes over float textures
// (one texel per particle). The mesh reads the result in its vertex shader, so nothing returns to the CPU.
// Simulated in the wearer's local frame; motion arrives as an inertial acceleration.
// If float render targets are missing, the same solver runs in JavaScript and uploads a DataTexture.
import * as THREE from 'three';

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const INTEGRATE = /* glsl */`
precision highp float;
uniform sampler2D tCur; uniform sampler2D tPrev;
uniform vec3 uGravity; uniform vec3 uWind; uniform vec3 uAccel; uniform float uTime; uniform float uDt; uniform float uDamp;
uniform int uH;
void main(){
  ivec2 ij = ivec2(gl_FragCoord.xy);
  vec3 p = texelFetch(tCur, ij, 0).xyz;
  vec3 q = texelFetch(tPrev, ij, 0).xyz;
  float fy = float(ij.y) / float(uH - 1);
  // gusts: slow travelling waves so the hem ripples more than the shoulders
  float gust = 0.55 + 0.45 * sin(uTime * 1.3 + p.y * 2.4 + p.x * 3.1) * sin(uTime * 0.71 + p.x * 1.7);
  vec3 a = uGravity + uWind * gust * (1.15 - fy) - uAccel;
  vec3 v = (p - q) * uDamp;
  gl_FragColor = vec4(p + v + a * uDt * uDt, 1.0);
}`;

const CONSTRAIN = /* glsl */`
precision highp float;
uniform sampler2D tPos; uniform sampler2D tRest;
uniform int uW; uniform int uH;
uniform vec3 uPins[64];
uniform vec4 uSpheres[8]; uniform int uNS;
uniform vec4 uCapA[4]; uniform vec4 uCapB[4]; uniform int uNC;
uniform float uFloor;
vec3 P(ivec2 ij){ return texelFetch(tPos, ij, 0).xyz; }
vec3 R(ivec2 ij){ return texelFetch(tRest, ij, 0).xyz; }
void main(){
  ivec2 ij = ivec2(gl_FragCoord.xy);
  if (ij.y == uH - 1){ gl_FragColor = vec4(uPins[ij.x], 1.0); return; }
  vec3 p = P(ij), r = R(ij);
  vec3 corr = vec3(0.0); float wsum = 0.0;
  // structural, shear and bend springs, each relaxed toward its rest length
  for (int k = 0; k < 12; k++){
    ivec2 o; float st;
    if (k == 0){ o = ivec2(1,0); st = 1.0; } else if (k == 1){ o = ivec2(-1,0); st = 1.0; }
    else if (k == 2){ o = ivec2(0,1); st = 1.0; } else if (k == 3){ o = ivec2(0,-1); st = 1.0; }
    else if (k == 4){ o = ivec2(1,1); st = 0.5; } else if (k == 5){ o = ivec2(-1,1); st = 0.5; }
    else if (k == 6){ o = ivec2(1,-1); st = 0.5; } else if (k == 7){ o = ivec2(-1,-1); st = 0.5; }
    else if (k == 8){ o = ivec2(2,0); st = 0.22; } else if (k == 9){ o = ivec2(-2,0); st = 0.22; }
    else if (k == 10){ o = ivec2(0,2); st = 0.3; } else { o = ivec2(0,-2); st = 0.3; }
    ivec2 n = ij + o;
    if (n.x < 0 || n.y < 0 || n.x >= uW || n.y >= uH) continue;
    vec3 q = P(n);
    float L = length(R(n) - r);
    vec3 d = q - p; float len = max(length(d), 1e-5);
    float pinW = (n.y == uH - 1) ? 2.0 : 1.0;
    corr += st * pinW * d * (1.0 - L / len) * 0.5;
    wsum += st;
  }
  p += corr * (1.6 / max(wsum, 1.0)) * 2.0;
  // keep out of the body
  for (int i = 0; i < 8; i++){
    if (i >= uNS) break;
    vec3 d = p - uSpheres[i].xyz; float l = length(d);
    if (l < uSpheres[i].w) p = uSpheres[i].xyz + d / max(l, 1e-5) * uSpheres[i].w;
  }
  for (int i = 0; i < 4; i++){
    if (i >= uNC) break;
    vec3 a = uCapA[i].xyz, b = uCapB[i].xyz; float rad = uCapA[i].w;
    vec3 ba = b - a; float h = clamp(dot(p - a, ba) / dot(ba, ba), 0.0, 1.0);
    vec3 c = a + ba * h; vec3 d = p - c; float l = length(d);
    if (l < rad) p = c + d / max(l, 1e-5) * rad;
  }
  p.y = max(p.y, uFloor);
  gl_FragColor = vec4(p, 1.0);
}`;

export class Cloth {
  constructor(engine, opts) {
    this.engine = engine;
    const r = engine.renderer;
    this.W = opts.W; this.H = opts.H;
    this.restFn = opts.rest;          // (i, j) -> Vector3 in local space, j = 0 bottom .. H-1 top
    this.gpu = engine.floatRT && !opts.forceCPU;
    this.iter = opts.iterations || 10;
    this.gravity = new THREE.Vector3(0, -9.8, 0);
    this.wind = new THREE.Vector3(0.3, 0, -0.6);
    this.accel = new THREE.Vector3();
    this.damp = 0.985;
    this.floor = 0.015;
    this.spheres = [];   // Vector4
    this.capsules = [];  // [Vector4 a (w = radius), Vector4 b]
    this.pins = Array.from({ length: 64 }, () => new THREE.Vector3());
    this._acc = 0;
    this._t = 0;

    const N = this.W * this.H;
    const rest = new Float32Array(N * 4);
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) {
      const v = this.restFn(i, j), k = (j * this.W + i) * 4;
      rest[k] = v.x; rest[k + 1] = v.y; rest[k + 2] = v.z; rest[k + 3] = 1;
    }
    this.restData = rest;
    for (let i = 0; i < this.W; i++) { const k = ((this.H - 1) * this.W + i) * 4; this.pins[i].set(rest[k], rest[k + 1], rest[k + 2]); }

    if (this.gpu) this._initGPU(r, rest);
    else this._initCPU(rest);
    this._initMesh(opts.material);
  }

  _tex(data) {
    const t = new THREE.DataTexture(data, this.W, this.H, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  }

  _initGPU(r, rest) {
    const mk = () => new THREE.WebGLRenderTarget(this.W, this.H, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
    this.rts = [mk(), mk(), mk(), mk()]; // prev, cur, next, scratch
    this.restTex = this._tex(rest);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.quad = new THREE.Mesh(geo, null);
    this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene(); this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mCopy = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: `precision highp float; uniform sampler2D tSrc; void main(){ gl_FragColor = texelFetch(tSrc, ivec2(gl_FragCoord.xy), 0); }`, uniforms: { tSrc: { value: null } } });
    this.mInt = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: INTEGRATE, uniforms: {
      tCur: { value: null }, tPrev: { value: null }, uGravity: { value: this.gravity }, uWind: { value: this.wind }, uAccel: { value: this.accel },
      uTime: { value: 0 }, uDt: { value: 1 / 60 }, uDamp: { value: this.damp }, uH: { value: this.H } } });
    this.sphereU = Array.from({ length: 8 }, () => new THREE.Vector4());
    this.capAU = Array.from({ length: 4 }, () => new THREE.Vector4());
    this.capBU = Array.from({ length: 4 }, () => new THREE.Vector4());
    this.mCon = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: CONSTRAIN, uniforms: {
      tPos: { value: null }, tRest: { value: this.restTex }, uW: { value: this.W }, uH: { value: this.H }, uPins: { value: this.pins },
      uSpheres: { value: this.sphereU }, uNS: { value: 0 }, uCapA: { value: this.capAU }, uCapB: { value: this.capBU }, uNC: { value: 0 }, uFloor: { value: 0 } } });
    // seed prev and cur with the rest pose
    const seed = this._tex(rest);
    this.mCopy.uniforms.tSrc.value = seed;
    this._run(this.mCopy, this.rts[0]);
    this._run(this.mCopy, this.rts[1]);
    seed.dispose();
  }

  _run(mat, target) {
    const r = this.engine.renderer;
    this.quad.material = mat;
    r.setRenderTarget(target);
    r.render(this.qScene, this.qCam);
  }

  _initCPU(rest) {
    const N = this.W * this.H;
    this.cpuCur = new Float32Array(N * 3); this.cpuPrev = new Float32Array(N * 3); this.cpuTmp = new Float32Array(N * 3);
    for (let n = 0; n < N; n++) for (let c = 0; c < 3; c++) { this.cpuCur[n * 3 + c] = this.cpuPrev[n * 3 + c] = rest[n * 4 + c]; }
    this.cpuOut = new Float32Array(N * 4);
    this.cpuTex = this._tex(this.cpuOut);
    // precompute rest lengths for the 12 neighbour directions
    const off = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, .5], [-1, 1, .5], [1, -1, .5], [-1, -1, .5], [2, 0, .22], [-2, 0, .22], [0, 2, .3], [0, -2, .3]];
    this.cpuOff = off;
    this.cpuRestL = new Float32Array(N * 12);
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) {
      const n = j * this.W + i;
      off.forEach((o, k) => {
        const ii = i + o[0], jj = j + o[1];
        if (ii < 0 || jj < 0 || ii >= this.W || jj >= this.H) { this.cpuRestL[n * 12 + k] = -1; return; }
        const m = jj * this.W + ii;
        const dx = rest[m * 4] - rest[n * 4], dy = rest[m * 4 + 1] - rest[n * 4 + 1], dz = rest[m * 4 + 2] - rest[n * 4 + 2];
        this.cpuRestL[n * 12 + k] = Math.sqrt(dx * dx + dy * dy + dz * dz);
      });
    }
  }

  _initMesh(material) {
    const geo = new THREE.PlaneGeometry(1, 1, this.W - 1, this.H - 1);
    this.texRes = new THREE.Vector2(this.W, this.H);
    this.posU = { value: this.gpu ? this.rts[1].texture : this.cpuTex };
    const mat = material;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.tCloth = this.posU;
      sh.uniforms.uClothRes = { value: this.texRes };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D tCloth; uniform vec2 uClothRes;\nvec3 clothAt(vec2 c){ return texelFetch(tCloth, ivec2(clamp(c, vec2(0.0), uClothRes - 1.0)), 0).xyz; }')
        .replace('#include <beginnormal_vertex>', `
          vec2 cij = floor(uv * (uClothRes - 1.0) + 0.5);
          vec3 cp = clothAt(cij);
          vec3 tx = clothAt(cij + vec2(1.0, 0.0)) - clothAt(cij - vec2(1.0, 0.0));
          vec3 ty = clothAt(cij + vec2(0.0, 1.0)) - clothAt(cij - vec2(0.0, 1.0));
          vec3 objectNormal = normalize(cross(tx, ty) + vec3(0.0, 0.0, 1e-6));
          #ifdef USE_TANGENT
            vec3 objectTangent = normalize(tx);
          #endif`)
        .replace('#include <begin_vertex>', 'vec3 transformed = cp;');
    };
    mat.customProgramCacheKey = () => 'cloth-v1';
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
  }

  setColliders(spheres, capsules) {
    this.spheres = spheres; this.capsules = capsules;
  }

  // shift the whole cloth (used when its owner teleports in local space terms, e.g. a reset)
  reset() {
    if (this.gpu) {
      const seed = this._tex(this.restData);
      this.mCopy.uniforms.tSrc.value = seed;
      this._run(this.mCopy, this.rts[0]);
      this._run(this.mCopy, this.rts[1]);
      seed.dispose();
      this.engine.renderer.setRenderTarget(null);
    } else {
      this._initCPU(this.restData);
      this.posU.value = this.cpuTex;
    }
  }

  update(dt, time) {
    this._t = time;
    this._acc = Math.min(this._acc + dt, 1 / 20);
    const h = 1 / 60;
    let steps = 0;
    while (this._acc >= h && steps < 3) { this._acc -= h; steps++; if (this.gpu) this._stepGPU(h); else this._stepCPU(h); }
    if (this.gpu) { this.posU.value = this.rts[1].texture; this.engine.renderer.setRenderTarget(null); }
    else if (steps) {
      const N = this.W * this.H, o = this.cpuOut, c = this.cpuCur;
      for (let n = 0; n < N; n++) { o[n * 4] = c[n * 3]; o[n * 4 + 1] = c[n * 3 + 1]; o[n * 4 + 2] = c[n * 3 + 2]; o[n * 4 + 3] = 1; }
      this.cpuTex.needsUpdate = true;
    }
  }

  _stepGPU(h) {
    const [prev, cur, next, scratch] = this.rts;
    const ui = this.mInt.uniforms;
    ui.tCur.value = cur.texture; ui.tPrev.value = prev.texture; ui.uTime.value = this._t; ui.uDt.value = h; ui.uDamp.value = this.damp;
    this._run(this.mInt, next);
    // rotate: prev <- cur, cur <- next
    this.rts = [cur, next, prev, scratch];
    const uc = this.mCon.uniforms;
    uc.uNS.value = Math.min(8, this.spheres.length);
    for (let i = 0; i < uc.uNS.value; i++) this.sphereU[i].copy(this.spheres[i]);
    uc.uNC.value = Math.min(4, this.capsules.length);
    for (let i = 0; i < uc.uNC.value; i++) { this.capAU[i].copy(this.capsules[i][0]); this.capBU[i].copy(this.capsules[i][1]); }
    uc.uFloor.value = this.floor;
    let a = this.rts[1], b = this.rts[3];
    for (let k = 0; k < this.iter; k++) {
      uc.tPos.value = a.texture;
      this._run(this.mCon, b);
      const t = a; a = b; b = t;
    }
    this.rts[1] = a; this.rts[3] = b;
  }

  _stepCPU(h) {
    const W = this.W, H = this.H, N = W * H, c = this.cpuCur, p = this.cpuPrev, g = this.gravity, w = this.wind, ac = this.accel, t = this._t;
    for (let n = 0; n < N; n++) {
      const k = n * 3, j = (n / W) | 0, fy = j / (H - 1);
      const x = c[k], y = c[k + 1], z = c[k + 2];
      const gust = 0.55 + 0.45 * Math.sin(t * 1.3 + y * 2.4 + x * 3.1) * Math.sin(t * 0.71 + x * 1.7);
      const f = 1.15 - fy;
      const nx = x + (x - p[k]) * this.damp + (g.x + w.x * gust * f - ac.x) * h * h;
      const ny = y + (y - p[k + 1]) * this.damp + (g.y + w.y * gust * f - ac.y) * h * h;
      const nz = z + (z - p[k + 2]) * this.damp + (g.z + w.z * gust * f - ac.z) * h * h;
      p[k] = x; p[k + 1] = y; p[k + 2] = z;
      c[k] = nx; c[k + 1] = ny; c[k + 2] = nz;
    }
    const off = this.cpuOff, RL = this.cpuRestL, tmp = this.cpuTmp;
    const iters = Math.max(4, this.iter - 4);
    for (let it = 0; it < iters; it++) {
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const n = j * W + i, k = n * 3;
        if (j === H - 1) { const pn = this.pins[i]; tmp[k] = pn.x; tmp[k + 1] = pn.y; tmp[k + 2] = pn.z; continue; }
        let cx = 0, cy = 0, cz = 0, ws = 0;
        for (let q = 0; q < 12; q++) {
          const L = RL[n * 12 + q]; if (L < 0) continue;
          const o = off[q], m = ((j + o[1]) * W + (i + o[0])) * 3;
          const dx = c[m] - c[k], dy = c[m + 1] - c[k + 1], dz = c[m + 2] - c[k + 2];
          const len = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1e-5);
          const pw = (j + o[1]) === H - 1 ? 2 : 1;
          const s = o[2] * pw * (1 - L / len) * 0.5;
          cx += dx * s; cy += dy * s; cz += dz * s; ws += o[2];
        }
        const sc = 3.2 / Math.max(ws, 1);
        let x = c[k] + cx * sc, y = c[k + 1] + cy * sc, z = c[k + 2] + cz * sc;
        for (const s of this.spheres) {
          const dx = x - s.x, dy = y - s.y, dz = z - s.z, l = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (l < s.w) { const f = s.w / Math.max(l, 1e-5); x = s.x + dx * f; y = s.y + dy * f; z = s.z + dz * f; }
        }
        for (const [A, B] of this.capsules) {
          const bx = B.x - A.x, by = B.y - A.y, bz = B.z - A.z;
          let hh = ((x - A.x) * bx + (y - A.y) * by + (z - A.z) * bz) / (bx * bx + by * by + bz * bz);
          hh = Math.min(1, Math.max(0, hh));
          const qx = A.x + bx * hh, qy = A.y + by * hh, qz = A.z + bz * hh;
          const dx = x - qx, dy = y - qy, dz = z - qz, l = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (l < A.w) { const f = A.w / Math.max(l, 1e-5); x = qx + dx * f; y = qy + dy * f; z = qz + dz * f; }
        }
        tmp[k] = x; tmp[k + 1] = Math.max(y, this.floor); tmp[k + 2] = z;
      }
      c.set(tmp);
    }
  }
}
