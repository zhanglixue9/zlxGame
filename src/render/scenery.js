import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { rand } from '../utils.js';

const ROAD_HALF = CONFIG.road.width / 2;

function palmTree() {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#8a6a49', roughness: 0.95 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3f6b46', roughness: 0.85, side: THREE.DoubleSide });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.22, 4.6, 7), trunkMat);
  trunk.position.y = 2.3;
  trunk.rotation.z = rand(-0.07, 0.07);
  g.add(trunk);

  const crownY = 4.55;
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.26, 2.35, 3), leafMat);
    leaf.scale.set(1, 1, 0.32);
    leaf.position.set(0, crownY, 0);
    leaf.rotation.order = 'YXZ';
    leaf.rotation.y = (i / 7) * Math.PI * 2 + rand(-0.2, 0.2);
    leaf.rotation.z = -1.05 + rand(-0.12, 0.12);
    // 让叶子从树冠向外伸
    leaf.translateY(1.05);
    leaf.rotation.x = rand(-0.25, 0.25);
    g.add(leaf);
  }
  return g;
}

function lampPost() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#cfd3da', roughness: 0.5, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.4, 8), metal);
  pole.position.y = 2.7;
  g.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.09, 0.09), metal);
  arm.position.set(-0.75, 5.35, 0);
  g.add(arm);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.14, 0.3),
    new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffb45c', emissiveIntensity: 2.2, roughness: 0.4 })
  );
  head.position.set(-1.45, 5.28, 0);
  g.add(head);
  return g;
}

function guardPost() {
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.86, 0.09),
    new THREE.MeshStandardMaterial({ color: '#b9c0c8', roughness: 0.55, metalness: 0.5 })
  );
  post.position.y = 0.43;
  return post;
}

function rock(scale, color) {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true })
  );
  mesh.scale.set(scale * rand(0.8, 1.3), scale * rand(0.6, 1.1), scale * rand(0.8, 1.3));
  mesh.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
  return mesh;
}

/**
 * 路边场景：棕榈、路灯、护栏立柱、礁石。全部对象池化，靠 z 平移循环。
 */
export function createScenery() {
  const group = new THREE.Group();
  const items = [];

  const add = (obj, spacing, count, x, y, z) => {
    obj.position.set(x, y, z);
    group.add(obj);
    items.push({ obj, range: spacing * count });
  };

  // 棕榈：海侧和陆侧交替
  for (let i = 0; i < 20; i++) {
    const onSea = i % 2 === 0;
    const p = palmTree();
    const x = onSea ? -(ROAD_HALF + rand(2.2, 4.4)) : ROAD_HALF + rand(3.4, 7.5);
    p.position.set(x, onSea ? -0.3 : -0.05, 0);
    p.rotation.y = rand(0, Math.PI * 2);
    const s = rand(0.85, 1.25);
    p.scale.setScalar(s);
    add(p, 24, 20, x, p.position.y, 30 - i * 24);
  }

  // 路灯（陆侧，灯臂伸向路面）
  for (let i = 0; i < 10; i++) {
    const l = lampPost();
    l.rotation.y = Math.PI; // 灯臂朝路
    add(l, 46, 10, ROAD_HALF + 2.4, 0, 34 - i * 46);
  }

  // 护栏立柱（海侧）
  for (let i = 0; i < 34; i++) {
    const p = guardPost();
    add(p, 7, 34, -(ROAD_HALF + 0.75), 0, 28 - i * 7);
  }

  // 路外侧礁石
  for (let i = 0; i < 14; i++) {
    const r = rock(rand(0.7, 1.7), '#5b5b63');
    add(r, 30, 14, ROAD_HALF + rand(9, 26), -0.2, 26 - i * 30);
  }

  // 海里远处礁岛
  for (let i = 0; i < 8; i++) {
    const r = rock(rand(3, 7), '#3c4a56');
    add(r, 120, 8, rand(-120, -40), -1.2, 10 - i * 120);
  }

  // 远方山脊（陆侧远景，被雾吃掉）
  for (let i = 0; i < 9; i++) {
    const r = rock(rand(14, 26), '#4b4a54');
    r.scale.y *= rand(1.6, 2.6);
    add(r, 150, 9, rand(60, 150), -2, -40 - i * 150);
  }

  return {
    group,
    update(deltaDistance) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        it.obj.position.z += deltaDistance;
        // 跑到相机后面就整组回退一个循环长度，保持等距排列
        if (it.obj.position.z > 42) it.obj.position.z -= it.range;
      }
    },
  };
}
