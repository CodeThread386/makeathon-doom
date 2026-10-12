// Renderer, HDR post chain and the adaptive-quality loop.
// The scene renders linear HDR into a half-float target; bloom is a dual-filter mip chain;
// the composite does exposure, ACES, grading, shockwave distortion, flashes, grain and sRGB.
import * as THREE from 'three';

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const PREFILTER = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; uniform float uKnee;
varying vec2 vUv;
vec3 tap(vec2 o){ return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main(){
  // 4-tap box with a firefly-safe luma weight, then a soft-knee threshold
  vec3 a = tap(vec2(-1.0,-1.0)), b = tap(vec2(1.0,-1.0)), c = tap(vec2(-1.0,1.0)), d = tap(vec2(1.0,1.0));
  float wa = 1.0/(1.0+max(a.r,max(a.g,a.b))), wb = 1.0/(1.0+max(b.r,max(b.g,b.b)));
  float wc = 1.0/(1.0+max(c.r,max(c.g,c.b))), wd = 1.0/(1.0+max(d.r,max(d.g,d.b)));
  vec3 col = (a*wa + b*wb + c*wc + d*wd) / (wa+wb+wc+wd);
  float br = max(col.r, max(col.g, col.b));
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = (rq * rq) / (4.0 * uKnee + 1e-4);
  float w = max(rq, br - uThreshold) / max(br, 1e-4);
  gl_FragColor = vec4(min(col * w, vec3(60.0)), 1.0);
}`;

const DOWN = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main(){
  vec2 t = uTexel;
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv + vec2(-t.x, -t.y)).rgb;
  c += texture2D(tSrc, vUv + vec2( t.x, -t.y)).rgb;
  c += texture2D(tSrc, vUv + vec2(-t.x,  t.y)).rgb;
  c += texture2D(tSrc, vUv + vec2( t.x,  t.y)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;

const UP = /* glsl */`
uniform sampler2D tSrc; uniform sampler2D tPrev; uniform vec2 uTexel; uniform float uRadius; varying vec2 vUv;
void main(){
  vec2 t = uTexel * uRadius;
  vec3 c = texture2D(tSrc, vUv + vec2(-t.x, 0.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2( t.x, 0.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(0.0, -t.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(0.0,  t.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(-t.x, -t.y)).rgb;
  c += texture2D(tSrc, vUv + vec2( t.x, -t.y)).rgb;
  c += texture2D(tSrc, vUv + vec2(-t.x,  t.y)).rgb;
  c += texture2D(tSrc, vUv + vec2( t.x,  t.y)).rgb;
  c += texture2D(tSrc, vUv).rgb * 4.0;
  gl_FragColor = vec4(c / 16.0 + texture2D(tPrev, vUv).rgb, 1.0);
}`;

const COMPOSITE = /* glsl */`
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform vec2 uRes; uniform float uTime;
uniform float uBloom; uniform float uExposure; uniform float uVignette; uniform float uGrain;
uniform float uCA; uniform float uDesat; uniform vec3 uLift; uniform vec3 uGain;
uniform vec4 uShock;      // xy center (uv), z radius (uv), w strength
uniform vec4 uFlash;      // rgb colour, a amount
uniform float uFade;      // to black
varying vec2 vUv;

vec3 aces(vec3 x){
  // Narkowicz ACES fit, slightly desaturated highlights
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c){
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }

void main(){
  vec2 uv = vUv;
  // shockwave: a refracting ring travelling outward
  if (uShock.w > 0.0) {
    vec2 asp = vec2(uRes.x / uRes.y, 1.0);
    vec2 d = (uv - uShock.xy) * asp;
    float r = length(d);
    float ring = r - uShock.z;
    float band = exp(-ring * ring * 900.0);
    uv -= normalize(d + 1e-5) / asp * band * 0.045 * uShock.w;
  }
  vec2 cc = uv - 0.5;
  float ca = uCA * dot(cc, cc);
  vec3 col;
  col.r = texture2D(tScene, uv - cc * ca).r;
  col.g = texture2D(tScene, uv).g;
  col.b = texture2D(tScene, uv + cc * ca).b;
  col += texture2D(tBloom, uv).rgb * uBloom;
  col *= uExposure;
  col = mix(col, uFlash.rgb, uFlash.a);
  col = aces(col);
  // grade: lift the blacks toward a cold green, gain the highs
  col = col * uGain + uLift * (1.0 - col);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(l), uDesat);
  float v = smoothstep(0.95, 0.25, length(cc * vec2(1.0, 0.86)));
  col *= mix(1.0, v, uVignette);
  col *= 1.0 - uFade;
  col = toSRGB(clamp(col, 0.0, 1.0));
  // film grain after encoding so it reads evenly in the shadows
  float g = hash(gl_FragCoord.xy + fract(uTime * 13.7) * 311.0) - 0.5;
  col += g * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`;

export class Engine {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
    r.setClearColor(0x000000, 1);
    r.toneMapping = THREE.NoToneMapping;
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.autoClear = true;
    this.renderer = r;
    this.gl = r.getContext();
    this.isWebGL2 = r.capabilities.isWebGL2;
    this.floatRT = !!r.extensions.get('EXT_color_buffer_float');
    const info = r.getContext().getExtension('WEBGL_debug_renderer_info');
    this.gpu = info ? String(r.getContext().getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    this.software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(this.gpu);

    const mobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
    this.mobile = mobile;
    // quality tiers: 0 high, 1 medium, 2 low
    this.tier = this.software ? 2 : mobile ? 1 : 0;
    if (opts.tier !== undefined) this.tier = opts.tier;
    this.maxDpr = Math.min(window.devicePixelRatio || 1, this.tier === 0 ? 1.75 : this.tier === 1 ? 1.5 : 1);
    this.scale = this.software ? 0.5 : 1;   // adaptive multiplier on the dpr
    this.minScale = 0.5;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 220);
    this.camera.position.set(0, 1.7, 4);

    this.post = {
      bloom: 1.0, exposure: 1.0, vignette: 0.85, grain: 0.035, ca: 0.012, desat: 0,
      lift: new THREE.Vector3(0.006, 0.014, 0.010), gain: new THREE.Vector3(1.0, 1.0, 1.0),
      shock: new THREE.Vector4(0.5, 0.5, 0, 0), flash: new THREE.Vector4(1, 1, 1, 0), fade: 0,
      threshold: 1.1, knee: 0.5, radius: 1.0
    };
    this._initPost();
    this.onUpdate = [];
    this.time = 0;
    this.timeScale = 1;
    this._ft = [];
    this._lastAdapt = 0;
    this._running = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  _rt(w, h, msaa) {
    const t = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: !!msaa,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
      samples: msaa && this.isWebGL2 && this.tier === 0 ? 4 : 0
    });
    t.texture.colorSpace = THREE.LinearSRGBColorSpace;
    return t;
  }

  _initPost() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsScene = new THREE.Scene();
    this.fsMesh = new THREE.Mesh(geo, null);
    this.fsMesh.frustumCulled = false;
    this.fsScene.add(this.fsMesh);
    const mk = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.mPre = mk(PREFILTER, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 }, uKnee: { value: 0.5 } });
    this.mDown = mk(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mUp = mk(UP, { tSrc: { value: null }, tPrev: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 } });
    const p = this.post;
    this.mComp = mk(COMPOSITE, {
      tScene: { value: null }, tBloom: { value: null }, uRes: { value: new THREE.Vector2() }, uTime: { value: 0 },
      uBloom: { value: 1 }, uExposure: { value: 1 }, uVignette: { value: 1 }, uGrain: { value: 0.03 }, uCA: { value: 0.5 },
      uDesat: { value: 0 }, uLift: { value: p.lift }, uGain: { value: p.gain }, uShock: { value: p.shock }, uFlash: { value: p.flash }, uFade: { value: 0 }
    });
  }

  _sizeTargets(w, h) {
    const dispose = (a) => a && a.forEach((t) => t.dispose());
    if (this.sceneRT) this.sceneRT.dispose();
    dispose(this.mips); dispose(this.ups);
    this.sceneRT = this._rt(w, h, true);
    this.mips = []; this.ups = [];
    let mw = Math.max(1, w >> 1), mh = Math.max(1, h >> 1);
    const levels = this.tier === 2 ? 4 : 6;
    for (let i = 0; i < levels; i++) {
      this.mips.push(this._rt(mw, mh, false));
      this.ups.push(this._rt(mw, mh, false));
      mw = Math.max(1, mw >> 1); mh = Math.max(1, mh >> 1);
    }
  }

  resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    this.vw = w; this.vh = h;
    const dpr = this.maxDpr * this.scale;
    this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    this.pw = pw; this.ph = ph;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._sizeTargets(pw, ph);
    if (this.onResize) this.onResize(w, h, dpr);
  }

  _pass(mat, target) {
    this.fsMesh.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsScene, this.fsCam);
  }

  render() {
    const r = this.renderer, p = this.post;
    r.setRenderTarget(this.sceneRT);
    r.render(this.scene, this.camera);

    // bloom chain
    const m0 = this.mips[0];
    this.mPre.uniforms.tSrc.value = this.sceneRT.texture;
    this.mPre.uniforms.uTexel.value.set(1 / this.pw, 1 / this.ph);
    this.mPre.uniforms.uThreshold.value = p.threshold;
    this.mPre.uniforms.uKnee.value = p.knee;
    this._pass(this.mPre, m0);
    for (let i = 1; i < this.mips.length; i++) {
      const src = this.mips[i - 1];
      this.mDown.uniforms.tSrc.value = src.texture;
      this.mDown.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this._pass(this.mDown, this.mips[i]);
    }
    let prev = this.mips[this.mips.length - 1];
    for (let i = this.mips.length - 2; i >= 0; i--) {
      this.mUp.uniforms.tSrc.value = prev.texture;
      this.mUp.uniforms.tPrev.value = this.mips[i].texture;
      this.mUp.uniforms.uTexel.value.set(1 / prev.width, 1 / prev.height);
      this.mUp.uniforms.uRadius.value = p.radius;
      this._pass(this.mUp, this.ups[i]);
      prev = this.ups[i];
    }

    const u = this.mComp.uniforms;
    u.tScene.value = this.sceneRT.texture;
    u.tBloom.value = prev.texture;
    u.uRes.value.set(this.pw, this.ph);
    u.uTime.value = this.time;
    u.uBloom.value = p.bloom; u.uExposure.value = p.exposure; u.uVignette.value = p.vignette;
    u.uGrain.value = p.grain; u.uCA.value = p.ca; u.uDesat.value = p.desat; u.uFade.value = p.fade;
    this._pass(this.mComp, null);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    const loop = (now) => {
      if (!this._running) return;
      this._raf = requestAnimationFrame(loop);
      if (document.hidden) { this._last = now; return; }
      const rawDt = Math.min(0.1, Math.max(0.0005, (now - this._last) / 1000));
      this._last = now;
      const dt = rawDt * this.timeScale;
      this.time += dt;
      for (const f of this.onUpdate) f(dt, this.time, rawDt);
      this.render();
      this._adapt(now, rawDt);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() { this._running = false; cancelAnimationFrame(this._raf); }

  // Hold 60fps by trading resolution: sample frame times, step the scale down fast and up slowly.
  _adapt(now, dt) {
    if (this.fixedScale) return;
    this._ft.push(dt);
    if (this._ft.length > 90) this._ft.shift();
    if (now - this._lastAdapt < 1500 || this._ft.length < 45) return;
    const sorted = this._ft.slice().sort((a, b) => a - b);
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    let s = this.scale;
    if (p75 > 1 / 48) s = Math.max(this.minScale, s - 0.12);
    else if (p75 < 1 / 58 && s < 1) s = Math.min(1, s + 0.06);
    if (Math.abs(s - this.scale) > 0.01) {
      this.scale = s;
      this.resize();
      this._ft.length = 0;
    }
    this._lastAdapt = now;
  }
}
