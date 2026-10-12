// One stage. Doom stands on a dais over a blueprint grid; each chapter brings its pieces to him and takes them away
// before the next arrives, so nothing ever crowds the frame. Every state here is set from scroll progress.
import * as THREE from 'three';
import { Motes, Warp, Fog } from './particles.js';
import { blueprintTexture, runeTexture, plateTextures, scrollTexture, softSprite, M_POLYS } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const DOMAINS = [
  { name: 'Enclosure', n: 'I', unit: 'End bell', desc: 'Mechanical design and the housing around it' },
  { name: 'Firmware', n: 'II', unit: 'Controller', desc: 'Embedded code and control logic' },
  { name: 'Circuit', n: 'III', unit: 'Inverter', desc: 'Electronics and PCB design' },
  { name: 'Sensing', n: 'IV', unit: 'Sensor ring', desc: 'Sensors and signal processing' },
  { name: 'Power', n: 'V', unit: 'Stator + rotor', desc: 'Power systems and energy' }
];

export class World {
  constructor(engine, assets) {
    this.engine = engine; this.A = assets;
    const S = engine.scene;
    this.scene = S;
    S.background = new THREE.Color(0x07100c);
    S.fog = new THREE.FogExp2(0x07100c, 0.055);
    if (assets.env) { S.environment = assets.env; S.environmentIntensity = 0.32; }
    this._lights();
    this._ground();
    this._duality();
    this._armoury();
    this._time();
    this._props();
    this.dust = new Motes({ count: engine.tier === 2 ? 260 : 520, box: [-5, 0.1, -4, 5, 4.2, 4], color: 0xbfe8d0, size: 7, swirl: 0.35, base: 0.06 });
    S.add(this.dust.points);
    this.embers = new Motes({ count: 260, box: [-1.4, 0.0, -1.0, 1.4, 3.2, 1.2], color: 0xff8a30, size: 16, rise: 0.5, swirl: 0.22, base: 0.9 });
    this.embers.uniforms.uOpacity.value = 0;
    S.add(this.embers.points);
    const sprite = softSprite(128);
    this.fog = new Fog(sprite, { count: engine.tier === 2 ? 16 : 30, box: [-6, 0.1, -9, 6, 2.4, 3.5], color: 0x1d3328, opacity: 0.32, size: [5, 11] });
    this.fog.opacity = 0;
    S.add(this.fog.group);
  }

  // ------------------------------------------------------------------ lights
  _lights() {
    const S = this.scene;
    this.key = new THREE.DirectionalLight(0xfff0dc, 1.5); this.key.position.set(-3, 5, 4); S.add(this.key);
    this.rim = new THREE.DirectionalLight(0x5cff9e, 2.4); this.rim.position.set(3.5, 2.6, -4); S.add(this.rim);
    this.rim2 = new THREE.DirectionalLight(0xc4d4ff, 1.3); this.rim2.position.set(-3.5, 2.6, -4); S.add(this.rim2);
    this.hemi = new THREE.HemisphereLight(0x1b2c24, 0x040605, 0.35); S.add(this.hemi);
    this.forge = new THREE.PointLight(0xff7a2a, 0, 7, 1.6); this.forge.position.set(0, 0.5, 1.0); S.add(this.forge);
    this.palmLight = new THREE.PointLight(0x7dffb8, 0, 3.5, 1.6); S.add(this.palmLight);
    this.ringLight = new THREE.PointLight(0x46eb93, 0, 6, 1.5); this.ringLight.position.set(0, 0.4, 0); S.add(this.ringLight);
    this.fill = new THREE.PointLight(0xfff0dc, 0, 3, 1.6); S.add(this.fill);
  }

  // ------------------------------------------------------------------ ground: a blueprint grid that fades into the dark, and the dais
  _ground() {
    const gm = new THREE.ShaderMaterial({
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uGlow: { value: 0 } }]),
      vertexShader: /* glsl */`
        #include <fog_pars_vertex>
        varying vec3 vW;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <fog_pars_fragment>
        uniform float uGlow; varying vec3 vW;
        float grid(vec2 p, float s, float w){ vec2 g = abs(fract(p / s - 0.5) - 0.5) / fwidth(p / s); return 1.0 - min(min(g.x, g.y) / w, 1.0); }
        void main(){
          vec2 p = vW.xz;
          float r = length(p);
          float fine = grid(p, 0.25, 1.0) * 0.06;
          float major = grid(p, 1.0, 1.2) * 0.16;
          vec3 col = vec3(0.012, 0.022, 0.018);
          col += vec3(0.95, 0.72, 0.29) * (fine + major) * smoothstep(9.0, 1.5, r);
          col += vec3(0.27, 0.92, 0.58) * 0.05 * uGlow * smoothstep(3.0, 0.0, r);
          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }`
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), gm);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    this.floorMat = gm;
    const t = this.A.tex;
    if (t.stoneD) { for (const k of ['stoneD', 'stoneN', 'stoneR']) t[k].repeat.set(2, 2); }
    const stone = new THREE.MeshStandardMaterial({ color: 0x2a302d, roughness: 0.82, map: t.stoneD || null, normalMap: t.stoneN || null, roughnessMap: t.stoneR || null });
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.34, 0.1, 64), stone); dais.position.y = 0.05; this.scene.add(dais);
    const ringC = document.createElement('canvas'); ringC.width = ringC.height = 1024;
    const x = ringC.getContext('2d'); x.translate(512, 512); x.strokeStyle = '#f2b84b'; x.fillStyle = '#f2b84b';
    x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 500, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 1.5; x.beginPath(); x.arc(0, 0, 470, 0, Math.PI * 2); x.stroke();
    for (let k = 0; k < 180; k++) { x.save(); x.rotate(k / 180 * Math.PI * 2); x.lineWidth = k % 15 === 0 ? 3 : 1; x.beginPath(); x.moveTo(0, -500); x.lineTo(0, k % 15 === 0 ? -462 : -480); x.stroke(); x.restore(); }
    x.font = '500 22px "DM Mono", monospace'; x.textAlign = 'center';
    ['000', '030', '060', '090', '120', '150', '180', '210', '240', '270', '300', '330'].forEach((s, k) => { x.save(); x.rotate(k / 12 * Math.PI * 2); x.fillText(s, 0, -430); x.restore(); });
    this.compassMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ringC), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const compass = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), this.compassMat);
    compass.rotation.x = -Math.PI / 2; compass.position.y = 0.006; this.scene.add(compass);
    this.compass = compass;
  }

  // ------------------------------------------------------------------ III: science and sorcery
  _duality() {
    const mk = (texture, color, spin) => new THREE.ShaderMaterial({
      uniforms: { map: { value: texture }, uReveal: { value: 0 }, uSpin: { value: spin }, uTint: { value: new THREE.Color(color) }, uOpacity: { value: 1 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */`
        uniform sampler2D map; uniform float uReveal, uSpin, uOpacity; uniform vec3 uTint; varying vec2 vUv;
        void main(){
          vec2 uv = vUv;
          if (uSpin > 0.0) { vec2 c = uv - 0.5; float r = length(c); float band = r < 0.33 ? -1.0 : (r < 0.46 ? 1.0 : 0.3); float a = uSpin * band; c = mat2(cos(a), -sin(a), sin(a), cos(a)) * c; uv = c + 0.5; }
          vec4 t = texture2D(map, uv);
          float k = vUv.y + (1.0 - vUv.x) * 0.15 - 0.075;
          float edge = smoothstep(uReveal, uReveal - 0.06, k);
          float scan = smoothstep(0.006, 0.0, abs(k - uReveal)) * step(uReveal, 1.0) * step(0.001, uReveal);
          gl_FragColor = vec4((t.rgb * uTint * edge + uTint * scan * 0.45) * uOpacity, 1.0);
        }`
    });
    this.bpMat = mk(blueprintTexture(), new THREE.Color(1.5, 1.15, 0.62), 0);
    this.ruMat = mk(runeTexture(7), new THREE.Color(0.5, 2.0, 1.0), 0.0001);
    this.bp = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.07), this.bpMat);
    this.ru = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), this.ruMat);
    this.bp.visible = this.ru.visible = false;
    this.scene.add(this.bp, this.ru);
    const logo = new THREE.Group();
    const mats = {
      a: new THREE.MeshStandardMaterial({ color: 0x5d6461, metalness: 1, roughness: 0.38 }),
      b: new THREE.MeshStandardMaterial({ color: 0x3a403e, metalness: 1, roughness: 0.42 }),
      s: new THREE.MeshStandardMaterial({ color: 0xe9eeeb, metalness: 1, roughness: 0.18 }),
      g: new THREE.MeshStandardMaterial({ color: 0x0f5a30, emissive: 0x46eb93, emissiveIntensity: 2.2, metalness: 0.2, roughness: 0.3 })
    };
    this.logoPieces = [];
    for (const poly of M_POLYS) {
      const sh = new THREE.Shape(poly.p.map(([px, py]) => new THREE.Vector2(px - 153.5, -(py - 150))));
      const geo = new THREE.ExtrudeGeometry(sh, { depth: poly.k === 'g' ? 14 : 10, bevelEnabled: true, bevelThickness: 2, bevelSize: 1.6, bevelSegments: 2 });
      const mesh = new THREE.Mesh(geo, mats[poly.k]);
      const c = new THREE.Vector3(); new THREE.Box3().setFromObject(mesh).getCenter(c);
      mesh.userData = { home: mesh.position.clone(), from: V(c.x < 0 ? -380 : 380, c.y * 0.5, -120), spin: (c.x < 0 ? 1 : -1) * 1.4 };
      logo.add(mesh); this.logoPieces.push(mesh);
    }
    logo.scale.setScalar(0.0072);
    logo.position.set(0, 3.05, -1.7);
    logo.visible = false;
    this.scene.add(logo);
    this.logo = logo; this.logoMats = mats;
  }
  // show 0..1, reveal 0..1.1 (panels draw themselves), slide 0..1 (they glide together), fuse 0..1 (the M assembles)
  setDuality(show, reveal, slide, fuse) {
    const s = ss(0, 1, slide);
    const op = show * (1 - ss(0.55, 0.85, fuse));
    this.bp.visible = this.ru.visible = op > 0.002 && reveal > 0.001;
    this.bpMat.uniforms.uReveal.value = reveal; this.ruMat.uniforms.uReveal.value = reveal;
    this.bpMat.uniforms.uOpacity.value = op; this.ruMat.uniforms.uOpacity.value = op;
    this.bp.position.set(-2.45 + 2.45 * s, 1.85 + 0.55 * s, -1.25 - 0.45 * s); this.bp.rotation.y = 0.34 * (1 - s);
    this.ru.position.set(2.45 - 2.45 * s, 1.85 + 0.55 * s, -1.25 - 0.45 * s); this.ru.rotation.y = -0.34 * (1 - s);
    this.ruMat.uniforms.uSpin.value = 0.0001 + reveal * 0.6 + slide * 2.2;
    const lk = ss(0.35, 1.0, fuse) * show;
    this.logo.visible = lk > 0.002;
    for (const m of this.logoPieces) {
      const u = m.userData, e = 1 - Math.pow(1 - lk, 3);
      m.position.lerpVectors(u.from, u.home, e);
      m.rotation.set(0, u.spin * (1 - e), 0);
    }
    this.logoMats.g.emissiveIntensity = 2.0 + 4.0 * Math.max(0, 1 - Math.abs(fuse - 0.45) * 5);
  }

  // ------------------------------------------------------------------ IV: the armoury
  _armoury() {
    this.ring = new THREE.Group(); this.ring.position.y = 1.32; this.scene.add(this.ring);
    this.plates = [];
    const R0 = 0.9, TH = 0.72, HGT = 0.82;
    const layer = (r, opts, tex, flip) => {
      const geo = new THREE.CylinderGeometry(r, r, HGT, 32, 1, true, -TH / 2, TH);
      geo.translate(0, 0, -R0);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - 0.25 * ss(0.1, -0.41, y))); }
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial(Object.assign({ side: THREE.DoubleSide, transparent: true }, opts));
      if (tex) { mat.emissiveMap = tex; if (flip) { tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1; tex.offset.x = 1; } }
      return new THREE.Mesh(geo, mat);
    };
    DOMAINS.forEach((d, i) => {
      const tx = plateTextures(d.name, d.n, d.desc, d.unit.toUpperCase());
      const h = new THREE.Group();
      const outer = layer(R0, { color: 0xa9b2af, metalness: 1, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.55 }, tx.outer, false);
      const mid = layer(R0 - 0.025, { color: 0x0d3b22, metalness: 0.6, roughness: 0.4, emissive: 0xf2b84b, emissiveIntensity: 0 }, null);
      // the engraved face: near-black, matte, so nothing reflects over the words
      const inner = layer(R0 - 0.05, { color: 0x030605, metalness: 0, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.4, envMapIntensity: 0 }, tx.inner, true);
      h.add(outer, mid, inner);
      h.userData = { i, layers: [outer, mid, inner] };
      outer.userData.plate = i;
      this.ring.add(h); this.plates.push(h);
    });
    this.ring.visible = false;
  }
  // angle: ring rotation; front: index of the plate in front; ex: 0..1 how far it has opened; chosen index
  setArmoury(show, angle, front, ex, chosen, camera) {
    this.ring.visible = show > 0.002;
    if (!this.ring.visible) return;
    const R = 1.62;
    this.ring.updateMatrixWorld();
    const camLocal = camera.position.clone(); this.ring.worldToLocal(camLocal);
    this.plates.forEach((h, i) => {
      const a = (i / 5) * Math.PI * 2 + angle;
      const isF = i === front, k = isF ? ex : 0;
      const base = V(Math.sin(a) * R, Math.sin(i * 1.7) * 0.03, Math.cos(a) * R);
      // the front plate steps toward the camera, up and to the right of Doom, and opens out
      const toward = base.clone().lerp(camLocal.clone().setY(0.0).multiplyScalar(0.34).add(V(0.7, 0.5, 0)), k * 0.9);
      h.position.copy(toward);
      const faceOut = Math.atan2(h.position.x, h.position.z);
      const faceCam = Math.atan2(camLocal.x - h.position.x, camLocal.z - h.position.z) + Math.PI;
      h.rotation.y = faceOut + k * Math.atan2(Math.sin(faceCam - faceOut), Math.cos(faceCam - faceOut));
      // tilt the open plate so its face is square to the camera, and let it grow a little so the words read
      const dy = camLocal.y - h.position.y, dz = Math.hypot(camLocal.x - h.position.x, camLocal.z - h.position.z);
      h.rotation.x = -k * Math.atan2(dy, dz) * 0.9;
      h.scale.setScalar(Math.max(0.001, 0.78 * show * (i === chosen ? 1.12 : 1) * (1 + 0.32 * k)));
      const [o, m, inn] = h.userData.layers;
      o.position.z = k * 0.17; m.position.z = k * 0.085;
      o.material.opacity = m.material.opacity = inn.material.opacity = show;
      o.material.emissiveIntensity = 0.5 + (i === chosen ? 0.6 : 0) + (isF ? 0.35 : 0);
      o.material.emissive.setRGB(...(i === chosen ? [0.4, 1.0, 0.65] : [0.55, 1.0, 0.75]));
      m.material.emissiveIntensity = k * 0.5;
      inn.material.emissiveIntensity = 0.35 + 1.25 * k;
      inn.material.emissive.setRGB(0.82, 1.0, 0.9);
      o.material.color.setScalar(isF || front < 0 ? 0.66 : 0.36);
    });
  }
  pickPlate(raycaster) {
    if (!this.ring.visible) return -1;
    const hit = raycaster.intersectObjects(this.plates.map((p) => p.userData.layers[0]), false)[0];
    return hit ? hit.object.userData.plate : -1;
  }

  // ------------------------------------------------------------------ VI: time
  _time() {
    this.rings = [];
    const mat = new THREE.MeshStandardMaterial({ color: 0x9aa3a0, metalness: 1, roughness: 0.28, emissive: 0x46eb93, emissiveIntensity: 0 });
    [1.55, 1.36, 1.17].forEach((r, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.011 + i * 0.003, 8, 200), mat.clone());
      ring.userData = { ax: [V(1, 0, 0.15).normalize(), V(0.15, 0, 1).normalize(), V(1, 0, 0.7).normalize()][i], spd: [0.5, -0.7, 0.9][i] };
      ring.visible = false;
      this.scene.add(ring); this.rings.push(ring);
    });
    this.anoms = [];
    const amat = () => new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }',
      fragmentShader: /* glsl */`
        uniform float uTime, uOpacity; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        float h(vec3 p){ p = fract(p * 0.3183 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float n(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y), mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){
          float fr = pow(1.0 - max(dot(vN, vV), 0.0), 2.6);
          float sw = n(vP * 9.0 + vec3(0.0, uTime * 0.9, uTime * 0.5)) * n(vP * 15.0 - uTime * 0.6);
          vec3 col = vec3(0.22, 1.3, 0.7) * (fr * 1.6 + sw * 0.9) + vec3(0.8, 2.0, 1.4) * pow(sw, 3.0) * 1.6;
          gl_FragColor = vec4(col * uOpacity, 1.0);
        }`
    });
    [[-1.9, 1.75, -0.6], [-1.3, 2.55, -1.2], [1.4, 2.4, -1.1], [2.0, 1.6, -0.5]].forEach((p, i) => {
      const g = new THREE.Group(); g.position.set(...p);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 4), amat());
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.005, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.6, 0.85), transparent: true, opacity: 0 }));
      band.rotation.x = Math.PI / 2.4;
      g.add(core, band); g.userData = { core, band, ph: i * 1.7, base: g.position.clone() }; g.visible = false;
      this.scene.add(g); this.anoms.push(g);
    });
    this.warp = new Warp(this.engine.tier === 2 ? 400 : 900);
    this.scene.add(this.warp.lines);
  }
  setTime(show, spin, warp, anomalies, time) {
    this.rings.forEach((r, i) => {
      const k = ss(i * 0.15, 0.55 + i * 0.15, show);
      r.visible = k > 0.002;
      r.scale.setScalar(0.4 + 0.6 * k);
      r.position.y = 0.2 + 1.0 * k;
      r.quaternion.setFromAxisAngle(r.userData.ax, Math.sin(spin * r.userData.spd * 2.2 + i) * 0.55).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), spin * r.userData.spd * 3.0)).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2));
      r.material.emissiveIntensity = (0.15 + 1.2 * warp) * k;
    });
    this.ringLight.intensity = show * (1.5 + 10 * warp);
    this.warp.lines.visible = warp > 0.002;
    this.warp.uniforms.uOpacity.value = Math.sin(clamp(warp, 0, 1) * Math.PI) * 0.8;
    this.warp.uniforms.uSpeed.value = warp;
    this.warp.uniforms.uTime.value = spin * 3.0;
    this.anoms.forEach((g, i) => {
      const k = ss(i * 0.15, 0.4 + i * 0.15, anomalies);
      g.visible = k > 0.002;
      const u = g.userData;
      u.core.material.uniforms.uTime.value = time + u.ph;
      u.core.material.uniforms.uOpacity.value = k;
      u.band.material.opacity = k * 0.7;
      u.band.rotation.z = time * 0.5 + u.ph;
      g.position.y = u.base.y + Math.sin(time * 1.1 + u.ph) * 0.05;
      g.scale.setScalar(0.5 + 0.5 * k);
    });
  }

  // ------------------------------------------------------------------ props
  _props() {
    const env = new THREE.Group();
    const paper = new THREE.MeshStandardMaterial({ color: 0xd9c79c, roughness: 0.8 });
    env.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.005), paper));
    const flap = new THREE.Mesh(new THREE.CircleGeometry(0.1, 3), new THREE.MeshStandardMaterial({ color: 0xc9b787, roughness: 0.8 }));
    flap.rotation.z = -Math.PI / 2; flap.scale.set(0.62, 1, 1); flap.position.set(0, 0.03, 0.003); env.add(flap);
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.005, 20), new THREE.MeshPhysicalMaterial({ color: 0x1d7a45, roughness: 0.35, clearcoat: 1, emissive: 0x0f5a30, emissiveIntensity: 0.4 }));
    wax.rotation.x = Math.PI / 2; wax.position.set(0, -0.004, 0.005); env.add(wax);
    env.visible = false; this.scene.add(env); this.envelope3d = env;

    const sc = scrollTexture();
    this.scrollDraw = sc.draw;
    const W = 0.34, H = 0.22;
    const geo = new THREE.PlaneGeometry(W, H, 32, 6);
    const pp = geo.attributes.position;
    for (let i = 0; i < pp.count; i++) pp.setZ(i, -Math.pow(pp.getX(i) / (W / 2), 2) * 0.02);
    geo.computeVertexNormals();
    this.scrollU = { uCrumple: { value: 0 }, uRoll: { value: 0 } };
    const smat = new THREE.MeshStandardMaterial({ map: sc.texture, color: 0xa0a0a0, roughness: 0.85, side: THREE.DoubleSide, emissive: 0x46eb93, emissiveIntensity: 0 });
    smat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, this.scrollU);
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uCrumple; uniform float uRoll;\nfloat hs(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }')
        .replace('#include <begin_vertex>', `vec3 transformed = position;
          transformed *= 1.0 - 0.72 * uCrumple;
          transformed += (vec3(hs(position * 31.0), hs(position * 17.0 + 3.0), hs(position * 23.0 + 7.0)) - 0.5) * 0.08 * uCrumple;
          float rx = transformed.x + 0.17; float rr = 0.012 + 0.024 * (1.0 - uRoll); float lim = 0.34 * (1.0 - uRoll);
          if (rx > lim) { float a = (rx - lim) / rr; transformed.x = lim - 0.17 + sin(a) * rr; transformed.z += (1.0 - cos(a)) * rr; }`);
    };
    smat.customProgramCacheKey = () => 'scroll-v2';
    const scroll = new THREE.Group();
    scroll.add(new THREE.Mesh(geo, smat));
    const roller = new THREE.CylinderGeometry(0.012, 0.012, H + 0.035, 12), rm = new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.6 });
    const r1 = new THREE.Mesh(roller, rm); r1.position.x = -W / 2; scroll.add(r1);
    const r2 = new THREE.Mesh(roller, rm); r2.position.x = W / 2; scroll.add(r2);
    scroll.visible = false; this.scene.add(scroll); this.scroll = scroll; this.scrollMat = smat;

    // the magic that holds it up: a turning rune circle above his palm and motes rising through it
    this.runeDisc = new THREE.Mesh(new THREE.CircleGeometry(0.16, 64), new THREE.MeshBasicMaterial({ map: runeTexture(13, 512), color: new THREE.Color(0.35, 2.0, 1.0), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.runeDisc.visible = false; this.scene.add(this.runeDisc);
    this.magic = new Motes({ count: 110, box: [-0.13, 0.0, -0.13, 0.13, 0.42, 0.13], color: 0x6dffb0, size: 10, rise: 0.14, swirl: 0.035, base: 0.9 });
    this.magic.uniforms.uOpacity.value = 0;
    this.magicGroup = new THREE.Group(); this.magicGroup.add(this.magic.points); this.scene.add(this.magicGroup);
    this.magicLight = new THREE.PointLight(0x5cffa8, 0, 1.6, 1.8); this.scene.add(this.magicLight);

    const sealC = document.createElement('canvas'); sealC.width = sealC.height = 256;
    const sx = sealC.getContext('2d'); sx.fillStyle = '#000'; sx.fillRect(0, 0, 256, 256);
    sx.translate(128, 128); sx.scale(0.55, 0.55); sx.translate(-153, -150); sx.fillStyle = '#fff';
    for (const p of M_POLYS) { sx.beginPath(); p.p.forEach(([px, py], k) => k ? sx.lineTo(px, py) : sx.moveTo(px, py)); sx.closePath(); sx.fill(); }
    const sealTex = new THREE.CanvasTexture(sealC);
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.043, 0.012, 32), new THREE.MeshPhysicalMaterial({ color: 0x1b8a4b, roughness: 0.32, clearcoat: 1, bumpMap: sealTex, bumpScale: 3, emissive: 0x46eb93, emissiveMap: sealTex, emissiveIntensity: 0 }));
    seal.visible = false; this.scene.add(seal); this.seal = seal;
  }

  update(dt, time) {
    const pix = this.engine.ph / 900;
    this.dust.update(time, pix);
    this.embers.update(time, pix);
    this.magic.update(time, pix);
    this.fog.update(time);
    this.compass.rotation.z = time * 0.01;
  }
}
