import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createCoinMesh } from '../entities/coin.js';
import { createPotionMesh } from '../entities/potion.js';
import { createObstacleMesh, OBSTACLE_KINDS } from '../entities/obstacle.js';
import { clamp, lerp, pick, rand } from '../utils.js';

const LANES = [-2.8, 0, 2.8];
const COIN_Y = 0.86;
const POTION_Y = 0.95;

/** 金币 / 血瓶 / 障碍的生成、回收、碰撞，以及撞碎时的碎块粒子 */
export class Spawner {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.coins = [];
    this.potions = [];
    this.obstacles = [];
    this.debris = [];

    this.coinTimer = 0;
    this.obstacleTimer = 8;
    this.potionTimer = 0;
    this.time = 0;

    // 碎块共用几何 / 材质
    this.debrisGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    this.debrisMat = new THREE.MeshStandardMaterial({ color: '#b9a68e', roughness: 0.9, flatShading: true });
    for (let i = 0; i < 48; i++) {
      const mesh = new THREE.Mesh(this.debrisGeo, this.debrisMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.debris.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 1 });
    }
  }

  reset() {
    this.coins.forEach((c) => {
      c.active = false;
      c.dying = 0;
      c.mesh.visible = false;
      c.mesh.scale.setScalar(1);
    });
    this.potions.forEach((p) => {
      p.active = false;
      p.mesh.visible = false;
    });
    this.obstacles.forEach((o) => {
      o.active = false;
      o.dying = 0;
      o.mesh.visible = false;
      o.mesh.scale.setScalar(1);
      o.mesh.rotation.set(0, 0, 0);
      o.mesh.position.y = 0;
    });
    this.debris.forEach((d) => {
      d.life = 0;
      d.mesh.visible = false;
    });
    this.coinTimer = 0;
    this.obstacleTimer = 7;
    this.potionTimer = 26;
  }

  takeCoinMesh() {
    const free = this.coins.find((c) => !c.active && c.dying <= 0);
    if (free) {
      free.active = true;
      free.mesh.visible = true;
      free.mesh.scale.setScalar(1);
      return free;
    }
    const mesh = createCoinMesh();
    this.group.add(mesh);
    const item = { mesh, active: true, dying: 0, phase: rand(0, 6.28), x: 0, z: 0 };
    this.coins.push(item);
    return item;
  }

  takePotionMesh() {
    const free = this.potions.find((p) => !p.active);
    if (free) {
      free.active = true;
      free.mesh.visible = true;
      return free;
    }
    const mesh = createPotionMesh();
    this.group.add(mesh);
    const item = { mesh, active: true, phase: rand(0, 6.28), x: 0, z: 0 };
    this.potions.push(item);
    return item;
  }

  takeObstacleMesh(kind) {
    const free = this.obstacles.find((o) => !o.active && o.dying <= 0 && o.kind === kind);
    if (free) {
      free.active = true;
      free.mesh.visible = true;
      free.mesh.scale.setScalar(1);
      return free;
    }
    const mesh = createObstacleMesh(kind);
    this.group.add(mesh);
    const item = { mesh, active: true, kind, dying: 0, x: 0, z: 0 };
    this.obstacles.push(item);
    return item;
  }

  spawnCoin(x, z) {
    const c = this.takeCoinMesh();
    c.x = x;
    c.z = z;
    c.mesh.position.set(x, COIN_Y, z);
    c.mesh.rotation.set(0, 0, 0);
  }

  spawnPattern(z) {
    const r = Math.random();
    const lane = pick(LANES);

    if (r < 0.45) {
      for (let i = 0; i < 5; i++) this.spawnCoin(lane, z - i * 3.2);
    } else if (r < 0.78) {
      for (let i = 0; i < 7; i++) {
        const x = clamp(lane + Math.sin(i * 0.95) * 2.6, -3.9, 3.9);
        this.spawnCoin(x, z - i * 3.0);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        this.spawnCoin(-2.8, z - i * 3.4);
        this.spawnCoin(2.8, z - i * 3.4);
      }
    }
  }

  spawnObstacle(z, difficulty) {
    const count = difficulty > 0.55 && Math.random() < 0.35 ? 2 : 1;
    const lanes = [...LANES].sort(() => Math.random() - 0.5).slice(0, count);
    lanes.forEach((x) => {
      const kind = pick(OBSTACLE_KINDS);
      const o = this.takeObstacleMesh(kind);
      o.x = x + rand(-0.25, 0.25);
      o.z = z;
      o.mesh.position.set(o.x, 0, z);
      o.mesh.rotation.y = rand(0, Math.PI * 2);
    });
  }

  spawnPotion(z) {
    const p = this.takePotionMesh();
    p.x = pick(LANES) + rand(-0.4, 0.4);
    p.z = z;
    p.mesh.position.set(p.x, POTION_Y, z);
  }

  /** 撞碎时的碎块 */
  burst(x, y, z, count = 8) {
    let spawned = 0;
    for (let i = 0; i < this.debris.length && spawned < count; i++) {
      const d = this.debris[i];
      if (d.life > 0) continue;
      d.life = rand(0.45, 0.8);
      d.maxLife = d.life;
      d.mesh.visible = true;
      d.mesh.position.set(x + rand(-0.3, 0.3), y + rand(0.1, 0.6), z + rand(-0.3, 0.3));
      d.mesh.scale.setScalar(rand(0.6, 1.5));
      d.mesh.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      d.vel.set(rand(-3.2, 3.2), rand(2.5, 6.5), rand(-1.5, 4.5));
      spawned++;
    }
  }

  update(dt, ctx) {
    const {
      delta,
      playerX,
      playerHeight = 0,
      boosting = false,
      distance,
      onCoin,
      onPotion,
      onHit,
      onSmash,
    } = ctx;
    this.time += dt;
    const difficulty = clamp(distance / 2200, 0, 1);

    // ---- 生成 ----
    this.coinTimer -= delta;
    if (this.coinTimer <= 0) {
      this.spawnPattern(-CONFIG.spawn.coinAhead);
      this.coinTimer = lerp(CONFIG.spawn.coinGap[1], CONFIG.spawn.coinGap[0], difficulty) + rand(-2, 4);
    }

    this.obstacleTimer -= delta;
    if (this.obstacleTimer <= 0) {
      this.spawnObstacle(-CONFIG.spawn.obstacleAhead, difficulty);
      this.obstacleTimer =
        lerp(CONFIG.spawn.obstacleGap[1], CONFIG.spawn.obstacleGap[0], difficulty) + rand(-3, 6);
    }

    this.potionTimer -= delta;
    if (this.potionTimer <= 0) {
      this.spawnPotion(-CONFIG.spawn.potionAhead);
      this.potionTimer = rand(CONFIG.spawn.potionGap[0], CONFIG.spawn.potionGap[1]);
    }

    // ---- 金币 ----
    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      if (!c.active && c.dying <= 0) continue;

      if (c.active) {
        c.mesh.position.z += delta;
        c.z = c.mesh.position.z;
        c.mesh.position.y = COIN_Y + Math.sin(this.time * 2.6 + c.phase) * 0.07;
        c.mesh.rotation.y = this.time * 2.4 + c.phase;

        if (Math.abs(c.z) < 1.15 && Math.abs(c.x - playerX) < 1.35) {
          c.active = false;
          c.dying = 0.001;
          onCoin?.(c.x, c.z);
        } else if (c.z > 14) {
          c.active = false;
          c.mesh.visible = false;
        }
      } else if (c.dying > 0) {
        c.dying += dt;
        const t = Math.min(1, c.dying / 0.32);
        c.mesh.position.y = COIN_Y + t * 1.1;
        c.mesh.rotation.y += dt * 14;
        c.mesh.scale.setScalar(1 - t * 0.9);
        if (t >= 1) {
          c.dying = 0;
          c.mesh.visible = false;
          c.mesh.scale.setScalar(1);
        }
      }
    }

    // ---- 血瓶 ----
    for (let i = 0; i < this.potions.length; i++) {
      const p = this.potions[i];
      if (!p.active) continue;
      p.mesh.position.z += delta;
      p.z = p.mesh.position.z;
      p.mesh.position.y = POTION_Y + Math.sin(this.time * 2.2 + p.phase) * 0.12;
      p.mesh.rotation.y = this.time * 1.6 + p.phase;
      const halo = p.mesh.userData.halo;
      if (halo) halo.scale.setScalar(1.7 + Math.sin(this.time * 3 + p.phase) * 0.18);

      if (Math.abs(p.z) < 1.3 && Math.abs(p.x - playerX) < 1.4) {
        p.active = false;
        p.mesh.visible = false;
        onPotion?.(p.x, p.z);
      } else if (p.z > 14) {
        p.active = false;
        p.mesh.visible = false;
      }
    }

    // ---- 障碍 ----
    for (let i = 0; i < this.obstacles.length; i++) {
      const o = this.obstacles[i];
      if (!o.active && o.dying <= 0) continue;

      if (o.active) {
        o.mesh.position.z += delta;
        o.z = o.mesh.position.z;
        if (o.mesh.userData.animate) o.mesh.userData.animate(this.time);

        const clear = o.mesh.userData.clearHeight ?? 0.8;
        const passed = playerHeight > clear; // 跳得够高就越过

        if (!passed && Math.abs(o.z) < 1.25 && Math.abs(o.x - playerX) < 1.12) {
          o.active = false;
          o.dying = 0.001;
          if (boosting) {
            // 冲刺撞碎：碎裂 + 加分，不扣血
            this.burst(o.x, 0.5, o.z, 9);
            onSmash?.(o);
          } else {
            this.burst(o.x, 0.4, o.z, 4);
            onHit?.(o);
          }
        } else if (o.z > 16) {
          o.active = false;
          o.mesh.visible = false;
        }
      } else if (o.dying > 0) {
        o.dying += dt;
        const t = Math.min(1, o.dying / 0.3);
        o.mesh.position.z += dt * 6;
        o.mesh.position.y = t * 0.9;
        o.mesh.rotation.z += dt * 5;
        o.mesh.scale.setScalar(Math.max(0.001, 1 - t));
        if (t >= 1) {
          o.dying = 0;
          o.mesh.visible = false;
          o.mesh.scale.setScalar(1);
          o.mesh.position.y = 0;
          o.mesh.rotation.set(0, o.mesh.rotation.y, 0);
        }
      }
    }

    // ---- 碎块 ----
    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.mesh.visible = false;
        continue;
      }
      d.vel.y -= 16 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.position.z += delta;
      d.mesh.rotation.x += dt * 7;
      d.mesh.rotation.y += dt * 5;
      if (d.mesh.position.y < 0.06) {
        d.vel.y *= -0.35;
        d.vel.x *= 0.6;
        d.mesh.position.y = 0.06;
      }
      d.mesh.scale.setScalar(Math.max(0.001, (d.life / d.maxLife) * 1.2));
    }
  }
}
