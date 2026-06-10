// 実写HDRIによる空・環境光(IBL) + 太陽光（影）
// quarry_01（Poly Haven CC0 / three.js examples 同梱）を背景とIBLに使用。
// 時刻サイクルは「実写の見た目」を最優先し、影の角度と露出のゆるやかな変化のみ行う。
import * as THREE from 'three';
import { CFG } from '../config.js';
import { lerp, clamp } from '../gen/noise.js';
import { loadHDR } from './loaders.js';

export async function createSky(G) {
  const { renderer, scene } = G;

  // ---- HDRI: 背景 + IBL（起動時に1回だけPMREM）----
  const hdr = await loadHDR('assets/hdri/morning_1k.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromEquirectangular(hdr);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 1.0;
  scene.background = hdr;
  scene.backgroundIntensity = 1.0;
  scene.backgroundBlurriness = 0.0;
  // HDRIの方位をワールドに合わせる（太陽が南東上空に来るよう回転）
  scene.backgroundRotation = new THREE.Euler(0, CFG.hdriRotationY, 0);
  scene.environmentRotation = new THREE.Euler(0, CFG.hdriRotationY, 0);
  pmrem.dispose();

  renderer.toneMappingExposure = 1.0;

  // ---- 太陽光（影用）。HDRIの太陽位置に合わせて配置 ----
  const sun = new THREE.DirectionalLight(0xfff2e0, 2.6);
  sun.castShadow = true;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 420;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xbcd8f0, 0x8a7a55, 0.3);
  scene.add(hemi);
  scene.environmentIntensity = 1.15;

  scene.fog = new THREE.FogExp2(0xcfdce8, 0.0016);

  const sunDir = new THREE.Vector3();

  const S = {
    sun, hemi,
    timeOfDay: 0, // 0..1（朝→夕。見た目はHDRI固定、影と露出のみ変化）
    elevDeg: 48,

    setShadowSize(size) {
      sun.shadow.mapSize.set(size, size);
      // アクネ防止: シャドウテクセルのワールドサイズに比例した法線バイアス
      const half = (sun.shadow.camera.right - sun.shadow.camera.left) / 2 || 60;
      sun.shadow.normalBias = (half * 2 / size) * 1.8;
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    },
    setShadowArea(half) {
      const c = sun.shadow.camera;
      c.left = -half; c.right = half; c.top = half; c.bottom = -half;
      c.updateProjectionMatrix();
    },

    update(dt, playerPos) {
      S.timeOfDay = clamp(S.timeOfDay + dt / CFG.dayLengthSec, 0, 1);
      const t = S.timeOfDay;
      // 日の出HDRIに合わせた低めの太陽（朝の長い影）
      const elev = lerp(16, 34, t);
      const azim = lerp(125, 195, t);
      S.elevDeg = elev;
      const phi = THREE.MathUtils.degToRad(90 - elev);
      const theta = THREE.MathUtils.degToRad(azim);
      sunDir.setFromSphericalCoords(1, phi, theta);
      sun.color.set(new THREE.Color(0xffe2b8).lerp(new THREE.Color(0xfff0dd), t));
      // 天候による減光（曇天・雨で太陽光と露出を落とす）
      const wf = G.weather?.sunF ?? 1;
      sun.intensity = lerp(2.4, 2.8, t) * wf;
      G.renderer.toneMappingExposure = lerp(1.05, 0.95, t) * (0.82 + 0.18 * wf);

      // プレイヤー追従シャドウ（テクセルスナップでシマー防止）
      if (playerPos) {
        const half = (sun.shadow.camera.right - sun.shadow.camera.left) / 2 || 60;
        const texel = (half * 2) / sun.shadow.mapSize.x;
        const sx = Math.floor(playerPos.x / texel) * texel;
        const sz = Math.floor(playerPos.z / texel) * texel;
        sun.position.set(sx + sunDir.x * 220, sunDir.y * 220, sz + sunDir.z * 220);
        sun.target.position.set(sx, 0, sz);
      }
      return false; // HDRIは固定なので重い再生成フレームは存在しない
    },
  };

  S.setShadowArea(60);
  S.update(0, null);
  return S;
}
