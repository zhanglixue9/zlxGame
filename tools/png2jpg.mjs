// 把 shots/*.png 转成 docs/*.jpg，压缩后用于 README 展示
import { chromium } from 'playwright-core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const names = process.argv.slice(2);
const list = names.length ? names : ['chase', 'orbit', 'fps', 'menu'];

await mkdir(path.join(root, 'docs'), { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  args: ['--allow-file-access-from-files'],
});
const page = await browser.newPage();

for (const name of list) {
  const buf = await readFile(path.join(root, 'shots', `${name}.png`));
  const dataUrl = 'data:image/png;base64,' + buf.toString('base64');
  const out = await page.evaluate(
    async ({ url, quality }) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/jpeg', quality);
    },
    { url: dataUrl, quality: 0.84 }
  );
  const jpg = Buffer.from(out.split(',')[1], 'base64');
  await writeFile(path.join(root, 'docs', `${name}.jpg`), jpg);
  console.log(`${name}.jpg  ${(jpg.length / 1024).toFixed(0)} KB`);
}

await browser.close();
