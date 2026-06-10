// スマホタッチUI: 表示とジョイスティック移動を確認
import { startServer, launch, sleep, assert, BASE } from './lib.mjs';

const server = await startServer();
const { browser, page, errors } = await launch();
await page.emulate({
  viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
});

try {
  await page.goto(`${BASE}/game.html?q=min`, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled, { timeout: 150000 });
  assert(await page.evaluate(() => !document.getElementById('touchUI').classList.contains('hidden')),
    'タッチUIが表示される');
  await page.tap('#startBtn');
  await sleep(400);
  await page.evaluate(() => window.__game.skipIntro());
  await sleep(1200);
  const z0 = await page.evaluate(() => window.__game.player.position.z);
  const joy = await page.$('#joyBase');
  const bb = await joy.boundingBox();
  await page.touchscreen.touchStart(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.touchscreen.touchMove(bb.x + bb.width / 2, bb.y + 6);
  await sleep(4000);
  await page.touchscreen.touchEnd();
  const z1 = await page.evaluate(() => window.__game.player.position.z);
  assert(z1 - z0 < -0.5, `ジョイスティックで北へ移動 (dz=${(z1 - z0).toFixed(2)})`);
  assert(errors.length === 0, `実行時エラーなし${errors.length ? ': ' + errors[0] : ''}`);
} finally {
  await browser.close();
  server.kill();
}
process.exit(process.exitCode || 0);
