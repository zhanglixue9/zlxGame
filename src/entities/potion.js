import * as THREE from 'three';
import { radialTexture } from '../utils.js';

let mats = null;
function materials() {
  if (mats) return mats;
  mats = {
    glass: new THREE.MeshStandardMaterial({
      color: '#ff4d5e',
      emissive: '#c01430',
      emissiveIntensity: 0.9,
      roughness: 0.25,
      metalness: 0.15,
      transparent: true,
      opacity: 0.95,
    }),
    liquid: new THREE.MeshStandardMaterial({
      color: '#ff6b7a',
      emissive: '#ff2d4a',
      emissiveIntensity: 1.6,
      roughness: 0.4,
    }),
    cork: new THREE.MeshStandardMaterial({ color: '#d9b78d', roughness: 0.9 }),
  };
  return mats;
}

let haloTex = null;

/** 血瓶：红药水瓶 + 柔光，捡到回一格血 */
export function createPotionMesh() {
  const { glass, liquid, cork } = materials();
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 12), glass);
  body.position.y = 0.02;
  g.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), liquid);
  belly.scale.set(1, 0.75, 1);
  belly.position.y = -0.02;
  g.add(belly);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.08, 0.14, 10), glass);
  neck.position.y = 0.23;
  g.add(neck);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 8), cork);
  cap.position.y = 0.32;
  g.add(cap);

  // 柔光片，远处也能一眼看到
  if (!haloTex) {
    haloTex = radialTexture(96, [
      [0, 'rgba(255,140,150,0.85)'],
      [0.4, 'rgba(255,80,100,0.35)'],
      [1, 'rgba(255,60,80,0)'],
    ]);
  }
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.85,
    })
  );
  halo.scale.setScalar(1.7);
  g.add(halo);
  g.userData.halo = halo;

  return g;
}
