// 地形: ハイトフィールド + スプラットPBR + 遠景山稜
import * as THREE from 'three';
import { CFG, L } from '../config.js';
import { fbm, ridged, clamp, lerp, smoothstep } from '../gen/noise.js';

// ---- ポリラインへの距離 ----
function segDist(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const t = clamp(((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz || 1), 0, 1);
  const dx = px - (ax + abx * t), dz = pz - (az + abz * t);
  return Math.sqrt(dx * dx + dz * dz);
}
function polyDist(px, pz, pts) {
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    d = Math.min(d, segDist(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  }
  return d;
}

// 平地化ゾーン（建物・グラウンド）
const FLATS = [
  { x: L.school.x, z: L.school.z, w: 56, d: 30 },
  { x: L.grounds.x, z: L.grounds.z, w: L.grounds.w + 14, d: L.grounds.d + 14 },
  { x: L.gym.x, z: L.gym.z, w: L.gym.w + 10, d: L.gym.d + 10 },
  { x: L.center.x, z: L.center.z, w: L.center.w + 10, d: L.center.d + 10 },
  ...L.houses.map(([x, z]) => ({ x, z, w: 26, d: 26 })),
  ...L.greenhouses.map(([x, z]) => ({ x, z, w: 22, d: 14 })),
  { x: L.shrine.x, z: L.shrine.z, w: 16, d: 16 },
  { x: L.busStop.x, z: L.busStop.z, w: 14, d: 14 },
];

export function createTerrain(G) {
  const W = CFG.worldSize;

  // ---- 高さ関数（CPU解析的・GPU頂点とgetGroundYで共有）----
  function heightAt(x, z) {
    const dRoad = polyDist(x, z, L.roadPts);
    const dRiver = polyDist(x, z, L.riverPts);
    const dPath = Math.min(polyDist(x, z, L.pathTanaka), polyDist(x, z, L.pathYuzu));
    const dValley = Math.min(dRoad, dRiver, dPath * 1.4);

    // 丘: fbm+ridged、谷マスクで谷底はフラットに
    const base = (fbm(x / 420, z / 420, 4) * 0.5 + 0.5);
    const ridge = ridged(x / 300, z / 300, 3);
    const hill = (base * 0.7 + ridge * 0.45) * 150;
    const valley = smoothstep(55, 300, dValley);
    let h = hill * valley;

    // ゆずの丘（ゆるいマウンド +12m）
    const dy = Math.hypot(x - L.yuzuHill.x, z - L.yuzuHill.z);
    h += 12 * smoothstep(70, 0, dy) * (1 - valley * 0.5);

    // 谷底のマイクロ起伏
    h += fbm(x / 18, z / 18, 2) * 0.4 * (1 - valley);

    // 田んぼは掘り下げてフラット（水面は -0.12 に張る）
    for (const p of L.paddies) {
      const inX = smoothstep(p[2] / 2 + 3, p[2] / 2 - 1, Math.abs(x - p[0]));
      const inZ = smoothstep(p[3] / 2 + 3, p[3] / 2 - 1, Math.abs(z - p[1]));
      const m = inX * inZ;
      if (m > 0) h = lerp(h, -0.55, m);
    }
    // 建物の平地化
    for (const f of FLATS) {
      const inX = smoothstep(f.w / 2 + 8, f.w / 2 - 2, Math.abs(x - f.x));
      const inZ = smoothstep(f.d / 2 + 8, f.d / 2 - 2, Math.abs(z - f.z));
      const m = inX * inZ;
      if (m > 0) h = lerp(h, 0, m);
    }
    // 道路回廊をなだらかに
    const roadFlat = smoothstep(9, 3.2, dRoad);
    if (roadFlat > 0) h = lerp(h, h * 0.15, roadFlat);
    const pathFlat = smoothstep(5, 1.8, dPath);
    if (pathFlat > 0) h = lerp(h, h * 0.2, pathFlat);

    // 川床の彫り込み
    const riverCut = smoothstep(L.riverW * 0.5 + 4, 0, dRiver);
    h -= riverCut * 1.7;

    return h;
  }

  // ---- ジオメトリ（内周256² + 外周リング96²）----
  function buildMesh(size, seg, hole) {
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      if (hole && Math.abs(x) < hole / 2 - 1 && Math.abs(z) < hole / 2 - 1) {
        pos.setY(i, -30); // 内周の下に隠す
      } else {
        pos.setY(i, heightAt(x, z));
      }
      uv.setXY(i, x / 3, z / 3); // 1/3m リピートのワールドUV
    }
    geo.computeVertexNormals();
    return geo;
  }

  // ---- スプラット制御テクスチャ（256²、R=草 G=土 B=岩 A=林床）----
  function buildControl() {
    const S = 256;
    // 先に高さグリッドを1回だけ評価し、勾配（岩判定）に再利用する
    const Hg = new Float32Array(S * S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      Hg[j * S + i] = heightAt((i / S - 0.5) * W, (j / S - 0.5) * W);
    }
    const cell = W / S;
    const img = new ImageData(S, S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = (i / S - 0.5) * W, z = (j / S - 0.5) * W;
      const dRoad = polyDist(x, z, L.roadPts);
      const dPath = Math.min(polyDist(x, z, L.pathTanaka), polyDist(x, z, L.pathYuzu));
      const dRiver = polyDist(x, z, L.riverPts);
      const dValley = Math.min(dRoad, dRiver, dPath * 1.4);
      const valley = smoothstep(55, 300, dValley);

      let dirt = 0, rock = 0, forest = 0;
      dirt = Math.max(dirt, smoothstep(8, 3.5, dRoad) * 0.9, smoothstep(4.5, 1.6, dPath));
      if (Math.abs(x - L.grounds.x) < L.grounds.w / 2 && Math.abs(z - L.grounds.z) < L.grounds.d / 2) dirt = 1;
      if (Math.abs(x - L.tanakaField.x) < 12 && Math.abs(z - L.tanakaField.z) < 9) dirt = 1;
      for (const p of L.paddies) {
        if (Math.abs(x - p[0]) < p[2] / 2 + 1 && Math.abs(z - p[1]) < p[3] / 2 + 1) dirt = Math.max(dirt, 0.85);
      }
      dirt = Math.max(dirt, smoothstep(L.riverW * 0.5 + 5, L.riverW * 0.5, dRiver) * 0.7);
      forest = valley * 0.85;
      // 勾配はグリッドの中心差分から
      const i0 = Math.max(1, Math.min(S - 2, i)), j0 = Math.max(1, Math.min(S - 2, j));
      const gx = (Hg[j0 * S + i0 + 1] - Hg[j0 * S + i0 - 1]) / (2 * cell);
      const gz = (Hg[(j0 + 1) * S + i0] - Hg[(j0 - 1) * S + i0]) / (2 * cell);
      const slope = Math.sqrt(gx * gx + gz * gz);
      rock = smoothstep(0.55, 0.95, slope);

      const grass = Math.max(0, 1 - dirt - rock - forest);
      const sum = grass + dirt + rock + forest || 1;
      const k = (j * S + i) * 4;
      img.data[k] = grass / sum * 255;
      img.data[k + 1] = dirt / sum * 255;
      img.data[k + 2] = rock / sum * 255;
      img.data[k + 3] = forest / sum * 255;
    }
    const c = document.createElement('canvas');
    c.width = c.height = S;
    c.getContext('2d').putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.flipY = false; // ImageData座標とuvを一致させる（cuv.y側で反転処理）
    return t;
  }

  const Tx = G.tex;
  const control = buildControl();

  const mat = new THREE.MeshStandardMaterial({
    map: Tx.grass.map,
    normalMap: Tx.grass.normalMap,
    roughness: 0.95,
    metalness: 0,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uControl = { value: control };
    shader.uniforms.uDirt = { value: Tx.dirt.map };
    shader.uniforms.uRock = { value: Tx.rock.map };
    shader.uniforms.uForest = { value: Tx.forest.map };
    shader.uniforms.uMacro = { value: Tx.macro };
    shader.uniforms.uWorldSize = { value: W };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>
        uniform sampler2D uControl, uDirt, uRock, uForest, uMacro;
        uniform float uWorldSize;`)
      .replace('#include <map_fragment>', `
        vec2 wxz = vMapUv * 3.0;
        vec2 cuv = clamp(wxz / uWorldSize + 0.5, 0.0, 1.0);
        vec4 ctrl = texture2D(uControl, cuv);
        float wsum = ctrl.r + ctrl.g + ctrl.b + ctrl.a + 1e-4;
        vec3 alb = ( ctrl.r * texture2D(map, vMapUv).rgb
                   + ctrl.g * texture2D(uDirt, vMapUv).rgb
                   + ctrl.b * texture2D(uRock, vMapUv * 0.4).rgb
                   + ctrl.a * texture2D(uForest, vMapUv).rgb ) / wsum;
        float macro = texture2D(uMacro, wxz / 80.0).r * 0.35 + 0.82;
        diffuseColor.rgb *= alb * macro;
      `);
    mat.userData.shader = shader;
  };

  const inner = new THREE.Mesh(buildMesh(CFG.innerSize, 255, 0), mat);
  inner.receiveShadow = true;
  const outer = new THREE.Mesh(buildMesh(W, 95, CFG.innerSize), mat);
  outer.receiveShadow = true;
  G.scene.add(inner, outer);

  // ---- 遠景山稜リング ×2（霞んだ多重シルエット）----
  function ridgeRing(radius, hMin, hMax, color, segs = 140) {
    const positions = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
      const h = hMin + (ridged(Math.cos(a) * 3 + 7, Math.sin(a) * 3 + 7, 3)) * (hMax - hMin);
      positions.push([x, z, h]);
    }
    const verts = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const [x, z, h] = positions[i];
      verts.push(x, -20, z, x, h, z);
      if (i < segs) {
        const b = i * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    G.scene.add(m);
  }
  ridgeRing(820, 90, 260, 0x6e8398);
  ridgeRing(1230, 160, 420, 0x8aa0b5);

  G.colliders.setGround(heightAt);

  // ---- 高速サンプル用キャッシュ（植生配置用、±352mを2m格子）----
  const FS = 352, FR = 352;
  const fast = new Float32Array(FS * FS);
  for (let j = 0; j < FS; j++) for (let i = 0; i < FS; i++) {
    fast[j * FS + i] = heightAt((i / (FS - 1) - 0.5) * FR * 2, (j / (FS - 1) - 0.5) * FR * 2);
  }
  function fastY(x, z) {
    const fx = clamp((x / (FR * 2) + 0.5) * (FS - 1), 0, FS - 1.001);
    const fz = clamp((z / (FR * 2) + 0.5) * (FS - 1), 0, FS - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz);
    const u = fx - i, v = fz - j;
    return fast[j * FS + i] * (1 - u) * (1 - v) + fast[j * FS + i + 1] * u * (1 - v)
         + fast[(j + 1) * FS + i] * (1 - u) * v + fast[(j + 1) * FS + i + 1] * u * v;
  }

  return {
    heightAt, fastY,
    material: mat,
    distRoad: (x, z) => polyDist(x, z, L.roadPts),
    distRiver: (x, z) => polyDist(x, z, L.riverPts),
    distPath: (x, z) => Math.min(polyDist(x, z, L.pathTanaka), polyDist(x, z, L.pathYuzu)),
    polyDist,
  };
}
