// 並列キーフレーム撮影: q=min/720で各beatを12fps密度で実描画（軽量）。
// 環境変数 BEATS="1,2,3" で担当beatを指定し、PORTを変えて複数プロセス並列実行する。
// 後段(assemble)で minterpolate により30fpsへ補間して滑らかにする。
import { readFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { startServer, launch, sleep, BASE } from '../e2e/lib.mjs';

const DIR = new URL('./', import.meta.url).pathname;
const TL = JSON.parse(readFileSync(DIR + 'timeline.json', 'utf8'));
const timing = existsSync(DIR + 'timing.json') ? JSON.parse(readFileSync(DIR + 'timing.json', 'utf8')) : null;
const CAP_FPS = 12;
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
const beatN = (id) => Math.max(2, Math.round(durOf(id) * CAP_FPS));
const dirOf = (id) => `${ROOT}b${String(id).padStart(2, '0')}`;
const isDone = (id) => existsSync(dirOf(id)) && readdirSync(dirOf(id)).filter((f) => f.endsWith('.jpg')).length >= beatN(id);

// 担当beat（BEATS env、無ければ全部）
const wanted = (process.env.BEATS || Object.keys(PATHS).join(',')).split(',').map(Number);
const ids = TL.beats.map((b) => b.id).filter((id) => PATHS[id] && wanted.includes(id));
const TAG = process.env.BEATS ? `[w${process.env.PORT || ''}]` : '';

const server = await startServer();

async function boot() {
  const { browser, page } = await launch({ viewport: { width: 720, height: 1280 } });
  await page.goto(`${BASE}/game.html?q=min`, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled, { timeout: 150000 });
  await page.click('#startBtn');
  await sleep(400);
  await page.evaluate(() => window.__game.skipIntro());
  await sleep(900);
  await page.evaluate(() => {
    document.getElementById('hud').classList.add('hidden');
    window.__game.G.quality.tier.fogDensity = 0.0011; // 霧を薄く（min既定は濃いため）
  });
  await page.waitForFunction(() => window.__game.G.npcs.npcs.length >= 7, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' })));
  await sleep(200);
  return { browser, page };
}

async function captureBeat(page, id) {
  const path = PATHS[id], N = beatN(id), d = dirOf(id);
  mkdirSync(d, { recursive: true });
  await page.evaluate((w) => window.__game.weather.set(w || 'clear'), path.weather || 'clear');
  await page.evaluate((t) => window.__game.setTimeOfDay(t), path.tod);
  await page.evaluate(([x, z, y]) => { window.__game.teleport(x, z); window.__game.setYaw(y); }, [path.x0, path.z0, path.y0]);
  await sleep(path.weather ? 1200 : 500);
  for (let k = 0; k < N; k++) {
    const t = smooth(N === 1 ? 0 : k / (N - 1));
    await page.evaluate(([x, z, y]) => { window.__game.teleport(x, z); window.__game.setYaw(y); },
      [lerp(path.x0, path.x1, t), lerp(path.z0, path.z1, t), lerp(path.y0, path.y1, t)]);
    await sleep(20);
    await page.screenshot({ path: `${d}/f${String(k).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
}

let ref = await boot();
try {
  for (const id of ids) {
    if (isDone(id)) { console.log(`${TAG} beat ${id}: skip`); continue; }
    for (let a = 1; a <= 3; a++) {
      try { await captureBeat(ref.page, id); console.log(`${TAG} beat ${String(id).padStart(2, '0')}: ${beatN(id)}f`); break; }
      catch (e) { console.log(`${TAG} beat ${id} 失敗(${a}): ${String(e).slice(0, 60)}→再起動`); try { await ref.browser.close(); } catch {} ref = await boot(); }
    }
  }
  console.log(`${TAG} 完了`);
} finally {
  try { await ref.browser.close(); } catch {}
  server.kill();
}
