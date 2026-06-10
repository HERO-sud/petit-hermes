// [F]/[E] インタラクト
export function createInteract(G) {
  const interactables = [];
  let current = null;
  let cooldown = 0;

  const promptEl = document.getElementById('prompt');
  const keyEl = document.getElementById('promptKey');
  const labelEl = document.getElementById('promptLabel');
  const btnAct = document.getElementById('btnAct');

  return {
    list: interactables,
    add(o) { interactables.push(o); return o; },
    setCooldown(t) { cooldown = t; },
    get current() { return current; },

    update(dt) {
      if (cooldown > 0) cooldown -= dt;
      if (G.state.phase !== 'PLAY' || cooldown > 0) {
        promptEl.classList.add('hidden');
        current = null;
        return;
      }
      const p = G.player.pos;
      let best = null, bestD = 1e9;
      for (const it of interactables) {
        if (!it.enabled()) continue;
        const d = Math.hypot(it.x - p.x, it.z - p.z);
        if (d < it.r && d < bestD) { best = it; bestD = d; }
      }
      current = best;
      if (best) {
        keyEl.textContent = best.key || 'F';
        labelEl.textContent = best.label;
        promptEl.classList.remove('hidden');
        if (btnAct) btnAct.textContent = best.key || 'F';
      } else {
        promptEl.classList.add('hidden');
      }
      if (G.player.input.act && best) best.onUse();
    },
  };
}
