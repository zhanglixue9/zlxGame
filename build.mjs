import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

async function run() {
  const result = await build({
    entryPoints: [path.join(__dirname, 'src/main.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2019'],
    write: false,
    legalComments: 'none',
    logLevel: 'warning',
  });

  const js = result.outputFiles[0].text;
  const shell = await readFile(path.join(__dirname, 'src/index.html'), 'utf8');
  const marker = '/*__GAME__*/';
  if (!shell.includes(marker)) throw new Error('index.html 缺少 /*__GAME__*/ 占位符');

  const html = shell.replace(marker, () => js);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);

  // 根目录 index.html 是 GitHub Pages 的入口（main 分支根目录部署）；
  // dist/ 下的副本留给本地双击游玩。
  const targets = [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'dist/pelican-bike.html'),
  ];
  await mkdir(path.join(__dirname, 'dist'), { recursive: true });
  for (const out of targets) {
    await writeFile(out, html, 'utf8');
    console.log(`✅ 打包完成 ${path.relative(__dirname, out)}  (${kb} KB)`);
  }
}

await run();

if (isWatch) {
  const { watch } = await import('node:fs');
  let timer = null;
  watch(path.join(__dirname, 'src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => run().catch((e) => console.error(e.message)), 120);
  });
  console.log('👀 watching src/ ...');
}
