// Doom: the imported Doctor Doom model (Auto-Rig Pro skeleton, re-parented on export), animated procedurally.
// Poses are hand targets solved with two-bone IK on the real arm chain, finger curls on the real finger bones,
// breathing in the spine and a gaze that leads the reader's eye. A GPU-simulated cape hangs from the shoulders.
// The armour can be heated white-hot and cooled back to steel (the forge), and the eyes can ignite.
// He faces +z; his right hand is at -x.
import * as THREE from 'three';
import { Cloth } from './cloth.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const HEIGHT = 1.95, SRC_HEIGHT = 4.632;

// ---------------------------------------------------------------------------------------------- poses
// Hand targets in body space (metres): position, finger direction, palm normal, curls [thumb, index, middle, ring, pinky].
const P = (x, y, z, f, p, c) => ({ pos: V(x, y, z), f: f.clone().normalize(), p: p.clone().normalize(), curl: c });
const OPEN = [0.1, 0.05, 0.05, 0.08, 0.12], RELAX = [0.25, 0.3, 0.36, 0.42, 0.48], FIST = [1, 1, 1, 1, 1], CUP = [0.22, 0.2, 0.2, 0.22, 0.26];
const mirror = (h) => ({ pos: V(-h.pos.x, h.pos.y, h.pos.z), f: V(-h.f.x, h.f.y, h.f.z), p: V(-h.p.x, h.p.y, h.p.z), curl: h.curl.slice() });
// wrist targets sit inside this model's ~0.55 m reach so every elbow bends
const HANG_R = P(-0.29, 1.08, 0.09, V(0.1, -1, 0.15), V(1, 0, 0.18), RELAX);
const pose = (r, l) => ({ r, l: l === undefined ? mirror(r) : l });

export const POSES = {
  hang: pose(HANG_R),
  hold: pose(P(-0.18, 1.27, 0.29, V(0.3, 0.1, 1), V(0, 1, 0), CUP), mirror(HANG_R)),
  offer: pose(P(-0.14, 1.4, 0.4, V(0.15, 0.45, 1), V(0, 1, 0.3), OPEN), mirror(HANG_R)),
  armsOut: pose(P(-0.6, 1.42, 0.18, V(-0.2, 1, 0.15), V(-1, 0, 0.25), OPEN)),
  together: pose(P(-0.08, 1.38, 0.36, V(0.05, 1, 0.3), V(1, 0, 0), OPEN)),
  present: pose(P(-0.41, 1.26, 0.32, V(-0.5, 0.15, 1), V(0.15, 1, 0.1), OPEN), mirror(HANG_R)),
  raise: pose(P(-0.22, 1.6, 0.36, V(0.05, 0.9, 0.45), V(0.05, 0.25, 1), OPEN), mirror(HANG_R)),
  behold: pose(P(-0.44, 1.2, 0.24, V(-0.4, -0.05, 1), V(0.1, 1, 0.1), OPEN)),
  palm: pose(P(-0.19, 1.22, 0.29, V(0.25, 0.06, 1), V(0, 1, 0.05), CUP), mirror(HANG_R)),
  crush: pose(P(-0.19, 1.24, 0.28, V(0.25, 0.06, 1), V(0, 1, 0.05), FIST), mirror(HANG_R)),
  sealUp: pose(P(-0.19, 1.22, 0.29, V(0.25, 0.06, 1), V(0, 1, 0.05), CUP), P(0.0, 1.46, 0.34, V(-0.35, -0.1, 1), V(0, -1, 0), FIST)),
  sealDown: pose(P(-0.19, 1.22, 0.29, V(0.25, 0.06, 1), V(0, 1, 0.05), CUP), P(-0.1, 1.33, 0.32, V(-0.35, -0.1, 1), V(0, -1, 0), FIST)),
  drum: pose(P(-0.25, 1.15, 0.24, V(0.05, -0.25, 1), V(0, -1, 0.1), RELAX), mirror(HANG_R)),
  fists: pose(P(-0.33, 1.1, 0.14, V(-0.1, -1, 0.2), V(1, 0, 0), FIST)),
  // the scroll floats above his open palm: fingers curled like he is holding something that is not there
  conjure: pose(P(-0.19, 1.18, 0.3, V(0.25, 0.08, 1), V(0, 1, 0.05), [0.18, 0.3, 0.36, 0.42, 0.48]), mirror(HANG_R)),
  conjureFist: pose(P(-0.19, 1.2, 0.29, V(0.25, 0.08, 1), V(0, 1, 0.05), FIST), mirror(HANG_R)),
  cast: pose(P(-0.19, 1.18, 0.3, V(0.25, 0.08, 1), V(0, 1, 0.05), [0.18, 0.3, 0.36, 0.42, 0.48]), P(0.12, 1.36, 0.42, V(-0.55, 0.35, 0.75), V(-0.75, 0.1, 0.4), [0.05, 0.0, 0.05, 0.12, 0.2]))
};
const SEQ = {
  crush: [['conjureFist', 0.9, 380]],
  cast: [['cast', 1.5, 140]],
  seal: [['sealUp', 0.55, 160], ['sealDown', 0.2, 700], ['sealDown', 0.55, 260], ['sealUp', 0.45, 160]],
  fists: [['fists', 1.6, 400]]
};
// blend two poses (used for scroll-scrubbed gestures)
export function mixPose(a, b, t) {
  const m = (h1, h2) => ({ pos: h1.pos.clone().lerp(h2.pos, t), f: h1.f.clone().lerp(h2.f, t).normalize(), p: h1.p.clone().lerp(h2.p, t).normalize(), curl: h1.curl.map((c, i) => c + (h2.curl[i] - c) * t) });
  return { r: m(a.r, b.r), l: m(a.l, b.l) };
}

// ---------------------------------------------------------------------------------------------- rig
class Rig {
  constructor(scene) {
    this.scene = scene;
    this.b = {};
    scene.traverse((o) => { if (o.isBone) this.b[o.name.replace(/[.:\s]/g, '')] = o; });
    this.capture();
  }
  key(n) { return n.replace(/[.:\s]/g, ''); }
  get(n) { return this.b[this.key(n)]; }
  capture() {
    this.scene.updateMatrixWorld(true);
    this.bindQ = {}; this.rest = {}; this.restPos = {};
    for (const [n, bone] of Object.entries(this.b)) {
      const q = new THREE.Quaternion(); bone.getWorldQuaternion(q);
      this.bindQ[n] = q; this.rest[n] = bone.quaternion.clone(); this.restPos[n] = bone.position.clone();
    }
  }
  wp(n, out = V(0, 0, 0)) { return this.get(n).getWorldPosition(out); }
  // world rotation so that bind-space vectors (a1, a2) land on (d1, d2)
  aim(n, a1, a2, d1, d2) {
    const bone = this.get(n), k = this.key(n);
    const a2o = a2.clone().addScaledVector(a1, -a2.dot(a1)).normalize();
    const mb = new THREE.Matrix4().makeBasis(a1, a2o, new THREE.Vector3().crossVectors(a1, a2o));
    const d2o = d2.clone().addScaledVector(d1, -d2.dot(d1)).normalize();
    const md = new THREE.Matrix4().makeBasis(d1, d2o, new THREE.Vector3().crossVectors(d1, d2o));
    const qW = new THREE.Quaternion().setFromRotationMatrix(md.multiply(mb.transpose())).multiply(this.bindQ[k]);
    const pq = new THREE.Quaternion(); bone.parent.getWorldQuaternion(pq);
    bone.quaternion.copy(pq.invert().multiply(qW));
    bone.updateMatrixWorld(true);
  }
}

function twoBone(sh, el, wr, target, poleHint) {
  const a = sh.distanceTo(el), b = el.distanceTo(wr);
  const d = target.clone().sub(sh);
  const len = clamp(d.length(), Math.abs(a - b) + 0.01, a + b - 0.003);
  const dir = d.normalize();
  const po = poleHint.clone().addScaledVector(dir, -poleHint.dot(dir)).normalize();
  const x = (a * a - b * b + len * len) / (2 * len), h = Math.sqrt(Math.max(0, a * a - x * x));
  return { elbow: sh.clone().addScaledVector(dir, x).addScaledVector(po, h), wrist: sh.clone().addScaledVector(dir, len), pole: po };
}

// ---------------------------------------------------------------------------------------------- the forge
// Every material on him gets a blackbody emission term that cools unevenly from the top down.
const heatU = { uHeat: { value: 0 }, uHeatTime: { value: 0 }, uHeatTop: { value: 2.0 }, uHeadPos: { value: new THREE.Vector3(0, 1.75, 0) } };
function addHeat(mat, strength = 1, backDark = 1) {
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, heatU);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWorldH;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWorldH = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWorldH; uniform float uHeat, uHeatTime, uHeatTop; uniform vec3 uHeadPos;
      float hh(vec3 p){ p = fract(p * 0.3183 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float hn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hh(i), hh(i+vec3(1,0,0)), f.x), mix(hh(i+vec3(0,1,0)), hh(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(hh(i+vec3(0,0,1)), hh(i+vec3(1,0,1)), f.x), mix(hh(i+vec3(0,1,1)), hh(i+vec3(1,1,1)), f.x), f.y), f.z); }
      vec3 bb(float t){ t = clamp(t, 0.0, 1.0);
        vec3 a = vec3(0.0), b = vec3(0.5, 0.04, 0.0), c = vec3(2.2, 0.55, 0.06), d = vec3(3.4, 2.2, 1.0);
        return t < 0.35 ? mix(a, b, t / 0.35) : (t < 0.7 ? mix(b, c, (t - 0.35) / 0.35) : mix(c, d, (t - 0.7) / 0.3)); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      if (uHeat > 0.001) {
        float n = hn(vWorldH * 9.0 + vec3(0.0, uHeatTime * 0.6, 0.0)) * 0.6 + hn(vWorldH * 23.0) * 0.4;
        float cool = smoothstep(uHeatTop + 0.4, uHeatTop - 0.6, vWorldH.y);
        float t = uHeat * (0.55 + 0.55 * n) * mix(1.0, 0.55, cool * (1.0 - uHeat));
        totalEmissiveRadiance += bb(t) * ${strength.toFixed(2)};
      }`)
      .replace('#include <opaque_fragment>', `${backDark < 1 ? `{
        // the lining: surfaces near the head that face in toward it sit in the hood's shadow
        vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
        vec3 toP = vWorldH - uHeadPos; float dH = length(toP);
        float inward = dot(nW, toP / max(dH, 1e-4));
        float near = 1.0 - smoothstep(0.22, 0.34, dH);
        float shade = mix(1.0, mix(${backDark.toFixed(2)}, 1.0, smoothstep(-0.3, 0.1, inward)), near);
        if (!gl_FrontFacing) shade = min(shade, ${backDark.toFixed(2)});
        outgoingLight *= shade;
      }` : ''}
      #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'heat-' + mat.name + strength + '-' + backDark;
  return mat;
}

export function makeMaterials(tex) {
  const t = tex || {};
  const cloth = new THREE.MeshPhysicalMaterial({ color: 0x123c1b, roughness: 0.88, metalness: 0, sheen: 0.5, sheenColor: new THREE.Color(0x2f7a46), sheenRoughness: 0.45, normalMap: t.suedeN || null, normalScale: new THREE.Vector2(0.5, 0.5) });
  const lining = new THREE.MeshPhysicalMaterial({ color: 0x06180c, roughness: 0.9, metalness: 0, sheen: 0.6, sheenColor: new THREE.Color(0x1d5a37), sheenRoughness: 0.5, side: THREE.BackSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa3a0, metalness: 1, roughness: 0.4, roughnessMap: t.metalR || null });
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x4a5352, metalness: 1, roughness: 0.45 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a456, metalness: 1, roughness: 0.3 });
  const emerald = new THREE.MeshPhysicalMaterial({ color: 0x0b7a3c, emissive: 0x18a855, emissiveIntensity: 0.7, roughness: 0.08, clearcoat: 1 });
  return { cloth, lining, steel, steelDark, gold, emerald };
}

// ---------------------------------------------------------------------------------------------- Doom
export class Doom {
  constructor(engine, gltf, mats) {
    this.engine = engine; this.m = mats; this.tier = engine.tier;
    this.root = new THREE.Group(); this.root.name = 'doom';
    this.model = gltf.scene;
    this.model.scale.setScalar(HEIGHT / SRC_HEIGHT);
    this.root.add(this.model);
    this.meshes = [];
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      this.meshes.push(o);
      const m = o.material;
      if (/HOOD|TUNIC/i.test(m.name)) {
        const v = new THREE.MeshPhysicalMaterial({ map: m.map, normalMap: m.normalMap, color: 0xb8c4bc, roughness: 0.86, metalness: 0, sheen: 0.45, sheenColor: new THREE.Color(0x2a6a40), sheenRoughness: 0.5, name: m.name });
        if (/TUNIC/i.test(m.name)) { v.color.set(0xd8d8d8); v.roughness = 0.78; }
        v.side = THREE.DoubleSide;
        o.material = addHeat(v, 0.4, 0.14);
      } else {
        m.envMapIntensity = /PINS|BUCKLE|ROPE/i.test(m.name) ? 0.6 : 1.0;
        if (/PINS|ROPE|BUCKLE/i.test(m.name)) m.roughness = Math.max(m.roughness, 0.38);
        o.material = addHeat(m, 1.0);
      }
    });
    this.rig = new Rig(this.model);
    this._calibrate();
    this._eyes();
    this._cape();
    this.base = 'hang'; this.basePose = POSES.hang; this.seq = null;
    this.hands = {
      r: { pos: POSES.hang.r.pos.clone(), vel: V(0, 0, 0), curl: RELAX.slice() },
      l: { pos: POSES.hang.l.pos.clone(), vel: V(0, 0, 0), curl: RELAX.slice() }
    };
    this.gazeWorld = V(0, 1.75, 5); this.headYaw = 0; this.headPitch = 0;
    this.eyes = 1; this.drumming = false; this.lookBack = 0;
    this.breath = 0; this.windScale = 1;
    this._lastYaw = 0; this._yawVel = 0;
  }

  // read the bind pose: bone axes, hand frames, finger curl axes (no assumptions about the exporter's axes)
  _calibrate() {
    const r = this.rig;
    this.side = {};
    for (const [s, sx] of [['r', -1], ['l', 1]]) {
      const n = (b) => `${b}.${s}`;
      const sh = r.wp(n('c_arm_twist_offset')), el = r.wp(n('forearm_stretch')), wr = r.wp(n('hand'));
      const mid = r.wp(n('middle1')), idx = r.wp(n('index1')), pnk = r.wp(n('pinky1'));
      const f = mid.clone().sub(wr).normalize();
      let p = new THREE.Vector3().crossVectors(f, idx.clone().sub(pnk)).normalize();
      if (p.dot(V(-sx, -1, 0)) < 0) p.negate();      // palms face in and down in the A-pose
      this.side[s] = { sx, f, p, upperDir: el.clone().sub(sh).normalize(), foreDir: wr.clone().sub(el).normalize(), pole: V(0, 0, -1) };
      for (const fn of ['index', 'middle', 'ring', 'pinky', 'thumb']) {
        const chain = fn === 'thumb' ? [n('thumb1'), n('c_thumb2'), n('c_thumb3')] : [n(fn + '1'), n('c_' + fn + '2'), n('c_' + fn + '3')];
        for (let k = 0; k < 3; k++) {
          const bone = r.get(chain[k]); if (!bone) continue;
          const a = r.wp(chain[k]);
          const b = k < 2 && r.get(chain[k + 1]) ? r.wp(chain[k + 1]) : a.clone().addScaledVector(f, 0.02);
          const dir = b.clone().sub(a).normalize();
          const toward = fn === 'thumb' ? p.clone().add(f.clone().multiplyScalar(0.6)).normalize() : p;
          bone.userData.curl = new THREE.Vector3().crossVectors(dir, toward).normalize().applyQuaternion(r.bindQ[r.key(chain[k])].clone().invert());
        }
      }
    }
    this.spine = ['spine_01.x', 'spine_02.x', 'spine_03.x'].map((n) => r.get(n));
    this.neck = r.get('neck.x'); this.head = r.get('head.x');
  }

  // eyes: two small emissive slits behind the mask's eye holes, riding the head bone
  _eyes() {
    const head = this.head;
    const s = new THREE.Group();
    const ws = new THREE.Vector3(); head.getWorldScale(ws);
    s.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
    s.quaternion.copy(this.rig.bindQ[this.rig.key('head.x')]).invert();
    head.add(s);
    this.eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 2.6, 1.2), transparent: true, opacity: 0, depthWrite: false });
    const g = new THREE.SphereGeometry(0.012, 12, 8); g.scale(1.5, 0.55, 0.5);
    this.eyeL = new THREE.Mesh(g, this.eyeMat); this.eyeR = new THREE.Mesh(g, this.eyeMat);
    this.eyeL.position.set(0.033, 0.068, 0.088); this.eyeR.position.set(-0.033, 0.068, 0.088);
    this.eyeL.rotation.z = 0.18; this.eyeR.rotation.z = -0.18;
    s.add(this.eyeL, this.eyeR);
    this.eyeGlow = new THREE.PointLight(0x46eb93, 0, 0.6, 2); this.eyeGlow.position.set(0, 0.07, 0.11); s.add(this.eyeGlow);
    this.headSocket = s;
  }

  _cape() {
    const W = this.tier === 2 ? 22 : this.tier === 1 ? 28 : 34;
    const H = this.tier === 2 ? 30 : this.tier === 1 ? 38 : 44;
    const top = 1.63, len = 1.6;
    this.capeRest = (i, j) => {
      const u = i / (W - 1) - 0.5, s = j / (H - 1);
      const a = u * (2.6 - 0.9 * (1 - s));
      const R = 0.2 + 0.32 * (1 - s);
      return V(Math.sin(a) * R * (1.05 + 0.15 * (1 - s)), top - (1 - s) * len, -Math.cos(a) * R * (0.62 + 0.2 * (1 - s)) - 0.06 - 0.1 * (1 - s));
    };
    this.cloth = new Cloth(this.engine, { W, H, rest: this.capeRest, material: this.m.cloth, iterations: this.tier === 2 ? 6 : 10 });
    this.root.add(this.cloth.mesh);
    const lining = this.m.lining;
    lining.onBeforeCompile = this.m.cloth.onBeforeCompile;
    lining.customProgramCacheKey = () => 'cloth-lining-v2';
    this.capeLining = new THREE.Mesh(this.cloth.mesh.geometry, lining);
    this.capeLining.frustumCulled = false;
    this.root.add(this.capeLining);
    this.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.spine[2].matrixWorld).invert();
    this.pinLocal = [];
    for (let i = 0; i < W; i++) this.pinLocal.push(this.capeRest(i, H - 1).applyMatrix4(this.root.matrixWorld).applyMatrix4(inv));
    this._spheres = Array.from({ length: 6 }, () => new THREE.Vector4());
    this._caps = [[new THREE.Vector4(), new THREE.Vector4()], [new THREE.Vector4(), new THREE.Vector4()]];
  }

  // ------------------------------------------------------------------ control
  setPose(name) { if (POSES[name]) { this.base = name; this.basePose = POSES[name]; } }
  setPoseMix(a, b, t) { this.base = 'mix'; this.basePose = mixPose(POSES[a], POSES[b], clamp(t, 0, 1)); }
  play(name, onDone) { const s = SEQ[name]; if (s) this.seq = { steps: s, i: 0, t: 0, onDone }; }
  gazeAt(v) { this.gazeWorld.copy(v); }
  setHeat(h, top) { heatU.uHeat.value = h; if (top !== undefined) heatU.uHeatTop.value = top; }

  // ------------------------------------------------------------------ frame
  update(dt, time) {
    if (!this.root.visible) return;
    const r = this.rig;
    heatU.uHeatTime.value = time;
    r.wp('head.x', heatU.uHeadPos.value).add(V(0, 0.07, 0.0));
    for (const [k, bone] of Object.entries(r.b)) { bone.quaternion.copy(r.rest[k]); bone.position.copy(r.restPos[k]); }

    // breathing and a slow sovereign sway
    this.breath += dt;
    const br = Math.sin(this.breath * 1.3), sw = Math.sin(this.breath * 0.37);
    const qa = (x, y, z, a) => new THREE.Quaternion().setFromAxisAngle(V(x, y, z), a);
    this.spine[0].quaternion.premultiply(qa(0, 0, 1, sw * 0.012));
    this.spine[1].quaternion.premultiply(qa(1, 0, 0, br * 0.012));
    this.spine[2].quaternion.premultiply(qa(1, 0, 0, br * 0.016));

    // gaze: the chest, neck and head share the turn; looking back over a shoulder takes more of the body
    this.root.updateMatrixWorld();
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const g = this.gazeWorld.clone().applyMatrix4(inv);
    const ty = Math.atan2(g.x, g.z), tp = -Math.atan2(g.y - 1.78, Math.hypot(g.x, g.z));
    const yawMax = 0.9 + 1.4 * this.lookBack;
    this.headYaw = damp(this.headYaw, clamp(ty, -yawMax, yawMax), 4, dt);
    this.headPitch = damp(this.headPitch, clamp(tp, -0.4, 0.35), 4, dt);
    this.spine[2].quaternion.premultiply(qa(0, 1, 0, this.headYaw * (0.12 + 0.25 * this.lookBack)));
    this.neck.quaternion.premultiply(qa(0, 1, 0, this.headYaw * 0.3)).premultiply(qa(1, 0, 0, this.headPitch * 0.35));
    this.head.quaternion.premultiply(qa(0, 1, 0, this.headYaw * 0.5)).premultiply(qa(1, 0, 0, this.headPitch * 0.6));
    this.model.updateMatrixWorld(true);

    // hands: critically damped springs toward the pose, then IK
    let tgt = this.basePose, stiff = 60;
    if (this.drumming && this.base === 'hang') tgt = POSES.drum;
    if (this.seq) {
      const st = this.seq.steps[this.seq.i];
      tgt = POSES[st[0]]; stiff = st[2];
      this.seq.t += dt;
      if (this.seq.t >= st[1]) { this.seq.i++; this.seq.t = 0; if (this.seq.i >= this.seq.steps.length) { const cb = this.seq.onDone; this.seq = null; if (cb) cb(); } }
    }
    for (const s of ['r', 'l']) {
      const H = this.hands[s], T = tgt[s];
      const k = stiff, c = 2 * Math.sqrt(k), sub = Math.max(1, Math.ceil(dt * 120)), h = dt / sub;
      for (let n = 0; n < sub; n++) {
        H.vel.x += ((T.pos.x - H.pos.x) * k - H.vel.x * c) * h;
        H.vel.y += ((T.pos.y - H.pos.y) * k - H.vel.y * c) * h;
        H.vel.z += ((T.pos.z - H.pos.z) * k - H.vel.z * c) * h;
        H.pos.addScaledVector(H.vel, h);
      }
      for (let i = 0; i < 5; i++) {
        let c0 = T.curl[i];
        if (this.drumming && s === 'r' && i > 0 && !this.seq) c0 = 0.12 + 0.7 * Math.pow(Math.max(0, Math.sin(time * 12 - (4 - i) * 0.85)), 3);
        H.curl[i] = damp(H.curl[i], c0, stiff > 300 ? 26 : 10, dt);
      }
      this._solveArm(s, H, T);
    }

    this._updateCape(dt, time, inv);

    const e = this.eyes * (0.94 + 0.06 * Math.sin(time * 21));
    this.eyeMat.opacity = clamp(e, 0, 1);
    const k2 = Math.max(1, e);
    this.eyeMat.color.setRGB(0.35 * k2, 2.6 * k2, 1.2 * k2);
    this.eyeGlow.intensity = e * 0.25;
  }

  _solveArm(s, H, T) {
    const r = this.rig, S = this.side[s], root = this.root.matrixWorld;
    const n = (b) => `${b}.${s}`;
    const sh = r.wp(n('c_arm_twist_offset')), el = r.wp(n('forearm_stretch')), wr = r.wp(n('hand'));
    const sol = twoBone(sh, el, wr, H.pos.clone().applyMatrix4(root), V(S.sx * 0.8, -0.55, -0.75).transformDirection(root));
    r.aim(n('c_arm_twist_offset'), S.upperDir, S.pole, sol.elbow.clone().sub(sh).normalize(), sol.pole);
    r.aim(n('forearm_stretch'), S.foreDir, S.pole, sol.wrist.clone().sub(sol.elbow).normalize(), sol.pole);
    r.aim(n('hand'), S.f, S.p, T.f.clone().transformDirection(root), T.p.clone().transformDirection(root));
    for (const [fn, ci] of [['thumb', 0], ['index', 1], ['middle', 2], ['ring', 3], ['pinky', 4]]) {
      const chain = fn === 'thumb' ? [n('thumb1'), n('c_thumb2'), n('c_thumb3')] : [n(fn + '1'), n('c_' + fn + '2'), n('c_' + fn + '3')];
      for (let k = 0; k < 3; k++) {
        const bone = r.get(chain[k]); if (!bone || !bone.userData.curl) continue;
        const ang = H.curl[ci] * (fn === 'thumb' ? [0.35, 0.7, 0.7][k] : [1.35, 1.6, 1.1][k]);
        bone.quaternion.copy(r.rest[r.key(chain[k])]).multiply(new THREE.Quaternion().setFromAxisAngle(bone.userData.curl, ang));
      }
    }
    r.get(n('hand')).updateMatrixWorld(true);
  }

  _updateCape(dt, time, invRoot) {
    const r = this.rig, chest = this.spine[2];
    chest.updateMatrixWorld(true);
    for (let i = 0; i < this.cloth.W; i++) this.cloth.pins[i].copy(this.pinLocal[i]).applyMatrix4(chest.matrixWorld).applyMatrix4(invRoot);
    const L = (n) => r.wp(n).applyMatrix4(invRoot);
    const S = this._spheres;
    const c = L('spine_03.x'), b1 = L('spine_01.x'), hip = L('root.x'), nk = L('neck.x');
    const sr = L('c_arm_twist_offset.r'), sl = L('c_arm_twist_offset.l');
    S[0].set(c.x, c.y - 0.05, c.z - 0.02, 0.2); S[1].set(b1.x, b1.y, b1.z - 0.02, 0.19); S[2].set(sr.x, sr.y, sr.z, 0.11);
    S[3].set(sl.x, sl.y, sl.z, 0.11); S[4].set(hip.x, hip.y - 0.05, hip.z, 0.2); S[5].set(nk.x, nk.y, nk.z - 0.02, 0.11);
    const cap = (a, b, C) => { const p = L(a), q = L(b); C[0].set(p.x, p.y, p.z, 0.11); C[1].set(q.x, q.y, q.z, 0.1); };
    cap('thigh_twist.r', 'leg_stretch.r', this._caps[0]); cap('thigh_twist.l', 'leg_stretch.l', this._caps[1]);
    this.cloth.setColliders(S, this._caps);
    const yaw = this.root.rotation.y;
    let dy = yaw - this._lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this._lastYaw = yaw;
    this._yawVel = damp(this._yawVel, dt > 0 ? dy / dt : 0, 6, dt);
    this.cloth.accel.set(0, 0, 0);
    this.cloth.wind.set((0.22 + this._yawVel * 1.4) * this.windScale, 0.12, (-0.5 - Math.abs(this._yawVel) * 0.6) * this.windScale);
    this.cloth.update(dt, time);
  }

  // ------------------------------------------------------------------ queries
  palm(s = 'r') {
    const S = this.side[s], hand = this.rig.get(`hand.${s}`);
    hand.updateMatrixWorld(true);
    const q = new THREE.Quaternion(); hand.getWorldQuaternion(q);
    const qd = q.multiply(this.rig.bindQ[this.rig.key(`hand.${s}`)].clone().invert());
    const nrm = S.p.clone().applyQuaternion(qd), fwd = S.f.clone().applyQuaternion(qd);
    const pos = this.rig.wp(`middle1.${s}`).addScaledVector(fwd, -0.03).addScaledVector(nrm, 0.03);
    return { pos, nrm, fwd };
  }
  headWorld() { return this.rig.wp('head.x').add(V(0, 0.09, 0.06).applyQuaternion(this.root.quaternion)); }
  chestWorld() { return this.rig.wp('spine_03.x').add(V(0, 0.02, 0.17).applyQuaternion(this.root.quaternion)); }
}
