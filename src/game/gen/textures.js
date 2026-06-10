// プロシージャルPBRテクスチャ工場（外部アセットゼロ）
// 高さ場 → Sobel法線 → 高さ＋ノイズでラフネス、を共通パイプラインに
import * as THREE from 'three';
import { clamp, lerp } from './noise.js';

// ---- タイル可能な値ノイズ（シーム無しでリピートできる）----
function hash2(i, j) {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177 | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, period) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const p = period;
  const a = hash2(((xi % p) + p) % p, ((yi % p) + p) % p);
  const b = hash2((((xi + 1) % p) + p) % p, ((yi % p) + p) % p);
  const c = hash2(((xi % p) + p) % p, (((yi + 1) % p) + p) % p);
  const d = hash2((((xi + 1) % p) + p) % p, (((yi + 1) % p) + p) % p);
  return lerp(lerp(a, b, u), lerp(c, d, u), v); // 0..1
}
export function tfbm(x, y, period, oct = 4, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x * freq, y * freq, period * freq);
    norm += amp; amp *= gain; freq *= 2;
  }
  return sum / norm;
}

export function makeCanvas(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  return c;
}
export function canvasTex(canvas, { srgb = true, repeat = null, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  return t;
}

// 透明部にもRGB（背景色）を保持するカットアウトテクスチャ。
// canvasのpremultiply（透明画素のRGBが黒化）によるミップマップの黒にじみを防ぐ。
export function cutoutTexture(w, h, drawFn, bgRGB, aniso = 4) {
  const c = makeCanvas(w, h, drawFn);
  const src = c.getContext('2d').getImageData(0, 0, w, h);
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = src.data[i * 4 + 3];
    if (a < 8) {
      out[i * 4] = bgRGB[0]; out[i * 4 + 1] = bgRGB[1]; out[i * 4 + 2] = bgRGB[2]; out[i * 4 + 3] = 0;
    } else {
      out[i * 4] = src.data[i * 4]; out[i * 4 + 1] = src.data[i * 4 + 1];
      out[i * 4 + 2] = src.data[i * 4 + 2]; out[i * 4 + 3] = a;
    }
  }
  const t = new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = true;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

function dataToTex(data, size, srgb, aniso) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').putImageData(data, 0, 0);
  return canvasTex(c, { srgb, aniso });
}

// 共通パイプライン
export function makePBR(size, heightFn, albedoFn, opts = {}) {
  const { normalStrength = 1.4, roughBase = 0.85, roughVar = 0.25, aniso = 4 } = opts;
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    H[y * size + x] = heightFn(x / size, y / size);
  }
  const alb = new ImageData(size, size);
  const nrm = new ImageData(size, size);
  const rgh = new ImageData(size, size);
  const at = (x, y) => H[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const h = H[y * size + x];
    // albedo
    const [r, g, b] = albedoFn(x / size, y / size, h);
    alb.data[i] = r * 255; alb.data[i + 1] = g * 255; alb.data[i + 2] = b * 255; alb.data[i + 3] = 255;
    // Sobel normal
    const dx = (at(x + 1, y) - at(x - 1, y)) * normalStrength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * normalStrength;
    const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
    nrm.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
    nrm.data[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
    nrm.data[i + 2] = (inv * 0.5 + 0.5) * 255;
    nrm.data[i + 3] = 255;
    // roughness（凹は粗く）
    const rv = clamp(roughBase + (0.5 - h) * roughVar + (vnoise(x * 0.13, y * 0.13, 33) - 0.5) * 0.12, 0.04, 1);
    rgh.data[i] = rgh.data[i + 1] = rgh.data[i + 2] = rv * 255; rgh.data[i + 3] = 255;
  }
  return {
    map: dataToTex(alb, size, true, aniso),
    normalMap: dataToTex(nrm, size, false, aniso),
    roughnessMap: dataToTex(rgh, size, false, aniso),
  };
}

const mix3 = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

// ============================================================
// 全テクスチャの生成（起動時に1回）
// ============================================================
export function buildTextures(aniso = 4) {
  const T = {};

  // --- 地形スプラット用 4種 ---
  T.grass = makePBR(256, (x, y) => tfbm(x * 28, y * 28, 28, 4) * 0.55 + tfbm(x * 90, y * 90, 90, 2) * 0.45,
    (x, y, h) => {
      const blade = tfbm(x * 140, y * 18, 140, 2); // 縦筋
      let c = mix3([0.16, 0.26, 0.08], [0.34, 0.45, 0.16], h);
      c = mix3(c, [0.42, 0.46, 0.18], blade * 0.3);
      return c;
    }, { normalStrength: 1.0, roughBase: 0.92, roughVar: 0.1, aniso });

  T.dirt = makePBR(256, (x, y) => tfbm(x * 22, y * 22, 22, 4) * 0.6 + tfbm(x * 70, y * 70, 70, 2) * 0.4,
    (x, y, h) => mix3([0.48, 0.38, 0.26], [0.68, 0.57, 0.42], h), { normalStrength: 1.3, roughBase: 0.95, roughVar: 0.08, aniso });

  T.forest = makePBR(256, (x, y) => tfbm(x * 34, y * 34, 34, 4),
    (x, y, h) => {
      const leaf = vnoise(x * 60, y * 60, 60);
      let c = mix3([0.16, 0.12, 0.07], [0.3, 0.22, 0.12], h);
      if (leaf > 0.78) c = mix3(c, [0.45, 0.3, 0.12], 0.5); // 落ち葉
      return c;
    }, { normalStrength: 1.2, roughBase: 0.96, roughVar: 0.06, aniso });

  T.rock = makePBR(256, (x, y) => {
    let r = 0, amp = 0.55, f = 1;
    for (let i = 0; i < 4; i++) { r += amp * (1 - Math.abs(vnoise(x * 14 * f, y * 14 * f, 14 * f) * 2 - 1)); amp *= 0.5; f *= 2.1; }
    return r * 0.8;
  }, (x, y, h) => mix3([0.28, 0.27, 0.26], [0.55, 0.53, 0.5], h), { normalStrength: 2.2, roughBase: 0.88, roughVar: 0.15, aniso });

  // --- マクロ変化（低周波の色ムラ）---
  T.macro = canvasTex(makeCanvas(256, 256, (c, w, h) => {
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = (tfbm(x / w * 6, y / h * 6, 6, 3) * 0.5 + 0.5) * 255;
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }), { srgb: false, aniso: 2 });

  // --- アスファルト ---
  T.asphalt = makePBR(256, (x, y) => tfbm(x * 120, y * 120, 120, 2) * 0.5 + tfbm(x * 30, y * 30, 30, 3) * 0.5,
    (x, y, h) => {
      const speck = vnoise(x * 200, y * 200, 200);
      let v = lerp(0.16, 0.24, h);
      if (speck > 0.92) v += 0.12; // 骨材のきらつき
      return [v, v, v * 1.03];
    }, { normalStrength: 0.7, roughBase: 0.9, roughVar: 0.12, aniso });

  // --- いぶし瓦（列タイル＋釉薬の低ラフネス）---
  T.kawara = makePBR(512, (x, y) => {
    const row = (y * 9) % 1;                 // 9列
    const col = ((x * 14) + (Math.floor(y * 9) % 2) * 0.5) % 1;
    const curve = Math.sin(col * Math.PI);   // 桟の山
    const overlap = row < 0.14 ? row / 0.14 * 0.6 : 1; // 重なりの段差
    return curve * 0.55 * overlap + tfbm(x * 40, y * 40, 40, 2) * 0.12;
  }, (x, y, h) => {
    const v = lerp(0.13, 0.3, h) * (0.92 + vnoise(x * 12, y * 12, 12) * 0.16);
    return [v * 0.92, v * 0.96, v * 1.06]; // 青みがかったいぶし銀
  }, { normalStrength: 2.4, roughBase: 0.38, roughVar: 0.2, aniso });

  // --- モルタル壁（校舎クリーム）---
  T.mortar = makePBR(256, (x, y) => tfbm(x * 60, y * 60, 60, 3) * 0.3 + 0.5,
    (x, y, h) => {
      let c = mix3([0.78, 0.74, 0.64], [0.87, 0.83, 0.72], h);
      const stain = tfbm(x * 5, y * 9, 5, 2); // 雨だれ汚れ
      c = mix3(c, [0.55, 0.52, 0.45], Math.max(0, stain - 0.62) * 0.9);
      return c;
    }, { normalStrength: 0.5, roughBase: 0.85, roughVar: 0.08, aniso });

  // --- コンクリート ---
  T.concrete = makePBR(256, (x, y) => tfbm(x * 40, y * 40, 40, 3) * 0.35 + 0.5,
    (x, y, h) => { const v = lerp(0.45, 0.62, h); return [v, v, v * 0.98]; },
    { normalStrength: 0.5, roughBase: 0.88, roughVar: 0.08, aniso });

  // --- 木板 ---
  T.wood = makePBR(256, (x, y) => {
    const plank = Math.abs(((y * 6) % 1) - 0.06) < 0.045 ? 0.1 : 0.55;
    return plank + tfbm(x * 90, y * 8, 90, 2) * 0.3;
  }, (x, y, h) => {
    const grain = tfbm(x * 50, y * 5, 50, 3);
    return mix3([0.32, 0.22, 0.13], [0.55, 0.4, 0.25], grain * 0.7 + h * 0.3);
  }, { normalStrength: 1.0, roughBase: 0.7, roughVar: 0.15, aniso });

  // --- トタン波板 ---
  T.corrugated = makePBR(256, (x) => Math.sin(x * Math.PI * 24) * 0.5 + 0.5,
    (x, y, h) => {
      const rust = tfbm(x * 9, y * 9, 9, 3);
      let c = [0.6, 0.62, 0.64];
      if (rust > 0.68) c = mix3(c, [0.45, 0.25, 0.13], (rust - 0.68) * 2.4);
      return c;
    }, { normalStrength: 1.6, roughBase: 0.5, roughVar: 0.25, aniso });

  // --- 道路リボン（白線焼き込み・v方向に進む）---
  {
    const c = makeCanvas(512, 512, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const n = tfbm(x / w * 40, y / h * 40, 40, 3);
        let v = lerp(42, 62, n);
        const u = x / w;
        // 外側線（実線）
        if (Math.abs(u - 0.06) < 0.012 || Math.abs(u - 0.94) < 0.012) v = 215 - n * 30;
        // センターライン（破線）
        if (Math.abs(u - 0.5) < 0.011 && (y / h * 10) % 1 < 0.55) v = 220 - n * 30;
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v * 1.02; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    });
    T.road = canvasTex(c, { aniso });
    T.road.wrapS = THREE.ClampToEdgeWrapping;
  }

  // --- パン ---
  T.bread = makePBR(128, (x, y) => {
    const d = Math.hypot(x - 0.5, y - 0.5) * 2;
    return clamp(1 - d * d, 0, 1) * 0.7 + tfbm(x * 30, y * 30, 30, 2) * 0.25;
  }, (x, y, h) => {
    const d = Math.hypot(x - 0.5, y - 0.5) * 2;
    let c = mix3([0.62, 0.42, 0.2], [0.42, 0.24, 0.1], clamp(1.2 - d, 0, 1)); // 中央ほど濃い焼き色
    if (Math.abs(y - 0.5) < 0.035 && x > 0.2 && x < 0.8) c = [0.85, 0.72, 0.5]; // クープ
    return c;
  }, { normalStrength: 1.2, roughBase: 0.65, roughVar: 0.2, aniso });

  // --- 畳/布・衣服用の布地 ---
  T.fabric = makePBR(128, (x, y) => (Math.sin(x * 220) * Math.sin(y * 220)) * 0.5 + 0.5,
    () => [1, 1, 1], { normalStrength: 0.35, roughBase: 0.95, roughVar: 0.04, aniso: 2 });

  // --- 水面ノーマル（川・田んぼ共用）---
  {
    const size = 256;
    const img = new ImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const e = 0.004;
      const hC = tfbm(x / size * 10, y / size * 10, 10, 3);
      const hX = tfbm(x / size * 10 + e * 10, y / size * 10, 10, 3);
      const hY = tfbm(x / size * 10, y / size * 10 + e * 10, 10, 3);
      const dx = (hX - hC) * 18, dy = (hY - hC) * 18;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      img.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      img.data[i + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
    T.waterNormal = dataToTex(img, size, false, aniso);
  }

  // --- 樹木の葉クラスタ（αカットアウト・黒にじみ防止つき）---
  T.cedarLeaf = cutoutTexture(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 1100; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.6) * 60;
      const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r * 0.9;
      const g = 50 + Math.random() * 60;
      c.fillStyle = `rgba(${20 + Math.random() * 25},${g},${22 + Math.random() * 20},${0.75 + Math.random() * 0.25})`;
      c.fillRect(x, y, 2.6, 4.8);
    }
  }, [28, 64, 30], 2);
  T.pineLeaf = cutoutTexture(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 850; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.5) * 58;
      const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r * 0.7;
      const g = 62 + Math.random() * 55;
      c.save(); c.translate(x, y); c.rotate(Math.random() * 6.3);
      c.fillStyle = `rgba(${30 + Math.random() * 22},${g},${30},${0.85})`;
      c.fillRect(-1, -5, 1.8, 10); // 針葉
      c.restore();
    }
  }, [38, 76, 34], 2);

  // --- 草ブレード（細め・本数多め）---
  T.grassBlade = cutoutTexture(64, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 13; i++) {
      const bx = 3 + i * 4.5 + Math.random() * 3;
      const lean = (Math.random() - 0.5) * 16;
      const g = 88 + Math.random() * 70;
      c.strokeStyle = `rgba(${38 + Math.random() * 30},${g},${30 + Math.random() * 24},1)`;
      c.lineWidth = 1.4 + Math.random() * 1.1;
      c.beginPath();
      c.moveTo(bx, h);
      c.quadraticCurveTo(bx + lean * 0.4, h * 0.5, bx + lean, 4 + Math.random() * 26);
      c.stroke();
    }
  }, [62, 110, 48], 2);

  // --- 稲 ---
  T.riceBlade = cutoutTexture(64, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) {
      const bx = 10 + i * 7;
      const lean = (Math.random() - 0.5) * 26;
      c.strokeStyle = `rgba(${70 + Math.random() * 30},${130 + Math.random() * 50},${48},1)`;
      c.lineWidth = 2.6;
      c.beginPath();
      c.moveTo(bx, h);
      c.quadraticCurveTo(bx + lean * 0.3, h * 0.45, bx + lean, 10 + Math.random() * 18);
      c.stroke();
    }
  }, [88, 142, 52], 2);

  // --- 遠景インポスタ用の木シルエット（中身が詰まった形）---
  T.impostor = cutoutTexture(64, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    // 幹
    c.fillStyle = 'rgba(70,52,38,1)';
    c.fillRect(29, 96, 6, 32);
    // 円錐樹形（ノイズエッジ）
    for (let y = 8; y < 100; y += 3) {
      const t = (y - 8) / 92;
      const half = 4 + t * 24 + (Math.random() - 0.5) * 6;
      const g = 56 + Math.random() * 28;
      c.fillStyle = `rgba(${22 + Math.random() * 14},${g},${26 + Math.random() * 12},1)`;
      c.fillRect(32 - half, y, half * 2, 4);
    }
  }, [30, 58, 32], 2);

  return T;
}

// ---- 文字入り看板テクスチャ ----
export function textBoard(w, h, draw) {
  return canvasTex(makeCanvas(w, h, draw), { aniso: 4 });
}
