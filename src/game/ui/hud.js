// HUD: コンパス・ミニマップ・所持金・ホットバー・トースト・テロップ
import { L, SHOP_ITEMS } from '../config.js';

export function createHUD(G) {
  const $ = (id) => document.getElementById(id);
  const els = {
    hud: $('hud'), money: $('money'), hotbar: $('hotbar'),
    toastWrap: $('toastWrap'), telop: $('telop'), telopMain: $('telopMain'), telopSub: $('telopSub'),
    locTitle: $('locTitle'), locMain: $('locMain'), locSub: $('locSub'),
  };
  const compassCv = $('compass');
  const compassCtx = compassCv.getContext('2d');
  const mmCv = $('minimap');
  const mmCtx = mmCv.getContext('2d');

  // ---- ミニマップ静的レイヤ ----
  const MAP_W = 800; // ワールド -400..400
  const mapStatic = document.createElement('canvas');
  mapStatic.width = mapStatic.height = 1024;
  {
    const c = mapStatic.getContext('2d');
    const S = 1024 / MAP_W;
    const X = (x) => (x + MAP_W / 2) * S, Z = (z) => (z + MAP_W / 2) * S;
    c.fillStyle = '#8a9a6a'; c.fillRect(0, 0, 1024, 1024);
    // 丘の陰影（粗く）
    for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) {
      const x = (i / 64 - 0.5) * MAP_W, z = (j / 64 - 0.5) * MAP_W;
      const h = G.terrain.fastY(x, z);
      if (h > 3) {
        c.fillStyle = `rgba(52,72,46,${Math.min(0.65, h / 90)})`;
        c.fillRect(X(x) - 8, Z(z) - 8, 17, 17);
      }
    }
    // 田んぼ
    c.fillStyle = '#a6bb74';
    for (const [x, z, w, d] of L.paddies) c.fillRect(X(x - w / 2), Z(z - d / 2), w * S, d * S);
    // 川
    c.strokeStyle = '#6f9cae'; c.lineWidth = L.riverW * S;
    c.beginPath();
    L.riverPts.forEach(([x, z], i) => i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z)));
    c.stroke();
    // 県道
    c.strokeStyle = '#b9b4a6'; c.lineWidth = 6 * S;
    c.beginPath();
    L.roadPts.forEach(([x, z], i) => i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z)));
    c.stroke();
    // グラウンド・建物
    c.fillStyle = '#c2a26e';
    c.fillRect(X(L.grounds.x - L.grounds.w / 2), Z(L.grounds.z - L.grounds.d / 2), L.grounds.w * S, L.grounds.d * S);
    c.fillStyle = '#f0ead8';
    c.fillRect(X(L.school.x - L.school.w / 2), Z(L.school.z - L.school.d / 2), L.school.w * S, L.school.d * S);
    c.fillRect(X(L.gym.x - L.gym.w / 2), Z(L.gym.z - L.gym.d / 2), L.gym.w * S, L.gym.d * S);
    c.fillRect(X(L.center.x - L.center.w / 2), Z(L.center.z - L.center.d / 2), L.center.w * S, L.center.d * S);
    c.fillStyle = '#ded4c2';
    for (const [x, z] of L.houses) c.fillRect(X(x - 5), Z(z - 5), 10 * S, 10 * S);
  }

  const DIRS = [['北', 0], ['北東', 45], ['東', 90], ['南東', 135], ['南', 180], ['南西', 225], ['西', 270], ['北西', 315]];

  function drawCompass() {
    const w = compassCv.clientWidth, h = compassCv.clientHeight;
    if (!w) return;
    if (compassCv.width !== w * 2) { compassCv.width = w * 2; compassCv.height = h * 2; }
    const c = compassCtx;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.clearRect(0, 0, w, h);
    const hd = (G.player.headingRad() * 180 / Math.PI + 360) % 360;
    const pxPerDeg = w / 150;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const [label, deg] of DIRS) {
      let dd = ((deg - hd + 540) % 360) - 180;
      const x = w / 2 + dd * pxPerDeg;
      if (x < -16 || x > w + 16) continue;
      c.fillStyle = deg % 90 === 0 ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.5)';
      c.font = (deg % 90 === 0 ? '700 12px' : '600 9px') + ' system-ui, sans-serif';
      c.fillText(label, x, h / 2);
    }
    const t = G.objectives.target();
    if (t) {
      const p = G.player.pos;
      const bearing = (Math.atan2(t.x - p.x, -(t.z - p.z)) * 180 / Math.PI + 360) % 360;
      let dd = ((bearing - hd + 540) % 360) - 180;
      const x = Math.max(8, Math.min(w - 8, w / 2 + dd * pxPerDeg));
      c.font = '11px system-ui';
      c.fillText('🍞', x, h / 2);
    }
    c.fillStyle = '#e8b35a';
    c.fillRect(w / 2 - 0.75, 1, 1.5, 4);
  }

  function drawMinimap() {
    const sz = mmCv.clientWidth;
    if (!sz) return;
    if (mmCv.width !== sz * 2) { mmCv.width = mmCv.height = sz * 2; }
    const c = mmCtx;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.clearRect(0, 0, sz, sz);
    c.save();
    c.beginPath(); c.arc(sz / 2, sz / 2, sz / 2, 0, 7); c.clip();
    const view = 180;
    const p = G.player.pos;
    const S = 1024 / MAP_W;
    const px = (p.x + MAP_W / 2) * S, pz = (p.z + MAP_W / 2) * S;
    const half = view / 2 * S;
    c.drawImage(mapStatic, px - half, pz - half, half * 2, half * 2, 0, 0, sz, sz);
    const t = G.objectives.target();
    if (t) {
      const scale = sz / view;
      let mx = (t.x - p.x) * scale + sz / 2;
      let mz = (t.z - p.z) * scale + sz / 2;
      const dx = mx - sz / 2, dz = mz - sz / 2, dd = Math.hypot(dx, dz);
      const maxR = sz / 2 - 10;
      if (dd > maxR) { mx = sz / 2 + dx / dd * maxR; mz = sz / 2 + dz / dd * maxR; }
      c.font = '13px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('🍞', mx, mz);
    }
    c.save();
    c.translate(sz / 2, sz / 2);
    c.rotate(G.player.headingRad());
    c.fillStyle = '#fff';
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(0, 2); c.lineTo(-5, 5); c.closePath();
    c.fill(); c.stroke();
    c.restore();
    c.restore();
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
  }
  els.hotbar.addEventListener('click', (e) => {
    const s = e.target.closest('.slot');
    if (s) G.useSlot(+s.dataset.n);
  });

  // ---- 没入オートフェード: 無操作4秒でHUDクロームを隠す ----
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
      set('money', (v) => { els.money.textContent = `🪙 ${v.toLocaleString()}円`; wake(); }, G.state.money);
      if (performance.now() - lastActive > 4000) els.hud.classList.add('idleHide');
      drawCompass();
      drawMinimap();
    },
  };
}
