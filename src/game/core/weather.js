// 天候: 晴れ→霧→雨をゆるやかに遷移。霧密度・太陽光・背景・雨粒・風・雨音を統合制御
import * as THREE from 'three';

const PARAMS = {
  clear: { sunF: 1.0, fogF: 1.0, rain: 0, windF: 1.0, bgBlur: 0.0, bgInt: 1.0 },
  fog: { sunF: 0.55, fogF: 3.6, rain: 0, windF: 1.25, bgBlur: 0.24, bgInt: 0.72 },
  rain: { sunF: 0.42, fogF: 2.2, rain: 1, windF: 1.8, bgBlur: 0.3, bgInt: 0.58 },
};
const DUR = { clear: [110, 170], fog: [45, 75], rain: [55, 95] };

function rainStreakTexture() {
  const cv = document.createElement('canvas');
  cv.width = 8; cv.height = 32;
  const c = cv.getContext('2d');
  const grad = c.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  c.strokeStyle = grad;
  c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(4, 0); c.lineTo(4, 32); c.stroke();
  return new THREE.CanvasTexture(cv);
}

export function createWeather(G) {
  const { scene } = G;
  const cur = { ...PARAMS.clear };
  let state = 'clear';
  let hold = false;        // デバッグ/E2E用: 自動遷移停止
  let timer = 0;
  let dur = 130;

  // ---- 雨粒（Points・プレイヤー周囲の箱でラップ落下）----
  const BOX = 26, BOXY = 17;
  let points = null, posAttr = null, mat = null, count = 0;
  function buildRain(n) {
    if (points) {
      scene.remove(points);
      points.geometry.dispose();
      mat.map?.dispose();
      mat.dispose();
      points = null;
    }
    count = n;
    if (!n) return;
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() * 2 - 1) * BOX;
      arr[i * 3 + 1] = Math.random() * BOXY;
      arr[i * 3 + 2] = (Math.random() * 2 - 1) * BOX;
    }
    posAttr = new THREE.BufferAttribute(arr, 3);
    geo.setAttribute('position', posAttr);
    mat = new THREE.PointsMaterial({
      color: 0xcdd9e4, size: 0.34, map: rainStreakTexture(),
      transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
    });
    points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.visible = false;
    points.renderOrder = 5;
    scene.add(points);
  }
  buildRain(G.quality.tier.rain ?? 0);
  G.quality.onChange((t) => buildRain(t.rain ?? 0));

  function pickNext() {
    const next = state === 'clear' ? (Math.random() < 0.5 ? 'fog' : 'rain') : 'clear';
    state = next;
    const [a, b] = DUR[next];
    dur = a + Math.random() * (b - a);
    timer = 0;
  }

  const W = {
    get state() { return state; },
    get sunF() { return cur.sunF; },
    get rainAmount() { return cur.rain; },
    set(name, instant = true) {
      if (!PARAMS[name]) return;
      state = name;
      hold = true; // 手動指定後は自動遷移しない（E2E/デバッグの再現性）
      timer = 0;
      if (instant) Object.assign(cur, PARAMS[name]);
    },
    resume() { hold = false; },

    update(dt) {
      const phase = G.state.phase;
      const active = phase !== 'TITLE' && phase !== 'INTRO';
      if (active && !hold) {
        timer += dt;
        if (timer > dur) pickNext();
      }
      // 目標値へなめらかに遷移（時定数 ~7秒）
      const k = 1 - Math.exp(-dt / 7);
      const target = PARAMS[state];
      for (const key of Object.keys(cur)) cur[key] += (target[key] - cur[key]) * k;

      // 霧・背景（fog密度は品質ティア基準値×天候係数）
      if (scene.fog) scene.fog.density = G.quality.tier.fogDensity * cur.fogF;
      scene.backgroundBlurriness = cur.bgBlur;
      scene.backgroundIntensity = cur.bgInt;

      // 風と雨音
      G.vegetation?.setWind?.(cur.windF);
      G.audio?.setRain?.(cur.rain * (G.school?.isIndoors(G.player?.pos ?? { x: 0, z: 0, y: 99 }) ? 0.35 : 1));

      // 雨粒の落下とプレイヤー追従
      if (points && cur.rain > 0.02) {
        points.visible = true;
        const p = G.player?.pos;
        if (p) points.position.set(p.x, p.y, p.z);
        const indoors = p && G.school?.isIndoors(p);
        mat.opacity = (indoors ? 0 : 0.5) * cur.rain;
        const arr = posAttr.array;
        for (let i = 0; i < count; i++) {
          let y = arr[i * 3 + 1] - dt * (15 + (i % 7) * 1.6);
          if (y < 0) y += BOXY;
          arr[i * 3 + 1] = y;
        }
        posAttr.needsUpdate = true;
      } else if (points) {
        points.visible = false;
      }
    },
  };
  return W;
}
