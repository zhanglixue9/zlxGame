import * as THREE from 'three';
import { clamp, orientCylinder } from '../utils.js';

const L1 = 0.4; // 大腿
const L2 = 0.36; // 小腿

/** 程序化鹈鹕：白胖身子 + 长喙 + 橙色喉囊 + 踩踏的双腿 */
export function createPelican(bike) {
  const root = new THREE.Group();

  const feather = new THREE.MeshStandardMaterial({ color: '#fdf6e8', roughness: 0.82 });
  const featherShade = new THREE.MeshStandardMaterial({ color: '#efe2cf', roughness: 0.85 });
  const beakMat = new THREE.MeshStandardMaterial({ color: '#ffb63f', roughness: 0.55 });
  const pouchMat = new THREE.MeshStandardMaterial({ color: '#ff8f45', roughness: 0.7 });
  const legMat = new THREE.MeshStandardMaterial({ color: '#ff9f43', roughness: 0.6 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#1b1b22', roughness: 0.3 });

  // ---- 身体 ----
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.46, 22, 16), feather);
  body.position.set(0, 1.35, 0.18);
  body.scale.set(1.18, 1.0, 1.42);
  root.add(body);

  // 尾羽
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 6), featherShade);
  tail.rotation.x = Math.PI / 2 + 0.55;
  tail.position.set(0, 1.4, 0.8);
  root.add(tail);

  // ---- 脖子 ----
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.58, 0.0),
    new THREE.Vector3(0, 1.86, -0.14),
    new THREE.Vector3(0, 1.96, -0.34),
  ]);
  const neck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 10, 0.115, 8, false), feather);
  root.add(neck);

  // ---- 头部（第一人称时要隐藏） ----
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.99, -0.44);
  root.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), feather);
  head.scale.set(1, 0.95, 1.05);
  headGroup.add(head);

  // 上喙
  const beakLen = 0.92;
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.105, beakLen, 8), beakMat);
  beak.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -0.14, -1).normalize()
  );
  beak.position.set(0, -0.03, -0.06 - beakLen * 0.5);
  headGroup.add(beak);

  // 喉囊
  const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), pouchMat);
  pouch.scale.set(0.85, 0.62, 2.35);
  pouch.position.set(0, -0.11, -0.5);
  headGroup.add(pouch);

  // 眼睛
  const eyes = [];
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.043, 10, 8), eyeMat);
    eye.position.set(s * 0.145, 0.05, -0.05);
    headGroup.add(eye);
    eyes.push(eye);
  });

  // ---- 翅膀 ----
  const wings = [];
  [-1, 1].forEach((s) => {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), featherShade);
    wing.scale.set(0.22, 1.0, 2.05);
    wing.position.set(s * 0.52, 1.4, 0.14);
    wing.rotation.z = s * 0.16;
    wing.rotation.y = s * -0.12;
    root.add(wing);
    wings.push({ mesh: wing, side: s });
  });

  // ---- 腿 ----
  const hips = [new THREE.Vector3(-0.19, 1.02, 0.2), new THREE.Vector3(0.19, 1.02, 0.2)];
  const legs = hips.map((hip) => {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 1, 7), legMat);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 1, 7), legMat);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.045, 0.21), legMat);
    root.add(thigh, shin, foot);
    return { hip, thigh, shin, foot };
  });

  const _knee = new THREE.Vector3();
  const _foot = new THREE.Vector3();

  function solveLeg(leg, footWorld, sideSign) {
    const hip = leg.hip;
    const dz = footWorld.z - hip.z;
    const dy = footWorld.y - hip.y;
    let d = Math.hypot(dz, dy);
    const maxD = L1 + L2 - 0.001;
    d = clamp(d, 0.12, maxD);

    const uz = dz / (Math.hypot(dz, dy) || 1);
    const uy = dy / (Math.hypot(dz, dy) || 1);
    const cosA = clamp((d * d + L1 * L1 - L2 * L2) / (2 * d * L1), -1, 1);
    const a = Math.acos(cosA);
    const sinA = Math.sin(a);

    // 膝盖朝前（-Z），在 z-y 平面里解两段 IK
    _knee.set(
      hip.x,
      hip.y + L1 * (cosA * uy + sinA * -uz),
      hip.z + L1 * (cosA * uz + sinA * uy)
    );

    _foot.set(footWorld.x, footWorld.y, footWorld.z);

    orientCylinder(leg.thigh, hip.clone(), _knee.clone());
    orientCylinder(leg.shin, _knee.clone(), _foot.clone());
    leg.foot.position.copy(_foot);
    leg.foot.rotation.x = 0.05;
    leg.foot.rotation.y = sideSign * 0.05;
  }

  const pedalPos = new THREE.Vector3();

  return {
    group: root,
    headGroup,
    /** 第一人称视角时要藏起来的部件 */
    hideInFirstPerson: [head, ...eyes],
    update(dt, ctx) {
      const { pedalPhase, speed, boosting, steer } = ctx;

      // 身体随踩踏轻微起伏
      body.position.y = 1.35 + Math.sin(pedalPhase * 2) * 0.012;
      body.rotation.z = -steer * 0.05;

      // 头随速度前后点动
      headGroup.position.y = 1.99 + Math.sin(pedalPhase * 2) * 0.015;
      headGroup.rotation.x = Math.sin(pedalPhase * 2 + 0.6) * 0.035 + (boosting ? -0.12 : 0);
      headGroup.rotation.z = -steer * 0.08;

      // 翅膀：平时收起，冲刺时张开
      wings.forEach(({ mesh, side }) => {
        const open = boosting ? 0.85 : 0.16;
        mesh.rotation.z = side * open + Math.sin(pedalPhase * 2 + side) * 0.05;
        mesh.rotation.x = boosting ? -0.25 : 0;
      });

      // 双腿踩踏板（bike 内部已按左右相差半圈处理相位）
      legs.forEach((leg, i) => {
        const side = i === 0 ? -1 : 1;
        bike.pedalPosition(side, pedalPhase, pedalPos);
        solveLeg(leg, pedalPos, side);
      });

      void speed;
    },
  };
}
