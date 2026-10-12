// Everything the world needs, fetched while the cold read types itself.
// Doom: the imported Doctor Doom model, converted from .blend to glTF with a rebuilt deform hierarchy.
// Poly Haven HDRI + textures (CC0). Event photos are Makeathon's own and live in the page as <img>.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export const PHOTOS = [
  { title: 'The opening', sub: 'Day 1 · Inauguration' },
  { title: 'The hall', sub: 'Era Sehziyan Auditorium' },
  { title: 'The build', sub: 'Prototypes in progress' },
  { title: 'The reviews', sub: 'Staged design reviews' },
  { title: 'The demos', sub: 'Working prototypes' },
  { title: 'The winners', sub: 'Day 2 · Valedictory' }
];

export async function loadCore(engine, onProgress, base = './') {
  const u = (path) => base + path.replace(/^\.\//, '');
  const manager = new THREE.LoadingManager();
  manager.onProgress = (url, done, total) => onProgress && onProgress(done / total);
  const tex = new THREE.TextureLoader(manager);
  const maxAniso = engine.renderer.capabilities.getMaxAnisotropy();
  const T = (url, srgb) => new Promise((res) => tex.load(url, (t) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, maxAniso);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    res(t);
  }, undefined, () => res(null)));
  const [gltf, hdr, stoneD, stoneN, stoneR, suedeN] = await Promise.all([
    new GLTFLoader(manager).loadAsync(u('./assets/models/doom.glb')),
    new RGBELoader(manager).loadAsync(u('./assets/env/studio_small_08_512.hdr')).catch(() => null),
    T(u('./assets/tex/stone_diff.webp'), true), T(u('./assets/tex/stone_nor.webp'), false), T(u('./assets/tex/stone_rough.webp'), false),
    T(u('./assets/tex/suede_nor.webp'), false)
  ]);
  let env = null;
  if (hdr) {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(engine.renderer);
    env = pm.fromEquirectangular(hdr).texture;
    pm.dispose(); hdr.dispose();
  }
  return { gltf, env, tex: { stoneD, stoneN, stoneR, suedeN } };
}
