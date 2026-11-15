import * as THREE from 'three';
import { rand } from '../utils.js';

let stripeTex = null;
function stripeTexture() {
  if (stripeTex) return stripeTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#f5f1e6';
  g.fillRect(0, 0, 128, 32);
  g.fillStyle = '#ff6a3d';
  for (let x = -32; x < 160; x += 32) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 16, 0);
    g.lineTo(x + 16 - 32, 32);
    g.lineTo(x - 32, 32);
    g.closePath();
    g.fill();
  }
  stripeTex = new THREE.CanvasTexture(c);
  stripeTex.colorSpace = THREE.SRGBColorSpace;
  return stripeTex;
}

function makeRock() {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.52, 0),
    new THREE.MeshStandardMaterial({ color: '#6d6f78', roughness: 0.95, flatShading: true })
  );
  rock.position.y = 0.42;
  rock.scale.set(rand(0.9, 1.15), rand(0.8, 1.1), rand(0.9, 1.15));
  rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
  g.add(rock);
  return g;
}

function makeBarrier() {
  const g = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.42, 0.1),
    new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.6 })
  );
  board.position.y = 0.72;
  g.add(board);

  const legMat = new THREE.MeshStandardMaterial({ color: '#d8d4c8', roughness: 0.7 });
  [-0.55, 0.55].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.85, 0.09), legMat);
    leg.position.set(x, 0.42, 0);
    leg.rotation.z = x < 0 ? 0.16 : -0.16;
    g.add(leg);
  });

  const foot = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.42), legMat);
  foot.position.y = 0.04;
  g.add(foot);
  return g;
}

function makeCrab() {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: '#ff5d4a', roughness: 0.55, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#c33f30', roughness: 0.6 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), shell);
  body.scale.set(1.15, 0.62, 0.95);
  body.position.y = 0.32;
  g.add(body);

  [-1, 1].forEach((s) => {
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), dark);
    claw.scale.set(1, 0.8, 1.35);
    claw.position.set(s * 0.42, 0.36, -0.24);
    claw.userData.anim = 'claw';
    claw.userData.side = s;
    g.add(claw);

    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 5), dark);
    stalk.position.set(s * 0.16, 0.54, -0.12);
    g.add(stalk);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: '#1a1a20' }));
    eye.position.set(s * 0.16, 0.65, -0.12);
    g.add(eye);
  });

  const legs = [];
  [-1, 1].forEach((s) => {
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.34, 4), dark);
      leg.position.set(s * 0.42, 0.16, 0.05 + i * 0.14);
      leg.rotation.z = s * 0.7;
      g.add(leg);
      legs.push({ mesh: leg, side: s, i });
    }
  });

  g.userData.animate = (t) => {
    legs.forEach(({ mesh, side, i }) => {
      mesh.rotation.z = side * (0.7 + Math.sin(t * 9 + i) * 0.14);
    });
    g.children.forEach((c) => {
      if (c.userData.anim === 'claw') {
        c.rotation.z = Math.sin(t * 7 + c.userData.side) * 0.25 * c.userData.side;
      }
    });
    body.position.y = 0.32 + Math.abs(Math.sin(t * 9)) * 0.02;
  };

  return g;
}

const FACTORIES = {
  rock: makeRock,
  barrier: makeBarrier,
  crab: makeCrab,
};

// 各障碍需要跳多高才能越过（略高于自身高度）
export const CLEAR_HEIGHT = { rock: 1.02, barrier: 0.72, crab: 0.56 };

export function createObstacleMesh(kind) {
  const factory = FACTORIES[kind] || makeRock;
  const mesh = factory();
  mesh.userData.clearHeight = CLEAR_HEIGHT[kind] ?? 0.8;
  return mesh;
}

export const OBSTACLE_KINDS = ['rock', 'barrier', 'crab'];
