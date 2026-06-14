// 尺駆動モーションキャプチャ: 各「行(beat)」を、その尺ぶん30fpsで密に連写する。
// → 引き伸ばし無し＝完全に滑らか＆音と同期。frames/b<NN>/f####.png （一人称）。
import { readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { startServer, launch, sleep, BASE } from '../e2e/lib.mjs';

const DIR = new URL('./', import.meta.url).pathname;
const TL = JSON.parse(readFileSync(DIR + 'timeline.json', 'utf8'));
const timing = existsSync(DIR + 'timing.json') ? JSON.parse(readFileSync(DIR + 'timing.json', 'utf8')) : null;
const FPS = 30;
const ROOT = DIR + 'frames/';
rmSync(ROOT, { recursive: true, force: true });
mkdirSync(ROOT, { recursive: true });

// 各 beat のカメラパス（from→to を補間）。card 背景の beat はここに無い（静止カードのため）。
const P = (x0, z0, y0, x1, z1, y1, o = {}) => ({ x0, z0, y0, x1, z1, y1, fp: true, tod: 0.3, ...o });
const PATHS = {
  1:  P(25, 80, 0, 25, 72, 0, { tod: 0.12 }),
  2:  P(25, 72, 0, 25, 63, 0, { tod: 0.12 }),
  3:  P(27, 47, -0.1, 27, 35, 0.05, { tod: 0.18 }),
  4:  P(33, 45, 0.35, 33, 45, 0.95, { tod: 0.2 }),
  5:  P(8, -44, 0, 8, -49, 0, { tod: 0.3 }),
  6:  P(8, -49, 0, 8, -53, 0, { tod: 0.3 }),
  7:  P(8, -57, 0, 8, -58.7, 0, { tod: 0.3 }),
  8:  P(8, -58.7, -0.16, 8, -58.7, 0.16, { tod: 0.3 }),
  9:  P(27, 57, 0, 27, 47, 0, { tod: 0.4, weather: 'rain' }),
  10: P(-116, 154, 3.5, -116, 146, 3.9, { tod: 0.35 }),
  11: P(25, 72, -0.16, 25, 72, 0.16, { tod: 1.0 }),
  18: P(26, 26, 0, 26, 11, 0, { tod: 0.2 }),
  19: P(22, 34, -0.05, 22, 26, 0.05, { tod: 0.3, weather: 'fog' }),
  20: P(22, 26, 0, 22, 20, 0, { tod: 0.3, weather: 'fog' }),
  23: P(0, -8, -0.32, 0, -8, 0.32, { tod: 0.22 }),
  24: P(33, 46, 0.55, 33, 44, 0.8, { tod: 0.2 }),
  25: P(25, 71, 0, 25, 64, 0, { tod: 0.12 }),
  26: P(-6, -57.8, Math.PI - 0.22, -6, -57.8, Math.PI + 0.22, { tod: 0.3 }),
  27: P(45, 96, 1.22, 45, 96, 1.62, { tod: 0.25 }),
  29: P(25, 69, 0, 25, 62, 0, { tod: 0.12 }),
};

const durOf = (id) => {
  if (timing) { const fr = timing.frames.find((f) => f.img.includes(`/${String(id).padStart(2, '0')}.`)); if (fr) return fr.dur; }
  return (TL.beats.find((b) => b.id === id)?.min_dur) || 2.5;
};
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

const server = await startServer();
const { browser, page, errors } = await launch({ viewport: { width: 1080, height: 1920 } });
const ev = (fn, ...a) => page.evaluate(fn, ...a);

try {
  await page.goto(`${BASE}/game.html?q=mid`, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled, { timeout: 150000 });
  await page.click('#startBtn');
  await sleep(400);
  await ev(() => window.__game.skipIntro());
  await sleep(1200);
  await ev(() => document.getElementById('hud').classList.add('hidden'));
  await page.waitForFunction(() => window.__game.G.npcs.npcs.length >= 7, { timeout: 60000 }).catch(() => {});
  await sleep(800);

  let fpOn = false, total = 0;
  for (const b of TL.beats) {
    const path = PATHS[b.id];
    if (!path) continue; // card beat → 撮影不要
    const N = Math.max(2, Math.round(durOf(b.id) * FPS));
    const d = `${ROOT}b${String(b.id).padStart(2, '0')}`;
    mkdirSync(d, { recursive: true });
    await ev((w) => window.__game.weather.set(w || 'clear'), path.weather || 'clear');
    await ev((t) => window.__game.setTimeOfDay(t), path.tod);
    if (!!path.fp !== fpOn) { await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' }))); await sleep(150); fpOn = !!path.fp; }
    await ev(([x, z, y]) => { window.__game.teleport(x, z); window.__game.setYaw(y); }, [path.x0, path.z0, path.y0]);
    await sleep(path.weather ? 1300 : 600);
    for (let k = 0; k < N; k++) {
      const t = smooth(N === 1 ? 0 : k / (N - 1));
      await ev(([x, z, y]) => { window.__game.teleport(x, z); window.__game.setYaw(y); },
        [lerp(path.x0, path.x1, t), lerp(path.z0, path.z1, t), lerp(path.y0, path.y1, t)]);
      await sleep(40);
      await page.screenshot({ path: `${d}/f${String(k).padStart(4, '0')}.png` });
    }
    total += N;
    console.log(`beat ${String(b.id).padStart(2, '0')}: ${N}f (${durOf(b.id).toFixed(2)}s)  [total ${total}]`);
  }
  if (fpOn) await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' })));
  console.log(`=== 合計 ${total} 枚 ===`);
  console.log(errors.length ? `WARN: ${errors.slice(0, 3).join(' | ')}` : 'no runtime errors');
} finally {
  await browser.close();
  server.kill();
}
