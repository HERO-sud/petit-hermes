// フォトモード: PでHUD非表示+カメラ演出、Fで撮影（目標カウント）
export function createPhotoMode(G) {
  return {
    toggle() {
      if (G.state.phase === 'PLAY') {
        G.state.phase = 'PHOTO';
        G.state.photoT = 0;
        G.hud.setPhoto(true);
        G.hud.toast('📷 フォトモード（F:さつえい / P:もどる）', '');
      } else if (G.state.phase === 'PHOTO') {
        G.state.phase = 'PLAY';
        G.hud.setPhoto(false);
      }
    },
    shoot() {
      if (G.state.phase !== 'PHOTO') return;
      G.audio?.sfx.camera();
      // フラッシュ
      const f = document.getElementById('fade');
      f.style.transition = 'opacity .08s';
      f.style.opacity = '0.85';
      setTimeout(() => { f.style.opacity = '0'; setTimeout(() => f.style.transition = 'opacity 1.2s', 150); }, 90);
      G.objectives.progress('photo');
    },
  };
}
