import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = 'file:///' + path.join(__dirname, 'dist/pelican-bike.html').replace(/\\/g, '/');

const shots = [
  { name: 'chase', url: file + '?auto=1&near=1', wait: 6000 },
  { name: 'fps', url: file + '?auto=1&view=fps&near=1', wait: 6000 },
  { name: 'orbit', url: file + '?auto=1&near=1', wait: 5200, orbit: true },
];

const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text().slice(0, 300));
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

for (const s of shots) {
  await page.goto(s.url);
  await page.waitForTimeout(s.wait);
  if (s.orbit) {
    // 模拟玩家拖拽转视角 + 滚轮拉近，验证自由相机
    await page.evaluate(() => {
      const rig = window.__pelican.rig;
      rig.yaw = -1.05;
      rig.pitch = 0.34;
      rig.dist = 5.2;
      rig.lastOrbitAt = performance.now();
    });
    await page.waitForTimeout(120);
  }
  await page.screenshot({ path: path.join(__dirname, `shots/${s.name}.png`) });
  console.log('shot', s.name);
}

// 打印一下 HUD 状态，确认逻辑在跑
const info = await page.evaluate(() => ({
  score: document.getElementById('score')?.textContent,
  best: document.getElementById('best')?.textContent,
  err: document.querySelectorAll('div[style*="c0392b"]').length,
}));
console.log(info);

await browser.close();
