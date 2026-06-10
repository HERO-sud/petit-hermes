// ショップ + 支払い（げんきん / PayPay）
import { SHOP_ITEMS } from '../config.js';

export function createShop(G) {
  const $ = (id) => document.getElementById(id);
  let pendingItem = null;

  function render() {
    $('shopGrid').innerHTML = SHOP_ITEMS.map((it, i) =>
      `<div class="item" data-i="${i}">
        <div class="em">${it.em}</div>
        <div class="nm">${it.name}</div>
        <div class="pr">¥${it.price.toLocaleString()}</div>
      </div>`).join('');
    $('shopWallet').textContent = `おさいふ：🪙 ${G.state.money.toLocaleString()}円`;
  }

  function completePurchase(it, method) {
    G.state.money -= it.price;
    G.state.breadsBought.push(it);
    G.hud.renderHotbar();
    G.hud.popSlot(2 + G.state.breadsBought.length);
    render();
    if (method === 'paypay') G.audio?.sfx.paypay(); else G.audio?.sfx.buy();
    G.hud.toast(`${it.em} ${it.name} をかった！`, 'gold');
    G.state.boughtCount++;
  }

  $('shopGrid').addEventListener('click', (e) => {
    const el = e.target.closest('.item');
    if (!el) return;
    const it = SHOP_ITEMS[+el.dataset.i];
    if (G.state.money < it.price) { G.hud.toast('お金がたりない…', ''); return; }
    if (G.state.breadsBought.length >= 4) { G.hud.toast('リュックがいっぱい！パンをたべてからね', ''); return; }
    if (!G.state.paidOnce) {
      pendingItem = it;
      $('payTitle').textContent = `おしはらい ¥${it.price.toLocaleString()}`;
      $('payDesc').textContent = 'プチヘルメースは キャッシュレスもOK！どっちで はらう？';
      $('pay').classList.remove('hidden');
    } else {
      completePurchase(it, null);
    }
  });
  $('payCash').addEventListener('click', () => {
    $('pay').classList.add('hidden');
    G.state.paidOnce = true;
    if (pendingItem) completePurchase(pendingItem, 'cash');
    pendingItem = null;
  });
  $('payPay').addEventListener('click', () => {
    $('pay').classList.add('hidden');
    G.state.paidOnce = true;
    if (pendingItem) completePurchase(pendingItem, 'paypay');
    pendingItem = null;
  });
  $('shopClose').addEventListener('click', () => {
    $('shop').classList.add('hidden');
    G.state.phase = 'PLAY';
    G.interact.setCooldown(0.35);
    G.player.requestLock();
  });

  return {
    open() {
      G.state.phase = 'SHOP';
      G.player.exitLock();
      render();
      $('shop').classList.remove('hidden');
    },
  };
}
