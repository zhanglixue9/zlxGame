import * as THREE from 'three';

let goldMat = null;
let innerMat = null;

function getMaterials() {
  if (!goldMat) {
    goldMat = new THREE.MeshStandardMaterial({
      color: '#ffce4a',
      emissive: '#c07a0a',
      emissiveIntensity: 0.7,
      roughness: 0.25,
      metalness: 0.9,
    });
    innerMat = new THREE.MeshStandardMaterial({
      color: '#fff6c9',
      emissive: '#ffd873',
      emissiveIntensity: 1.4,
      roughness: 0.3,
      metalness: 0.6,
    });
  }
  return { goldMat, innerMat };
}

/** 一枚悬浮旋转的金币，面朝玩家 */
export function createCoinMesh() {
  const { goldMat: gold, innerMat: inner } = getMaterials();
  const g = new THREE.Group();

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.055, 18), gold);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 6, 20), gold);
  g.add(ring);

  const hole = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 5, 16), inner);
  g.add(hole);

  g.scale.setScalar(1);
  return g;
}
