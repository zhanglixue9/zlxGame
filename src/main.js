import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import { clamp, damp, lerp } from './utils.js';
import { createSky } from './render/sky.js';
import { createOcean } from './render/ocean.js';
import { createRoad } from './render/road.js';
import { createScenery } from './render/scenery.js';
import { Player } from './entities/player.js';
import { Input } from './systems/input.js';
import { CameraRig } from './systems/camera.js';
import { Spawner } from './systems/spawner.js';
import { Sfx } from './systems/audio.js';
import { HUD } from './ui/hud.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

let dpr = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(dpr);
renderer.setSize(window.innerWidth, window.innerHeight, false);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PALETTE.fog, 95, 430);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 1500);

// ---------- 场景 ----------
const sunDir = new THREE.Vector3(-0.62, 0.2, -0.76).normalize();

const sky = createSky(sunDir);
scene.add(sky.mesh);

const ocean = createOcean(sunDir);
scene.add(ocean.mesh);

const road = createRoad();
scene.add(road.group);

const scenery = createScenery();
scene.add(scenery.group);

const hemi = new THREE.HemisphereLight('#ffd2b4', '#33333f', 1.25);
scene.add(hemi);

const sunLight = new THREE.DirectionalLight('#ffd9a6', 2.0);
sunLight.position.copy(sunDir).multiplyScalar(60);
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight('#9dc0ff', 0.5);
fillLight.position.set(24, 18, 20);
scene.add(fillLight);

// ---------- 玩家与系统 ----------
const player = new Player(scene);
const rig = new CameraRig(camera, player);
const spawner = new Spawner(scene);
const sfx = new Sfx();
const hud = new HUD();

const BEST_KEY = 'pelican-bike-best';

const state = {
  mode: 'menu', // menu | playing | paused
  distance: 0,
  speed: CONFIG.player.startSpeed,
  energy: CONFIG.energy.start,
  coins: 0,
  bonus: 0, // 撞碎障碍累计奖励分
  health: CONFIG.health.max,
  slowTimer: 0,
  invuln: 0,
  boosting: false,
  best: Number(localStorage.getItem(BEST_KEY) || 0) || 0,
  savedAt: 0,
};

const score = () =>
  Math.floor(state.distance / CONFIG.score.distanceDivisor + state.coins * CONFIG.score.coin + state.bonus);

function saveBest() {
  try {
    localStorage.setItem(BEST_KEY, String(state.best));
  } catch (e) {
    /* 隐私模式下忽略 */
  }
}

function startRun() {
  state.distance = 0;
  state.coins = 0;
  state.bonus = 0;
  state.health = CONFIG.health.max;
  state.speed = CONFIG.player.startSpeed;
  state.energy = CONFIG.energy.start;
  state.slowTimer = 0;
  state.invuln = 0;
  state.boosting = false;
  spawner.reset();
  player.reset();
  hud.hide();
  hud.setHealth(state.health, CONFIG.health.max);
  state.mode = 'playing';
  sfx.resume();
}

function endRun() {
  state.mode = 'over';
  saveBest();
  hud.showGameOver(score(), state.coins, state.best);
  rig.shake(0.5);
}

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    hud.showPause(score(), state.coins);
    saveBest();
  } else if (state.mode === 'paused') {
    state.mode = 'playing';
    hud.hide();
    sfx.resume();
  } else {
    startRun();
  }
}

// ---------- 输入 ----------
const input = new Input(canvas, {
  onCamera: () => {
    const mode = rig.toggle();
    hud.setCameraLabel(mode);
  },
  onOrbit: (dx, dy) => rig.orbit(dx, dy),
  onZoom: (delta) => rig.zoom(delta),
  onOrbitStart: () => {},
  onJump: () => {
    if (state.mode === 'playing') {
      if (player.jump()) sfx.jump();
    } else if (state.mode === 'menu' || state.mode === 'over') {
      startRun();
    }
  },
  onPause: togglePause,
  onRestart: () => startRun(),
  onMute: () => {
    const muted = sfx.toggleMute();
    hud.toast(muted ? '音效已关闭' : '音效已开启');
  },
});

document.getElementById('btn-camera').addEventListener('click', () => {
  const mode = rig.toggle();
  hud.setCameraLabel(mode);
});
document.getElementById('btn-pause').addEventListener('click', togglePause);
hud.onPrimary(() => {
  if (state.mode === 'over') startRun();
  else togglePause();
});

window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 120));

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  hud.toggleRotateHint(h > w && window.matchMedia('(pointer: coarse)').matches && w < 900);
}

// ---------- 主循环 ----------
let lastT = performance.now();
let fpsAvg = 60;
let dprDropped = false;
let booted = false;

function tick(now) {
  requestAnimationFrame(tick);
  const dtRaw = (now - lastT) / 1000;
  lastT = now;
  const dt = clamp(dtRaw, 0.0005, 0.05);

  // 帧率自适应：持续偏低就降一档分辨率
  if (dtRaw > 0) {
    fpsAvg = fpsAvg * 0.94 + (1 / dtRaw) * 0.06;
    if (!dprDropped && fpsAvg < 45 && now > 4000) {
      dprDropped = true;
      dpr = 1;
      renderer.setPixelRatio(dpr);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    }
  }

  input.update(dt);

  if (state.mode === 'menu') {
    // 菜单里让海岸线慢慢流动，画面不是死的
    const idle = 7;
    const delta = idle * dt;
    scenery.update(delta);
    road.update(dt, delta);
    player.update(dt, { steer: 0, speed: idle, boosting: false });
  } else if (state.mode === 'playing') {
    state.invuln = Math.max(0, state.invuln - dt);
    state.slowTimer = Math.max(0, state.slowTimer - dt);

    const P = CONFIG.player;
    const base = lerp(P.startSpeed, P.maxSpeed, clamp(state.distance / P.rampDistance, 0, 1));
    const wantBoost = input.boostHeld && state.energy > 0.5;
    state.boosting = wantBoost;

    if (wantBoost) {
      state.energy = Math.max(0, state.energy - CONFIG.energy.drain * dt);
    } else if (state.energy < CONFIG.energy.max) {
      state.energy = Math.min(CONFIG.energy.max, state.energy + 1.8 * dt);
    }

    const targetSpeed =
      base * (state.boosting ? P.boostMul : 1) * (state.slowTimer > 0 ? P.hitMul : 1);
    state.speed = damp(state.speed, targetSpeed, state.slowTimer > 0 ? 14 : 3.4, dt);

    const delta = state.speed * dt;
    state.distance += delta;

    player.update(dt, {
      steer: input.steer,
      speed: state.speed,
      boosting: state.boosting,
      playing: true,
    });

    spawner.update(dt, {
      delta,
      playerX: player.x,
      playerHeight: player.height,
      boosting: state.boosting,
      distance: state.distance,
      onCoin: () => {
        state.coins += 1;
        state.energy = Math.min(CONFIG.energy.max, state.energy + CONFIG.energy.gain);
        sfx.coin();
      },
      onPotion: () => {
        if (state.health < CONFIG.health.max) {
          state.health += 1;
          hud.setHealth(state.health, CONFIG.health.max);
          hud.toast('+1 生命');
        } else {
          state.bonus += 10;
          hud.toast('生命已满 +10');
        }
        sfx.heal();
      },
      // 冲刺撞碎：加分、不扣血
      onSmash: () => {
        state.bonus += CONFIG.score.smash;
        rig.shake(0.16);
        sfx.smash();
      },
      onHit: () => {
        if (state.invuln > 0) return;
        state.slowTimer = 0.85;
        state.invuln = CONFIG.hit.invuln;
        state.speed *= 0.72;
        state.health -= 1;
        hud.setHealth(Math.max(0, state.health), CONFIG.health.max);
        rig.shake(CONFIG.hit.shake);
        hud.flashHit();
        sfx.hit();
        if (state.health <= 0) endRun();
      },
    });

    scenery.update(delta);
    road.update(dt, delta);

    const s = score();
    if (s > state.best) {
      state.best = s;
      if (now - state.savedAt > 1500) {
        state.savedAt = now;
        saveBest();
      }
    }
  }

  sky.update(dt);
  ocean.update(dt);
  rig.update(dt, { boosting: state.boosting });

  hud.setScore(score(), state.best);
  hud.setHealth(state.health, CONFIG.health.max);
  hud.setEnergy(state.energy, state.boosting);
  hud.setSpeed(state.speed * 3.6);

  renderer.render(scene, camera);

  if (!booted) {
    booted = true;
    const boot = document.getElementById('boot');
    if (boot) {
      boot.classList.add('gone');
      setTimeout(() => boot.remove(), 600);
    }
  }
}

// 调试/自动化测试钩子
window.__pelican = { state, player, rig, spawner, CONFIG };

// ---------- 启动 ----------
const params = new URLSearchParams(location.search);
hud.setCameraLabel(rig.mode);
hud.showMenu();
hud.setScore(0, state.best);
onResize();
requestAnimationFrame(tick);

// 开发用快捷参数：?auto=1 直接开局，?view=fps 第一人称，?near=1 道具刷近
if (params.get('near') === '1') {
  CONFIG.spawn.coinAhead = 55;
  CONFIG.spawn.obstacleAhead = 65;
  spawner.coinTimer = 0;
  spawner.obstacleTimer = 10;
}

// 开发用快捷参数：?auto=1 直接开局，?view=fps 直接第一人称
if (params.get('view') === 'fps') {
  rig.toggle();
  hud.setCameraLabel(rig.mode);
}
if (params.get('auto') === '1') startRun();

// 后台自动暂停 / 离开前存分
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveBest();
    if (state.mode === 'playing') {
      state.mode = 'paused';
      hud.showPause(score(), state.coins);
    }
  }
});
window.addEventListener('pagehide', saveBest);
window.addEventListener('beforeunload', saveBest);

// iOS 首次手势解锁音频
const unlock = () => {
  sfx.resume();
  window.removeEventListener('pointerdown', unlock);
};
window.addEventListener('pointerdown', unlock, { once: true });
