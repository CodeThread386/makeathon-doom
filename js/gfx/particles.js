// GPU particles: every point moves in its vertex shader, so the CPU only updates a few uniforms.
import * as THREE from 'three';

const R = (a, b) => a + Math.random() * (b - a);

// rising embers from the forge, and dust motes that light up inside the gauntlet's pool
export class Motes {
  constructor({ count, box, color, size, rise = 0, swirl = 0.3, lightPos = null, additive = true, base = 0.25 }) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3), seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = R(box[0], box[3]); pos[i * 3 + 1] = R(box[1], box[4]); pos[i * 3 + 2] = R(box[2], box[5]);
      seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    this.uniforms = {
      uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uRise: { value: rise }, uSwirl: { value: swirl },
      uHeight: { value: box[4] - box[1] }, uBottom: { value: box[1] }, uOpacity: { value: 1 }, uBase: { value: base },
      uLight: { value: new THREE.Vector3(0, -100, 0) }, uLightR: { value: 2.0 }, uPix: { value: 1 }, uFreeze: { value: 0 }
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */`
        attribute vec4 seed;
        uniform float uTime, uSize, uRise, uSwirl, uHeight, uBottom, uLightR, uPix, uBase;
        uniform vec3 uLight;
        varying float vA; varying float vHeat;
        void main(){
          vec3 p = position;
          float t = uTime * (0.6 + seed.x * 0.8) + seed.y * 100.0;
          if (uRise > 0.0) {
            float y = mod(p.y - uBottom + t * uRise, uHeight);
            p.y = uBottom + y;
            vHeat = 1.0 - y / uHeight;
          } else {
            p.y += sin(t * 0.3 + seed.z * 6.28) * 0.25;
            vHeat = 1.0;
          }
          p.x += sin(t * 0.7 + seed.w * 6.28) * uSwirl + sin(t * 1.9 + seed.x * 9.0) * uSwirl * 0.3;
          p.z += cos(t * 0.6 + seed.z * 6.28) * uSwirl;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float lit = smoothstep(uLightR, 0.0, distance(p, uLight));
          vA = (uBase + lit * 1.6) * (0.4 + 0.6 * seed.w) * (uRise > 0.0 ? smoothstep(0.0, 0.15, vHeat) : 1.0);
          gl_PointSize = uSize * (0.5 + seed.z) * uPix * (1.0 + lit) / max(0.3, -mv.z);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uOpacity;
        varying float vA; varying float vHeat;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float d = dot(c, c);
          if (d > 0.25) discard;
          float a = smoothstep(0.25, 0.0, d);
          vec3 col = uColor * (1.0 + 2.0 * a);
          gl_FragColor = vec4(col * vA * uOpacity * a, 1.0);
        }`
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
  }
  update(t, pix) { this.uniforms.uTime.value = t; this.uniforms.uPix.value = pix; }
}

// streaks for the ride into 2027: lines rushing past the camera along -z
export class Warp {
  constructor(count = 900) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 6), seed = new Float32Array(count * 2 * 2);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = R(1.2, 9);
      const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.75 + 1.5, z = R(-60, 0);
      pos.set([x, y, z, x, y, z], i * 6);
      const s = Math.random();
      seed.set([s, 0, s, 1], i * 4);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 2));
    this.uniforms = { uTime: { value: 0 }, uSpeed: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0.5, 2.6, 1.3) } };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute vec2 seed; uniform float uTime, uSpeed; varying float vA;
        void main(){
          vec3 p = position;
          float z = mod(p.z + uTime * 40.0 * (0.6 + seed.x) , 60.0) - 60.0;
          p.z = z + seed.y * (0.4 + uSpeed * 6.0);
          vA = smoothstep(-60.0, -40.0, z) * (1.0 - seed.y * 0.85);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uOpacity; varying float vA;
        void main(){ gl_FragColor = vec4(uColor * vA * uOpacity, 1.0); }`
    });
    this.lines = new THREE.LineSegments(g, this.material);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
  }
}

// one-shot bursts: dust when a fist meets stone, sparks when two panels fuse
export class Bursts {
  constructor(count = 600) {
    this.count = count;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3); this.vel = new Float32Array(count * 3); this.t0 = new Float32Array(count).fill(-100); this.col = new Float32Array(count * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('vel', new THREE.BufferAttribute(this.vel, 3));
    g.setAttribute('t0', new THREE.BufferAttribute(this.t0, 1));
    g.setAttribute('col', new THREE.BufferAttribute(this.col, 3));
    this.geo = g; this.next = 0;
    this.uniforms = { uTime: { value: 0 }, uPix: { value: 1 } };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute vec3 vel; attribute float t0; attribute vec3 col;
        uniform float uTime, uPix; varying vec3 vC; varying float vA;
        void main(){
          float age = uTime - t0;
          float life = 1.6;
          vec3 p = position + vel * age + vec3(0.0, -2.2, 0.0) * age * age * 0.5 * step(0.0, vel.y + 10.0);
          p.y = max(p.y, 0.01);
          vA = age < 0.0 || age > life ? 0.0 : (1.0 - age / life);
          vC = col;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (vA > 0.0 ? 30.0 : 0.0) * uPix / max(0.3, -mv.z);
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vC; varying float vA;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c,c); if (d > 0.25) discard; gl_FragColor = vec4(vC * vA * smoothstep(0.25, 0.0, d), 1.0); }`
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
  }
  emit(origin, n, { speed = 2, up = 1.5, color = [0.6, 0.65, 0.6], spread = 1, ring = false }, time) {
    for (let k = 0; k < n; k++) {
      const i = this.next; this.next = (this.next + 1) % this.count;
      const a = Math.random() * Math.PI * 2, s = speed * (ring ? R(0.8, 1.2) : R(0.2, 1));
      this.pos.set([origin.x + R(-0.05, 0.05) * spread, origin.y, origin.z + R(-0.05, 0.05) * spread], i * 3);
      this.vel.set([Math.cos(a) * s, R(0.2, 1) * up, Math.sin(a) * s], i * 3);
      this.t0[i] = time + R(0, 0.05);
      const v = R(0.6, 1.2);
      this.col.set([color[0] * v, color[1] * v, color[2] * v], i * 3);
    }
    for (const n2 of ['position', 'vel', 't0', 'col']) this.geo.attributes[n2].needsUpdate = true;
  }
}

// layered fog sheets: big soft sprites drifting slowly, lit by nothing but themselves
export class Fog {
  constructor(sprite, { count = 26, box, color = 0x1b2b23, opacity = 0.22, size = [6, 12] }) {
    this.group = new THREE.Group();
    this.items = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.SpriteMaterial({ map: sprite, color, transparent: true, opacity, depthWrite: false, fog: false });
      const s = new THREE.Sprite(m);
      const sz = R(size[0], size[1]);
      s.scale.set(sz, sz * 0.45, 1);
      s.position.set(R(box[0], box[3]), R(box[1], box[4]), R(box[2], box[5]));
      s.material.rotation = Math.random() * Math.PI;
      s.userData = { v: R(0.05, 0.2) * (Math.random() < 0.5 ? -1 : 1), base: s.position.clone(), op: opacity * R(0.5, 1) };
      this.group.add(s); this.items.push(s);
    }
    this.opacity = 1;
  }
  update(t) {
    for (const s of this.items) {
      s.position.x = s.userData.base.x + Math.sin(t * s.userData.v + s.userData.base.z) * 1.4;
      s.material.rotation += s.userData.v * 0.002;
      s.material.opacity = s.userData.op * this.opacity;
    }
  }
}
