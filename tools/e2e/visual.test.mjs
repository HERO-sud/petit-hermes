// ビジュアルスモーク: 定点スクリーンショットを撮影しartifactとして保存
// （swiftshaderと実GPUの描画差があるため画素比較はせず、起動・描画・例外ゼロを確認）
import { mkdirSync } from 'node:fs';
import { startServer, launch, bootGame, sleep, assert } from './lib.mjs';

const OUT = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const server = await startServer();
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } });
const ev = (fn, ...a) => page.evaluate(fn, ...a);

try {
  await bootGame(page, 'q=low');
  const spots = [
    ['spawn', 30.2, 47, 0],
    ['school', 6, -42, 0],
    ['paddy', 40, 96, 1.35],
    ['bakery', 8, -58.6, 0.45],
  ];
  for (const [name, x, z, yaw] of spots) {
    await ev(([x, z, yaw]) => { window.__game.teleport(x, z); window.__game.setYaw(yaw); }, [x, z, yaw]);
    await sleep(8000);
    await page.screenshot({ path: `${OUT}${name}.png` });
    console.log(`shot: ${name}.png`);
  }
  // 描画されていること（真っ黒/真っ白でない）をスクリーンショット経由で確認
  // （WebGLキャンバスはpreserveDrawingBuffer無効のため直接読めない）
  const shot = await page.screenshot({ encoding: 'base64' });
  const stats = await ev(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const g = document.createElement('canvas');
    g.width = 64; g.height = 36;
    const ctx = g.getContext('2d');
    ctx.drawImage(img, 0, 0, 64, 36);
    const d = ctx.getImageData(0, 0, 64, 36).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
    return sum / (d.length / 4);
  }, shot);
  assert(stats > 20 && stats < 240, `平均輝度が正常範囲 (${stats.toFixed(0)})`);
  assert(errors.length === 0, `実行時エラーなし${errors.length ? ': ' + errors[0] : ''}`);
} finally {
  await browser.close();
  server.kill();
}
process.exit(process.exitCode || 0);
