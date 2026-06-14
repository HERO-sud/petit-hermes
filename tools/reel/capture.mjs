// 尺駆動モーションキャプチャ（堅牢版）: 各「行(beat)」を尺ぶん30fpsで密連写。
// レンダラ落ち(Target closed)に備え、ブラウザ自動再起動＋途中再開、数beatごとに予防的リサイクル。
import { readFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { startServer, launch, sleep, BASE } from '../e2e/lib.mjs';

const DIR = new URL('./', import.meta.url).pathname;
const TL = JSON.parse(readFileSync(DIR + 'timeline.json', 'utf8'));
const timing = existsSync(DIR + 'timing.json') ? JSON.parse(readFileSync(DIR + 'timing.json', 'utf8')) : null;
const FPS = 30;            // 出力と一致＝補間ゼロで最も滑らか。時間優先より品質優先
const RECYCLE_EVERY = 5;   // N beat ごとにブラウザを作り直してメモリを解放
const ROOT = DIR + 'frames/';
mkdirSync(ROOT, { recursive: true });

const P = (x0, z0, y0, x1, z1, y1, o = {}) => ({ x0, z0, y0, x1, z1, y1, fp: true, tod: 0.3, ...o });
const PATHS = {
  1: P(25, 80, 0, 25, 72, 0, { tod: 0.12 }), 2: P(25, 72, 0, 25, 63, 0, { tod: 0.12 }),
  3: P(27, 47, -0.1, 27, 35, 0.05, { tod: 0.18 }), 4: P(33, 45, 0.35, 33, 45, 0.95, { tod: 0.2 }),
  5: P(8, -44, 0, 8, -49, 0, { tod: 0.3 }), 6: P(8, -49, 0, 8, -53, 0, { tod: 0.3 }),
  7: P(8, -57, 0, 8, -58.7, 0, { tod: 0.3 }), 8: P(8, -58.7, -0.16, 8, -58.7, 0.16, { tod: 0.3 }),
  9: P(27, 57, 0, 27, 47, 0, { tod: 0.4, weather: 'rain' }), 10: P(-116, 154, 3.5, -116, 146, 3.9, { tod: 0.35 }),
  11: P(25, 72, -0.16, 25, 72, 0.16, { tod: 1.0 }), 18: P(26, 26, 0, 26, 11, 0, { tod: 0.2 }),
  19: P(22, 34, -0.05, 22, 26, 0.05, { tod: 0.3, weather: 'fog' }), 20: P(22, 26, 0, 22, 20, 0, { tod: 0.3, weather: 'fog' }),
  23: P(0, -8, -0.32, 0, -8, 0.32, { tod: 0.22 }), 24: P(33, 46, 0.55, 33, 44, 0.8, { tod: 0.2 }),
  25: P(25, 71, 0, 25, 64, 0, { tod: 0.12 }), 26: P(-6, -57.8, Math.PI - 0.22, -6, -57.8, Math.PI + 0.22, { tod: 0.3 }),
  27: P(45, 96, 1.22, 45, 96, 1.62, { tod: 0.25 }), 29: P(25, 69, 0, 25, 62, 0, { tod: 0.12 }),
};
const durOf = (id) => {
  if (timing) { const fr = timing.frames.find((f) => f.img.includes(`/${String(id).padStart(2, '0')}.`)); if (fr) return fr.dur; }
  return (TL.beats.find((b) => b.id === id)?.min_dur) || 2.5;
};
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const beatN = (id) => Math.max(2, Math.round(durOf(id) * FPS));
const done = (id) => { const d = `${ROOT}b${String(id).padStart(2, '0')}`; return existsSync(d) && readdirSync(d).filter((f) => f.endsWith('.jpg')).length >= beatN(id); };

const server = await startServer();

async function boot() {
  const { browser, page, errors } = await launch({ viewport: { width: 1080, height: 1920 } });
  await page.goto(`${BASE}/game.html?q=low`, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled, { timeout: 150000 });
  await page.click('#startBtn');
  await sleep(400);
  await page.evaluate(() => window.__game.skipIntro());
  await sleep(1000);
  await page.evaluate(() => document.getElementById('hud').classList.add('hidden'));
  await page.waitForFunction(() => window.__game.G.npcs.npcs.length >= 7, { timeout: 60000 }).catch(() => {});
  await sleep(700);
  // 一人称に
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' })));
  await sleep(150);
  return { browser, page, errors };
}

async function captureBeat(page, id) {
  const path = PATHS[id]; const N = beatN(id);
  const d = `${ROOT}b${String(id).padStart(2, '0')}`;
  mkdirSync(d, { recursive: true });
  await page.evaluate((w) => window.__game.weather.set(w || 'clear'), path.weather || 'clear');
  await page.evaluate((t) => window.__game.setTimeOfDay(t), path.tod);
  await page.evaluate(([x, z, y]) => { window.__game.teleport(x, z); window.__game.setYaw(y); }, [path.x0, path.z0, path.y0]);
  await sleep(path.weather ? 1300 : 600);
  for (let k = 0; k < N; k++) {
    const t = smooth(N === 1 ? 0 : k / (N - 1));
    await page.evaluate(([x, z, y]) => { window.__game.teleport(x, z); window.__game.setYaw(y); },
      [lerp(path.x0, path.x1, t), lerp(path.z0, path.z1, t), lerp(path.y0, path.y1, t)]);
    await sleep(40);
    await page.screenshot({ path: `${d}/f${String(k).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 95 });
  }
}

const ids = TL.beats.map((b) => b.id).filter((id) => PATHS[id]);
let ref = await boot();
let total = 0, sinceRecycle = 0;
try {
  for (const id of ids) {
    if (done(id)) { console.log(`beat ${id}: skip(済)`); total += beatN(id); continue; }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await captureBeat(ref.page, id);
        total += beatN(id); sinceRecycle++;
        console.log(`beat ${String(id).padStart(2, '0')}: ${beatN(id)}f  [total ${total}]`);
        break;
      } catch (e) {
        console.log(`beat ${id} 失敗(試行${attempt}): ${String(e).slice(0, 80)} → 再起動`);
        try { await ref.browser.close(); } catch {}
        ref = await boot(); sinceRecycle = 0;
      }
    }
    if (sinceRecycle >= RECYCLE_EVERY) {
      try { await ref.browser.close(); } catch {}
      ref = await boot(); sinceRecycle = 0;
      console.log('  (予防リサイクル)');
    }
  }
  console.log(`=== 合計 ${total} 枚 ===`);
} finally {
  try { await ref.browser.close(); } catch {}
  server.kill();
}
