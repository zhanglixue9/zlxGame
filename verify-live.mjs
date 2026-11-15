// 线上验收：打开 GitHub Pages 地址，确认游戏真的跑起来
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL_LIVE = 'https://zhanglixue9.github.io/zlxGame/';

const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
});

// 1) 菜单页
await page.goto(URL_LIVE, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(2500);
const menuShot = path.join(__dirname, 'shots/live-menu.png');
await page.screenshot({ path: menuShot });

const boot = await page.evaluate(() => ({
  hasGame: !!window.__pelican,
  mode: window.__pelican?.state?.mode,
  canvas: !!document.querySelector('canvas'),
  title: document.title,
}));

// 2) 点开始，进游戏
const play = await page.evaluate(async () => {
  const btn = document.getElementById('ov-btn');
  if (btn) btn.click();
  await new Promise((r) => setTimeout(r, 400));
  return window.__pelican?.state?.mode;
});
await page.waitForTimeout(6000);

const run = await page.evaluate(() => {
  const g = window.__pelican;
  return {
    mode: g.state.mode,
    distance: Math.round(g.state.distance),
    speed: +g.state.speed.toFixed(2),
    health: g.state.health,
    score: document.getElementById('score')?.textContent,
    hearts: document.querySelectorAll('#hearts .heart').length,
    camera: g.rig.mode,
  };
});
const playShot = path.join(__dirname, 'shots/live-play.png');
await page.screenshot({ path: playShot });

console.log('启动:', JSON.stringify(boot));
console.log('点击开始后:', play, '→ 运行 6 秒:', JSON.stringify(run));
console.log('错误:', errors.length ? errors.slice(0, 5) : '无');
console.log('截图:', menuShot, playShot);

await browser.close();
