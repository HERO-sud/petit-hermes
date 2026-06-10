// 会話UI
export function createDialog(G) {
  const dlgEl = document.getElementById('dialog');
  const nameEl = document.getElementById('dlgName');
  const textEl = document.getElementById('dlgText');
  let lines = [], idx = 0, cb = null;

  function next() {
    idx++;
    if (idx < lines.length) {
      textEl.textContent = lines[idx];
      G.audio?.sfx.talk();
    } else {
      dlgEl.classList.add('hidden');
      G.state.phase = 'PLAY';
      G.interact.setCooldown(0.35);
      const fn = cb; cb = null;
      if (fn) fn();
    }
  }

  dlgEl.addEventListener('click', next);
  addEventListener('keydown', (e) => {
    if (G.state.phase === 'DIALOG' && ['KeyF', 'KeyE', 'Space', 'Enter'].includes(e.code)) {
      e.preventDefault();
      next();
    }
  });

  return {
    start(d, onEnd) {
      G.state.phase = 'DIALOG';
      G.player.exitLock();
      lines = d.lines; idx = 0; cb = onEnd || null;
      nameEl.textContent = d.name;
      textEl.textContent = lines[0];
      dlgEl.classList.remove('hidden');
      G.audio?.sfx.talk();
    },
  };
}
