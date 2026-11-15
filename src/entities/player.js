import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createBike } from './bike.js';
import { createPelican } from './pelican.js';
import { clamp, damp, radialTexture } from '../utils.js';

export class Player {
  constructor(scene) {
    this.root = new THREE.Group();
    this.bike = createBike();
    this.pelican = createPelican(this.bike);
    this.root.add(this.bike.group, this.pelican.group);
    this.root.scale.setScalar(CONFIG.player.scale);
    scene.add(this.root);

    // 贴地假阴影
    const shadowMat = new THREE.MeshBasicMaterial({
      map: radialTexture(128, [
        [0, 'rgba(0,0,0,0.5)'],
        [0.55, 'rgba(0,0,0,0.22)'],
        [1, 'rgba(0,0,0,0)'],
      ]),
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    scene.add(this.shadow);

    this.x = 0;
    this.vx = 0;
    this.lean = 0;
    this.pedalPhase = 0;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.firstPerson = false;
    this.hideList = this.pelican.hideInFirstPerson;
  }

  reset() {
    this.x = 0;
    this.vx = 0;
    this.lean = 0;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.root.position.set(0, 0, 0);
    this.root.rotation.z = 0;
    this.root.rotation.x = 0;
  }

  /** 起跳 */
  jump() {
    if (!this.grounded) return false;
    this.vy = CONFIG.jump.velocity;
    this.grounded = false;
    return true;
  }

  /** 当前离地高度，用于判定能否越过障碍 */
  get height() {
    return this.y;
  }

  update(dt, ctx) {
    const { steer, speed, boosting, playing } = ctx;
    const P = CONFIG.player;

    // 跳跃：垂直速度积分
    if (!this.grounded || this.vy !== 0) {
      this.vy -= CONFIG.jump.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
        this.landPulse = 0.12;
      }
    }
    this.root.position.y = this.y;

    // 横向：带阻尼的速度控制，松开后慢慢回正
    const targetVx = steer * P.lateralMax;
    this.vx = damp(this.vx, targetVx, steer !== 0 ? 13 : 8.5, dt);
    this.x += this.vx * dt;

    const limit = CONFIG.road.limit;
    if (this.x > limit) {
      this.x = limit;
      this.vx = Math.min(this.vx, 0);
    } else if (this.x < -limit) {
      this.x = -limit;
      this.vx = Math.max(this.vx, 0);
    }

    this.root.position.x = this.x;

    // 侧倾 + 轻微转向
    this.lean = damp(this.lean, -this.vx * 0.024, 9, dt);
    this.root.rotation.z = this.lean;
    this.root.rotation.y = -this.vx * 0.012;

    // 空中姿态：起跳抬头、下落低头
    const airTilt = this.grounded ? 0 : clamp(-this.vy * 0.028, -0.22, 0.2);
    this.root.rotation.x = damp(this.root.rotation.x, airTilt, 12, dt);

    // 踩踏与车轮
    this.pedalPhase += speed * 0.72 * dt;
    this.bike.update(dt, {
      wheelSpin: (speed * dt) / 0.42,
      pedalPhase: this.pedalPhase,
      steer: this.vx / P.lateralMax,
    });
    this.pelican.update(dt, {
      pedalPhase: this.pedalPhase,
      speed,
      boosting,
      steer: this.vx / P.lateralMax,
    });

    // 影子跟着玩家横向移动，跳起时变小变淡
    this.shadow.position.x = this.x;
    this.shadow.rotation.z = this.lean * 0.5;
    const shrink = clamp(1 - this.y * 0.22, 0.55, 1);
    this.shadow.scale.setScalar(shrink);
    this.shadow.material.opacity = 0.85 * clamp(1 - this.y * 0.35, 0.25, 1);
    void playing;
  }

  setFirstPerson(on) {
    this.firstPerson = on;
    this.hideList.forEach((m) => (m.visible = !on));
  }

  /** 第一人称视点（鹈鹕眼睛位置） */
  getFirstPersonPoint(out) {
    return this.root.localToWorld(out.set(0, 2.16, -0.74));
  }

  getFirstPersonTarget(out) {
    return this.root.localToWorld(out.set(this.vx * 0.035, 1.58, -8));
  }

  getHeadPosition(out) {
    return this.pelican.headGroup.getWorldPosition(out);
  }
}
