// 任意目標システム（強制なし）: トラッカー・マーカー光柱・一覧パネル
import * as THREE from 'three';
import { OBJECTIVES } from '../config.js';

export function createObjectives(G) {
  const state = {};
  for (const o of OBJECTIVES) state[o.id] = { done: false, count: 0 };
  let focusId = 'bakery';

  // 控えめな光柱マーカー
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 120, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd98a, transparent: true, opacity: 0.07,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
  beacon.position.y = 60;
  G.scene.add(beacon);

  const objText = document.getElementById('objText');
  const objSub = document.getElementById('objSub');
  const panel = document.getElementById('objPanel');
  const listEl = document.getElementById('objList');

  function def(id) { return OBJECTIVES.find(o => o.id === id); }

  function refreshHint() {
    const d = def(focusId);
    if (!d) { objText.textContent = '自由にたんけんしよう'; objSub.textContent = ''; return; }
    const s = state[d.id];
    objText.textContent = `${d.mk} ${d.name}`;
    objSub.textContent = d.count ? `${s.count}/${d.count}` : '';
  }

  // ミニマップ廃止にともなう迷子対策: 目標の方角と距離をヒントに表示
  const DIRS8 = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  let lastHintAt = 0;
  function updateDirectionHint() {
    const now = performance.now();
    if (now - lastHintAt < 500) return; // 0.5秒ごとに更新すれば十分
    lastHintAt = now;
    const d = def(focusId), t = O.target();
    if (!d || !t) return;
    const p = G.player.pos;
    const dx = t.x - p.x, dz = t.z - p.z;
    const dist = Math.hypot(dx, dz);
    const base = d.count ? `${state[d.id].count}/${d.count}　` : '';
    if (dist < 12) { objSub.textContent = base + 'すぐちかく！'; return; }
    const deg = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
    const dir = DIRS8[Math.round(deg / 45) % 8];
    objSub.textContent = `${base}${dir}へ およそ${Math.round(dist / 10) * 10}m`;
  }

  function pickNextFocus() {
    const order = ['bakery', 'veg', 'yuzu', 'compost', 'cafe', 'photo'];
    focusId = order.find(id => !state[id].done) || null;
    refreshHint();
  }

  function renderPanel() {
    listEl.innerHTML = OBJECTIVES.map(o => {
      const s = state[o.id];
      const prog = o.count ? `（${s.count}/${o.count}）` : '';
      return `<div class="objRow ${s.done ? 'done' : ''}">
        <div class="mk">${s.done ? '✅' : o.mk}</div>
        <div class="bd"><div class="nm">${o.name}${prog}</div><div class="ds">${o.desc}</div></div>
      </div>`;
    }).join('');
  }

  document.getElementById('objClose').addEventListener('click', () => O.togglePanel(false));

  const O = {
    state,
    get focus() { return focusId; },
    target() {
      const d = def(focusId);
      return d ? d.target() : null;
    },
    progress(id, n = 1) {
      const d = def(id), s = state[id];
      if (!d || s.done) return;
      s.count += n;
      if (!d.count || s.count >= d.count) {
        s.done = true;
        G.hud.toast(`✅ ${d.name}`, 'green');
        G.audio?.sfx.objective();
        if (id === focusId) pickNextFocus();
      } else if (id === focusId) refreshHint();
    },
    complete(id) {
      const d = def(id), s = state[id];
      if (!d || s.done) return;
      s.done = true;
      G.hud.toast(`✅ ${d.name}`, 'green');
      G.audio?.sfx.objective();
      if (id === focusId) pickNextFocus();
    },
    isDone(id) { return state[id].done; },
    togglePanel(force) {
      const show = force ?? panel.classList.contains('hidden');
      if (show) { renderPanel(); panel.classList.remove('hidden'); }
      else panel.classList.add('hidden');
    },
    update() {
      const t = O.target();
      beacon.visible = !!t && G.state.phase === 'PLAY';
      if (t) { beacon.position.x = t.x; beacon.position.z = t.z; }
      updateDirectionHint();
    },
  };
  refreshHint();
  return O;
}
