import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, damp, lerp } from '../utils.js';

const C = CONFIG.camera;

export class CameraRig {
  constructor(camera, player) {
    this.camera = camera;
    this.player = player;
    this.mode = 0; // 0 = 追尾, 1 = 第一人称
    this.blend = 0;
    this.shakeAmount = 0;
    this.boostVisual = 0;
    this.fov = 68;

    // 环绕视角参数
    this.yaw = 0;
    this.pitch = C.startPitch;
    this.dist = C.startDist;

    // 第一人称环视
    this.fpsYaw = 0;
    this.fpsPitch = 0;
    this.fpsFov = 78;

    this.lastOrbitAt = -999;

    this._chasePos = new THREE.Vector3();
    this._chaseLook = new THREE.Vector3();
    this._fpsPos = new THREE.Vector3();
    this._fpsLook = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  toggle() {
    this.mode = this.mode === 0 ? 1 : 0;
    this.fpsYaw = 0;
    this.fpsPitch = 0;
    return this.mode;
  }

  /** 拖拽旋转（dx/dy 已换算成弧度） */
  orbit(dx, dy) {
    this.lastOrbitAt = performance.now();
    if (this.mode === 0) {
      this.yaw -= dx;
      this.pitch = clamp(this.pitch + dy, C.minPitch, C.maxPitch);
    } else {
      this.fpsYaw = clamp(this.fpsYaw - dx * 1.15, -1.1, 1.1);
      this.fpsPitch = clamp(this.fpsPitch - dy * 1.15, -0.62, 0.62);
    }
  }

  /** 滚轮 / 捏合缩放 */
  zoom(delta) {
    this.lastOrbitAt = performance.now();
    if (this.mode === 0) {
      this.dist = clamp(this.dist + delta * 0.012, C.minDist, C.maxDist);
    } else {
      this.fpsFov = clamp(this.fpsFov + delta * 0.03, C.minFov, C.maxFov);
    }
  }

  /** 重置到这个模式的标准机位 */
  resetView() {
    this.yaw = 0;
    this.pitch = C.startPitch;
    this.dist = C.startDist;
    this.fpsYaw = 0;
    this.fpsPitch = 0;
    this.fpsFov = 78;
  }

  shake(amount) {
    this.shakeAmount = Math.min(1, this.shakeAmount + amount);
  }

  update(dt, ctx) {
    const { boosting } = ctx;
    const p = this.player;
    const now = performance.now();

    // 一段时间没碰拖拽，缓慢回正到默认机位
    if (now - this.lastOrbitAt > C.recenterDelay * 1000) {
      if (this.mode === 0) {
        this.yaw = damp(this.yaw, 0, 1.1, dt);
        this.pitch = damp(this.pitch, C.startPitch, 1.1, dt);
      } else {
        this.fpsYaw = damp(this.fpsYaw, 0, 1.6, dt);
        this.fpsPitch = damp(this.fpsPitch, 0, 1.6, dt);
      }
    }

    this.blend = damp(this.blend, this.mode, 4.2, dt);
    this.boostVisual = damp(this.boostVisual, boosting ? 1 : 0, 5, dt);
    this.shakeAmount = damp(this.shakeAmount, 0, 4.5, dt);

    // ---- 追尾机位：绕玩家球面环绕 ----
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    this._chasePos.set(
      p.x * 0.55 + Math.sin(this.yaw) * cp * this.dist,
      1.3 + sp * this.dist,
      Math.cos(this.yaw) * cp * this.dist
    );
    this._chasePos.y = Math.max(this._chasePos.y, 0.45); // 别钻到路面下
    this._chaseLook.set(p.x * 0.75, 1.3, -2.4);

    // ---- 第一人称：头部 + 环视 ----
    p.getFirstPersonPoint(this._fpsPos);
    const cy = Math.cos(this.fpsPitch);
    this._dir.set(Math.sin(this.fpsYaw) * cy, Math.sin(this.fpsPitch), -Math.cos(this.fpsYaw) * cy);
    this._fpsLook.copy(this._fpsPos).addScaledVector(this._dir, 10);

    this._pos.lerpVectors(this._chasePos, this._fpsPos, this.blend);
    this._look.lerpVectors(this._chaseLook, this._fpsLook, this.blend);

    // 撞击抖动
    if (this.shakeAmount > 0.001) {
      const s = this.shakeAmount * 0.42;
      this._pos.x += (Math.random() - 0.5) * s;
      this._pos.y += (Math.random() - 0.5) * s * 0.7;
      this._look.x += (Math.random() - 0.5) * s * 0.5;
    }

    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);

    // 冲刺时轻微侧滚
    const roll = -p.vx * 0.004 - this.boostVisual * 0.012 * Math.sin(performance.now() * 0.02);
    this.camera.rotateZ(roll);

    const baseFov = lerp(68, this.fpsFov, this.blend);
    const targetFov = baseFov + this.boostVisual * 9;
    this.fov = damp(this.fov, targetFov, 5, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    // 过渡到第一人称后再藏头，避免切换瞬间穿帮
    p.setFirstPerson(this.blend > 0.55);
  }
}
