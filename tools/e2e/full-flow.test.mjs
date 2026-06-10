// 全行程E2E: 収集→報告→コンポスト→入店→お礼→購入(PayPay)→食べる→写真→着席→エンドカード
import { startServer, launch, bootGame, key, sleep, assert } from './lib.mjs';

const server = await startServer();
const { browser, page, errors } = await launch();
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const phase = () => ev(() => window.__game.state.phase);
const tp = (x, z) => ev(([x, z]) => window.__game.teleport(x, z), [x, z]);

try {
  await bootGame(page);
  assert(await phase() === 'PLAY', 'イントロ後にPLAYへ遷移');

  // interact一覧から正確な座標を取って収集
  async function collectAll(labelPart) {
    const ts = await ev((lp) => window.__game.interact.list
      .filter((i) => i.label.includes(lp)).map((i) => [i.x, i.z]), labelPart);
    for (const [x, z] of ts) {
      await tp(x + 0.4, z + 0.4); await sleep(900);
      for (let k = 0; k < 4; k++) {
        await key(page, 'KeyE'); await sleep(800);
        const left = await ev((lp) => window.__game.interact.list
          .filter((i) => i.label.includes(lp) && i.enabled()).length, labelPart);
        if (left < ts.length) break;
      }
    }
  }
  await collectAll('ひろう');
  assert(await ev(() => window.__game.state.vegCount) === 3, '規格外やさい 3つ回収');
  await collectAll('しゅうかく');
  assert(await ev(() => window.__game.state.yuzuCount) === 3, 'ゆず 3つ収穫');

  await tp(-47.2, 22.8); await sleep(900);
  for (let i = 0; i < 12; i++) {
    await key(page, 'KeyF'); await sleep(800);
    if (await ev(() => window.__game.objectives.isDone('veg'))) break;
  }
  assert(await ev(() => window.__game.objectives.isDone('veg')), '田中さんへ報告（veg目標）');

  await tp(15, -65.3); await sleep(900);
  for (let i = 0; i < 10; i++) {
    await key(page, 'KeyF'); await sleep(800);
    if (await ev(() => window.__game.objectives.isDone('compost'))) break;
  }
  assert(await ev(() => window.__game.objectives.isDone('compost')), 'コンポスト');

  await tp(8, -58); await sleep(1500);
  assert(await ev(() => window.__game.objectives.isDone('bakery')), 'パン屋入店検知');

  await tp(8, -59.6); await sleep(900);
  for (let i = 0; i < 16; i++) {
    await key(page, 'KeyF'); await sleep(800);
    if (await phase() === 'SHOP') break;
  }
  assert(await phase() === 'SHOP', '大下さん→ショップが開く');
  assert(await ev(() => window.__game.state.money) === 1500, 'おつかいのお礼 +500円');
  assert(await ev(() => document.querySelector('#shopGrid .item .nm')?.textContent.includes('プチカンパーニュ')),
    'メニューにプチカンパーニュ');

  await page.click('#shopGrid .item'); await sleep(400);
  await page.click('#payPay'); await sleep(600);
  assert(await ev(() => window.__game.state.boughtCount) === 1, 'PayPayで購入');
  await page.click('#shopClose'); await sleep(800);

  await key(page, 'Digit3'); await sleep(1500);
  assert(await ev(() => window.__game.state.eatenCount) === 1, 'パンを食べた');

  await key(page, 'KeyP'); await sleep(800);
  for (let i = 0; i < 3; i++) { await key(page, 'KeyF'); await sleep(600); }
  await key(page, 'KeyP'); await sleep(800);
  assert(await ev(() => window.__game.objectives.state.photo.count) >= 3, 'フォトモードで3枚');

  await tp(-6, -55.9); await sleep(900);
  for (let i = 0; i < 8; i++) {
    await key(page, 'KeyF'); await sleep(800);
    if (await phase() === 'SIT') break;
  }
  assert(await phase() === 'SIT', 'カフェに着席');
  for (let i = 0; i < 30; i++) { if (await phase() === 'END') break; await sleep(1000); }
  assert(await phase() === 'END', 'エンドカード表示');
  assert(await ev(() => document.getElementById('endDisc').textContent.includes('架空のファンメイドデモゲーム')),
    'ディスクレーマー文言');

  assert(errors.length === 0, `実行時エラーなし${errors.length ? ': ' + errors[0] : ''}`);
} finally {
  await browser.close();
  server.kill();
}
process.exit(process.exitCode || 0);
