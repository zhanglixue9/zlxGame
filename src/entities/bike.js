import * as THREE from 'three';
import { orientCylinder } from '../utils.js';

const WHEEL_R = 0.42;

function makeWheel(materials) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R, 0.05, 8, 22), materials.tire);
  tire.rotation.y = Math.PI / 2;
  g.add(tire);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.05, 0.014, 6, 22), materials.metal);
  rim.rotation.y = Math.PI / 2;
  g.add(rim);

  for (let i = 0; i < 8; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, WHEEL_R * 1.88, 4), materials.metal);
    spoke.rotation.x = (i / 8) * Math.PI;
    g.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8), materials.metal);
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  return g;
}

/** 一辆低多边形自行车，车头朝 -Z */
export function createBike() {
  const group = new THREE.Group();

  const materials = {
    frame: new THREE.MeshStandardMaterial({ color: '#ff5f57', roughness: 0.32, metalness: 0.4 }),
    metal: new THREE.MeshStandardMaterial({ color: '#dfe4ea', roughness: 0.22, metalness: 0.85 }),
    tire: new THREE.MeshStandardMaterial({ color: '#1a1a20', roughness: 0.9 }),
    saddle: new THREE.MeshStandardMaterial({ color: '#3a2b27', roughness: 0.8 }),
  };

  const BB = new THREE.Vector3(0, 0.47, 0.04);
  const seatTop = new THREE.Vector3(0, 0.95, 0.3);
  const headTop = new THREE.Vector3(0, 0.92, -0.45);
  const headBottom = new THREE.Vector3(0, 0.62, -0.5);
  const rearAxle = new THREE.Vector3(0, WHEEL_R, 0.62);
  const frontAxle = new THREE.Vector3(0, WHEEL_R, -0.62);

  const tube = (a, b, r, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), mat);
    orientCylinder(m, a.clone(), b.clone());
    group.add(m);
    return m;
  };

  tube(BB, seatTop, 0.035, materials.frame);
  tube(seatTop, headTop, 0.032, materials.frame);
  tube(BB, headBottom, 0.036, materials.frame);
  tube(BB, rearAxle, 0.022, materials.frame);
  tube(seatTop, rearAxle, 0.02, materials.frame);

  // 车把
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.56, 8), materials.metal);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 1.06, -0.5);
  group.add(bar);
  tube(headTop, new THREE.Vector3(0, 1.06, -0.5), 0.028, materials.metal);
  [-0.24, 0.24].forEach((x) => {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), materials.saddle);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(x, 1.06, -0.5);
    group.add(grip);
  });

  // 坐垫
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.07, 0.36), materials.saddle);
  saddle.position.set(0, 0.98, 0.32);
  group.add(saddle);

  // 后轮
  const rearWheel = makeWheel(materials);
  rearWheel.position.copy(rearAxle);
  group.add(rearWheel);

  // 前叉 + 前轮（可随转向偏转）
  const steerGroup = new THREE.Group();
  const forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), materials.metal);
  orientCylinder(forkL, new THREE.Vector3(-0.07, 0.92, -0.45), new THREE.Vector3(-0.07, WHEEL_R, -0.62));
  steerGroup.add(forkL);
  const forkR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), materials.metal);
  orientCylinder(forkR, new THREE.Vector3(0.07, 0.92, -0.45), new THREE.Vector3(0.07, WHEEL_R, -0.62));
  steerGroup.add(forkR);

  const frontWheel = makeWheel(materials);
  frontWheel.position.copy(frontAxle);
  steerGroup.add(frontWheel);
  group.add(steerGroup);

  // 曲柄与脚踏
  const crank = new THREE.Group();
  crank.position.copy(BB);
  const crankArmA = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.05), materials.metal);
  crankArmA.position.set(0.1, 0.09, 0);
  crank.add(crankArmA);
  const crankArmB = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.05), materials.metal);
  crankArmB.position.set(-0.1, -0.09, 0);
  crank.add(crankArmB);

  const pedalGeo = new THREE.BoxGeometry(0.12, 0.03, 0.17);
  const pedalMat = new THREE.MeshStandardMaterial({ color: '#4c4c57', roughness: 0.8 });
  const pedalA = new THREE.Mesh(pedalGeo, pedalMat);
  pedalA.position.set(0.1, 0.17, 0);
  crank.add(pedalA);
  const pedalB = new THREE.Mesh(pedalGeo, pedalMat);
  pedalB.position.set(-0.1, -0.17, 0);
  crank.add(pedalB);
  group.add(crank);

  const crankRadius = 0.17;

  return {
    group,
    steerGroup,
    crankRadius,
    bottomBracket: BB.clone(),
    update(dt, ctx) {
      rearWheel.rotation.x -= ctx.wheelSpin;
      frontWheel.rotation.x -= ctx.wheelSpin;
      crank.rotation.x = ctx.pedalPhase;
      const steerAngle = Math.max(-0.4, Math.min(0.4, ctx.steer * 0.32));
      steerGroup.rotation.y = -steerAngle;
    },
    /** 脚踏在世界局部坐标（相对车型根节点）里的位置 */
    pedalPosition(side, phase, out) {
      const sign = side < 0 ? -1 : 1;
      const p = phase + (sign > 0 ? 0 : Math.PI);
      out.set(sign * 0.1, BB.y + Math.cos(p) * crankRadius, BB.z + Math.sin(p) * crankRadius);
      return out;
    },
  };
}
