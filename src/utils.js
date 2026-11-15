import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** 帧率无关的指数逼近 */
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

/** 把一根 baseLen=1、沿 +Y 的圆柱摆到 a→b 之间 */
export function orientCylinder(mesh, a, b) {
  _dir.subVectors(b, a);
  const len = _dir.length() || 0.0001;
  mesh.position.copy(a).addScaledVector(_dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, _dir.divideScalar(len));
  mesh.scale.set(1, len, 1);
}

/** 生成径向渐变圆形贴图（假阴影 / 光斑用） */
export function radialTexture(size = 128, stops = [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([p, color]) => grd.addColorStop(p, color));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => m.dispose());
    }
  });
}

/** 高亮色（emissive）材质，用于金币/灯光 */
export function emissiveMat(color, emissive, intensity = 1) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.35,
    metalness: 0.55,
  });
}
