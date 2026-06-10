// HUD（徹底ミニマル）: 所持金/ホットバーは変化時のみ表示・トースト・テロップ・地名
export function createHUD(G) {
  const $ = (id) => document.getElementById(id);
  const els = {
    hud: $('hud'), money: $('money'), hotbar: $('hotbar'),
    toastWrap: $('toastWrap'), telop: $('telop'), telopMain: $('telopMain'), telopSub: $('telopSub'),
    locTitle: $('locTitle'), locMain: $('locMain'), locSub: $('locSub'),
  };

  // 変化があった要素だけ数秒見せてフェードアウト
  const flashTimers = new Map();
  function flash(el, ms = 3200) {
    el.classList.add('flash');
    clearTimeout(flashTimers.get(el));
    flashTimers.set(el, setTimeout(() => el.classList.remove('flash'), ms));
  }

  const cache = {};
  function set(key, fn, val) {
    if (cache[key] !== val) { cache[key] = val; fn(val); }
  }

  function renderHotbar() {
    const st = G.state;
    const slots = [];
    slots.push({ num: 1, em: st.vegCount ? '🥕' : '', cnt: st.vegCount });
    slots.push({ num: 2, em: st.yuzuCount ? '🍋' : '', cnt: st.yuzuCount });
    for (let i = 0; i < 4; i++) {
      const b = st.breadsBought[i];
      slots.push({ num: 3 + i, em: b ? b.em : '', cnt: 0 });
    }
    els.hotbar.innerHTML = slots.map(s =>
      `<div class="slot" data-n="${s.num}"><span class="num">${s.num}</span>${s.em}` +
      (s.cnt ? `<span class="cnt">×${s.cnt}</span>` : '') + `</div>`).join('');
    flash(els.hotbar);
  }
  els.hotbar.addEventListener('click', (e) => {
    const s = e.target.closest('.slot');
    if (s) G.useSlot(+s.dataset.n);
  });

  // ---- 没入オートフェード: 無操作4秒でHUDクローム（目標ヒント等）を隠す ----
  let lastActive = performance.now();
  function wake() {
    lastActive = performance.now();
    els.hud.classList.remove('idleHide');
  }
  for (const ev of ['keydown', 'mousedown', 'touchstart', 'wheel']) {
    addEventListener(ev, wake, { passive: true });
  }

  let telopTimer = null;
  return {
    els,
    wake,
    show() { els.hud.classList.remove('hidden'); renderHotbar(); wake(); },
    setPhoto(on) { els.hud.classList.toggle('photo', on); },
    renderHotbar,
    popSlot(n) {
      const el = els.hotbar.querySelector(`[data-n="${n}"]`);
      if (el) { el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 220); }
      flash(els.hotbar);
    },
    toast(text, cls = '') {
      wake();
      const d = document.createElement('div');
      d.className = 'toast ' + cls;
      d.textContent = text;
      els.toastWrap.appendChild(d);
      setTimeout(() => d.remove(), 2100);
    },
    telop(main, sub = '', dur = 3400) {
      els.telopMain.textContent = main;
      els.telopSub.textContent = sub;
      els.telop.classList.add('show');
      clearTimeout(telopTimer);
      telopTimer = setTimeout(() => els.telop.classList.remove('show'), dur);
    },
    locationTitle(main, sub) {
      els.locMain.textContent = main;
      els.locSub.textContent = sub;
      els.locTitle.classList.add('show');
      setTimeout(() => els.locTitle.classList.remove('show'), 5200);
    },
    update() {
      set('money', (v) => {
        els.money.textContent = `🪙 ${v.toLocaleString()}円`;
        if (cache.moneyInit) flash(els.money); // 初期表示では出さない
        cache.moneyInit = true;
      }, G.state.money);
      if (performance.now() - lastActive > 4000) els.hud.classList.add('idleHide');
    },
  };
}
