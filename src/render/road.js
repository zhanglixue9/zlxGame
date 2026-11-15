import * as THREE from 'three';
import { CONFIG, PALETTE } from '../config.js';

function asphaltTexture() {
  const w = 256;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');

  g.fillStyle = PALETTE.road;
  g.fillRect(0, 0, w, h);

  // 沥青颗粒
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const v = Math.random();
    g.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.10)';
    g.fillRect(x, y, 1.6, 1.6);
  }

  // 轮胎压痕（两条略深的纵向带）
  g.fillStyle = 'rgba(0,0,0,0.10)';
  g.fillRect(w * 0.18, 0, 26, h);
  g.fillRect(w * 0.66, 0, 26, h);

  // 路肩实线
  g.fillStyle = 'rgba(244,234,210,0.62)';
  g.fillRect(w * 0.045, 0, 5, h);
  g.fillRect(w * 0.955 - 5, 0, 5, h);

  // 车道虚线（3 车道 → 两条虚线）
  g.fillStyle = 'rgba(244,234,210,0.80)';
  g.fillRect(w / 3 - 2.5, 0, 5, h * 0.30);
  g.fillRect((w * 2) / 3 - 2.5, 0, 5, h * 0.30);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createRoad() {
  const group = new THREE.Group();
  const { width, length } = CONFIG.road;
  const repeat = Math.round(length / CONFIG.road.tileLength);
  const tile = length / repeat;

  const tex = asphaltTexture();
  tex.repeat.set(1, repeat);

  const roadMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.94,
    metalness: 0.0,
  });

  const road = new THREE.Mesh(new THREE.PlaneGeometry(width, length), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, 20 - length / 2);
  group.add(road);

  // 右侧陆地
  const land = new THREE.Mesh(
    new THREE.PlaneGeometry(260, length + 200),
    new THREE.MeshStandardMaterial({ color: '#6f6a45', roughness: 1 })
  );
  land.rotation.x = -Math.PI / 2;
  land.position.set(width / 2 + 130, -0.08, 20 - length / 2);
  group.add(land);

  // 左侧沙滩：向外倾斜入水，和减浪后的海面自然衔接
  const sandGeo = new THREE.PlaneGeometry(9.5, length + 200, 2, 2);
  sandGeo.rotateX(-Math.PI / 2);
  {
    const pos = sandGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const t = (x + 4.75) / 9.5; // 0 = 靠海，1 = 靠路
      pos.setY(i, -1.06 + t * 0.74);
    }
    sandGeo.computeVertexNormals();
  }
  const sand = new THREE.Mesh(
    sandGeo,
    new THREE.MeshStandardMaterial({ color: '#d9b78d', roughness: 1 })
  );
  sand.position.set(-width / 2 - 4.75, 0, 20 - length / 2);
  group.add(sand);

  // 路缘石
  const curbMat = new THREE.MeshStandardMaterial({ color: '#cfc6b4', roughness: 0.85 });
  [-1, 1].forEach((s) => {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, length), curbMat);
    curb.position.set(s * (width / 2 + 0.1), 0.06, 20 - length / 2);
    group.add(curb);
  });

  // 海侧护栏横梁
  const railMat = new THREE.MeshStandardMaterial({ color: '#d7dade', roughness: 0.45, metalness: 0.7 });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.17, length), railMat);
  rail.position.set(-(width / 2 + 0.75), 0.66, 20 - length / 2);
  group.add(rail);
  const rail2 = rail.clone();
  rail2.position.y = 0.34;
  group.add(rail2);

  return {
    group,
    update(dt, deltaDistance) {
      tex.offset.y += deltaDistance / tile;
    },
  };
}
