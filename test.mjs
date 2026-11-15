import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = 'file:///' + path.join(__dirname, 'dist/pelican-bike.html').replace(/\\/g, '/');
const results = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

/** 冻结随机刷怪，只保留测试自己放的道具 */
const isolate = () =>
  page.evaluate(() => {
    const g = window.__pelican;
    g.spawner.coinTimer = 99999;
    g.spawner.obstacleTimer = 99999;
    g.spawner.potionTimer = 99999;
    g.spawner.obstacles.forEach((o) => {
      o.active = false;
      o.mesh.visible = false;
    });
    g.state.invuln = 0;
    g.player.y = 0;
  });

// 1. 基础前进 + 移动
await page.goto(file + '?auto=1&near=1');
await page.waitForTimeout(2000);
const d1 = await page.evaluate(() => window.__pelican.state.distance);
check('自动前进', d1 > 1, `distance=${d1.toFixed(1)}`);

await page.keyboard.down('ArrowRight');
await page.waitForTimeout(600);
await page.keyboard.up('ArrowRight');
const xRight = await page.evaluate(() => window.__pelican.player.x);
check('右移生效', xRight > 0.4, `x=${xRight.toFixed(2)}`);

// 2. 跳跃
await page.keyboard.press('Space');
await page.waitForTimeout(250);
const yMid = await page.evaluate(() => window.__pelican.player.y);
await page.waitForTimeout(1400);
const yEnd = await page.evaluate(() => window.__pelican.player.y);
check('空格跳跃抬升', yMid > 0.4, `y=${yMid.toFixed(2)}`);
check('跳跃后落地', Math.abs(yEnd) < 0.01, `y=${yEnd.toFixed(3)}`);

// 3. 跳过障碍不掉血
await isolate();
const overRock = await page.evaluate(async () => {
  const g = window.__pelican;
  const h0 = g.state.health;
  g.spawner.spawnObstacle(-6, 0);
  const o = g.spawner.obstacles.find((x) => x.active && Math.abs(x.mesh.position.z + 6) < 0.01);
  o.mesh.position.set(g.player.x, 0, -6);
  o.x = g.player.x;
  o.z = -6;
  g.player.jump();
  await new Promise((r) => setTimeout(r, 1800));
  return { h0, h1: g.state.health };
});
check('跳过障碍不掉血', overRock.h1 === overRock.h0, `血量 ${overRock.h0}→${overRock.h1}`);

// 4. 冲刺撞碎障碍：加分、不扣血（用真实 Shift 键触发）
await isolate();
await page.keyboard.down('ShiftLeft');
const smash = await page.evaluate(async () => {
  const g = window.__pelican;
  const h0 = g.state.health;
  const bonus0 = g.state.bonus;
  g.state.energy = 100;
  g.spawner.spawnObstacle(-6, 0);
  const o = g.spawner.obstacles.find((x) => x.active && Math.abs(x.mesh.position.z + 6) < 0.01);
  o.mesh.position.set(g.player.x, 0, -6);
  o.x = g.player.x;
  o.z = -6;
  await new Promise((r) => setTimeout(r, 2400));
  return { h0, h1: g.state.health, bonus0, bonus1: g.state.bonus, boosting: g.state.boosting };
});
await page.keyboard.up('ShiftLeft');
check(
  '冲刺撞碎加分不扣血',
  smash.boosting && smash.h1 === smash.h0 && smash.bonus1 >= smash.bonus0 + 30,
  `boosting=${smash.boosting} 血量 ${smash.h0}→${smash.h1} 奖励 ${smash.bonus0}→${smash.bonus1}`
);

// 5. 普通撞击：掉一格血
await isolate();
const hit = await page.evaluate(async () => {
  const g = window.__pelican;
  const h0 = g.state.health;
  g.spawner.spawnObstacle(-6, 0);
  const o = g.spawner.obstacles.find((x) => x.active && Math.abs(x.mesh.position.z + 6) < 0.01);
  o.mesh.position.set(g.player.x, 0, -6);
  o.x = g.player.x;
  o.z = -6;
  await new Promise((r) => setTimeout(r, 2200));
  return { h0, h1: g.state.health };
});
check('普通撞击掉血', hit.h1 === hit.h0 - 1, `血量 ${hit.h0}→${hit.h1}`);

// 6. 血瓶回血
await isolate();
const potion = await page.evaluate(async () => {
  const g = window.__pelican;
  g.state.health = 2;
  const h0 = g.state.health;
  g.spawner.spawnPotion(-5);
  const p = g.spawner.potions.find((x) => x.active && Math.abs(x.mesh.position.z + 5) < 0.01);
  p.x = g.player.x;
  p.mesh.position.set(g.player.x, 0.95, -5);
  await new Promise((r) => setTimeout(r, 1800));
  return { h0, h1: g.state.health };
});
check('捡血瓶回血（2→3）', potion.h1 === 3 && potion.h0 === 2, `血量 ${potion.h0}→${potion.h1}`);

// 7. 血量归零 → 结束对局
await isolate();
const over = await page.evaluate(async () => {
  const g = window.__pelican;
  g.state.health = 1;
  g.spawner.spawnObstacle(-5, 0);
  const o = g.spawner.obstacles.find((x) => x.active && Math.abs(x.mesh.position.z + 5) < 0.01);
  o.mesh.position.set(g.player.x, 0, -5);
  o.x = g.player.x;
  o.z = -5;
  await new Promise((r) => setTimeout(r, 2000));
  return { mode: g.state.mode, health: g.state.health };
});
check('血量归零结束对局', over.mode === 'over' && over.health <= 0, `mode=${over.mode}`);

// 8. 相机：鼠标拖拽旋转 + 滚轮缩放
await page.goto(file + '?auto=1');
await page.waitForTimeout(1200);
const cam0 = await page.evaluate(() => ({ yaw: window.__pelican.rig.yaw, dist: window.__pelican.rig.dist }));
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.move(650, 240, { steps: 10 });
await page.mouse.up();
const cam1 = await page.evaluate(() => ({ yaw: window.__pelican.rig.yaw }));
await page.mouse.wheel(0, 240);
await page.waitForTimeout(150);
const cam2 = await page.evaluate(() => ({ dist: window.__pelican.rig.dist }));
check('拖拽旋转视角', Math.abs(cam1.yaw - cam0.yaw) > 0.3, `yaw ${cam0.yaw.toFixed(2)}→${cam1.yaw.toFixed(2)}`);
check('滚轮缩放距离', cam2.dist > cam0.dist, `dist ${cam0.dist.toFixed(1)}→${cam2.dist.toFixed(1)}`);

// 9. 暂停（P）与最高分持久化
await page.keyboard.press('KeyP');
await page.waitForTimeout(300);
const paused = await page.evaluate(() => window.__pelican.state.mode);
check('P 暂停', paused === 'paused');
const bestNow = await page.evaluate(() => window.__pelican.state.best);
await page.goto(file);
await page.waitForTimeout(600);
const bestReload = await page.evaluate(() => Number(localStorage.getItem('pelican-bike-best') || 0));
check('最高分持久化', bestReload >= bestNow, `best=${bestReload}`);

await browser.close();
console.log('\n===== 测试结果 =====');
results.forEach((r) => console.log(r));
const failed = results.filter((r) => r.startsWith('❌')).length;
console.log(failed === 0 ? '全部通过 🎉' : `${failed} 项失败`);
