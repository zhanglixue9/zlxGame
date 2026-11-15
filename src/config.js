// 所有可调手感参数集中在这里，方便一处微调
export const CONFIG = {
  road: {
    width: 11, // 路面宽度
    limit: 4.25, // 玩家左右可活动边界
    tileLength: 11.5, // 路面贴图一个循环对应的世界长度
    length: 520, // 路面几何体长度
  },
  player: {
    startSpeed: 17, // m/s
    maxSpeed: 33,
    rampDistance: 2600, // 跑这么远之后到达最高基础速度
    boostMul: 1.72,
    hitMul: 0.48,
    lateralMax: 11.5,
    lateralAccel: 62,
    lateralReturn: 7,
    scale: 1.25,
  },
  energy: {
    max: 100,
    start: 45,
    drain: 32, // 每秒消耗
    gain: 7, // 每枚金币
  },
  score: {
    coin: 10,
    distanceDivisor: 10,
    smash: 30, // 冲刺撞碎障碍的奖励分
  },
  health: {
    max: 3,
    respawnInvuln: 1.6,
  },
  jump: {
    velocity: 6.9,
    gravity: 19.5,
  },
  camera: {
    startDist: 7,
    minDist: 3.2,
    maxDist: 16,
    startPitch: 0.26,
    minPitch: -0.06,
    maxPitch: 1.15,
    recenterDelay: 3.5, // 停止拖拽多久后视角缓慢回正
    minFov: 55,
    maxFov: 100,
  },
  spawn: {
    coinAhead: 185,
    obstacleAhead: 195,
    coinGap: [15, 26],
    obstacleGap: [26, 46],
    potionAhead: 190,
    potionGap: [62, 104],
  },
  hit: {
    invuln: 1.05,
    shake: 0.6,
  },
};

export const PALETTE = {
  skyTop: '#1b3358',
  skyMid: '#7d6ca6',
  skyHorizon: '#ffb384',
  sun: '#fff2cc',
  fog: '#f0a074',
  oceanDeep: '#0d2f46',
  oceanShallow: '#2c8290',
  road: '#2b2c33',
  line: '#f4ead2',
};
