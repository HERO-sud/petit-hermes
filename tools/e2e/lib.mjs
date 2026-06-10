// E2E共通ヘルパー（puppeteer + swiftshader）
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';

export const PORT = 8910;
export const BASE = `http://localhost:${PORT}`;

export function startServer() {
  const proc = spawn('node', [new URL('./server.mjs', import.meta.url).pathname],
    { env: { ...process.env, PORT }, stdio: 'pipe' });
  return new Promise((resolve) => {
    proc.stdout.on('data', () => resolve(proc));
    setTimeout(() => resolve(proc), 1500);
  });
}

export async function launch(opts = {}) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    defaultViewport: { width: 960, height: 540, ...opts.viewport },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 160)); });
  return { browser, page, errors };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function bootGame(page, query = 'q=min') {
  await page.goto(`${BASE}/game.html?${query}`, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled, { timeout: 150000 });
  await page.click('#startBtn');
  await sleep(400);
  await page.evaluate(() => window.__game.skipIntro());
  await sleep(1200);
}

export function key(page, code) {
  return page.evaluate((c) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: c }));
    setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: c })), 60);
  }, code);
}

export function assert(cond, msg) {
  if (!cond) { console.error(`✗ ${msg}`); process.exitCode = 1; }
  else console.log(`✓ ${msg}`);
}
