// 物理スカイ + 太陽運行 + PMREM環境光(IBL) + フォグ
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { CFG } from '../config.js';
import { lerp, clamp } from '../gen/noise.js';

export function createSky(G) {
  const { renderer, scene } = G;

  const sky = new Sky();
  sky.scale.setScalar(8000);
  const u = sky.material.uniforms;
  u.turbidity.value = 3;
  u.rayleigh.value = 1.6;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.8;
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xfff0dd, 3.2);
  sun.castShadow = true;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 420;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xbcd8f0, 0x8a7a55, 0.25);
  scene.add(hemi);

  scene.fog = new THREE.FogExp2(0xc3d6e8, 0.0016);

  // IBL: Sky単独シーンからPMREM生成
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const skyOnly = new THREE.Scene();
  const skyClone = new Sky();
  skyClone.scale.setScalar(8000);
  skyOnly.add(skyClone);
  let envRT = null;
  let lastEnvElev = -99;

  const sunDir = new THREE.Vector3();

  const S = {
    sky, sun, hemi,
    timeOfDay: 0,        // 0..1（朝→夕）
    elevDeg: 55,

    setShadowSize(size) {
      sun.shadow.mapSize.set(size, size);
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
      const elev = lerp(55, 12, t);             // 仰角 55°→12°
      const azim = lerp(150, 245, t);           // 南東→南西
      S.elevDeg = elev;
      const phi = THREE.MathUtils.degToRad(90 - elev);
      const theta = THREE.MathUtils.degToRad(azim);
      sunDir.setFromSphericalCoords(1, phi, theta);
      u.sunPosition.value.copy(sunDir);
      skyClone.material.uniforms.sunPosition.value.copy(sunDir);
      skyClone.material.uniforms.turbidity.value = u.turbidity.value;
      skyClone.material.uniforms.rayleigh.value = lerp(1.6, 2.6, t);
      u.rayleigh.value = skyClone.material.uniforms.rayleigh.value;

      // 太陽光の色・強さ（夕方は暖色・弱め）
      const warm = new THREE.Color(0xfff0dd).lerp(new THREE.Color(0xffd0a0), t);
      sun.color.copy(warm);
      sun.intensity = lerp(3.2, 1.9, t);
      G.renderer.toneMappingExposure = lerp(0.55, 0.44, t);
      scene.fog.color.set(new THREE.Color(0xc3d6e8).lerp(new THREE.Color(0xe0c4a0), t));

      // プレイヤー追従シャドウ（テクセルスナップでシマー防止）
      if (playerPos) {
        const half = (sun.shadow.camera.right - sun.shadow.camera.left) / 2 || 60;
        const texel = (half * 2) / sun.shadow.mapSize.x;
        const sx = Math.floor(playerPos.x / texel) * texel;
        const sz = Math.floor(playerPos.z / texel) * texel;
        sun.position.set(sx + sunDir.x * 220, sunDir.y * 220, sz + sunDir.z * 220);
        sun.target.position.set(sx, 0, sz);
      }

      // 太陽が3°動くごとにIBL再生成
      if (Math.abs(elev - lastEnvElev) > 3) {
        lastEnvElev = elev;
        const old = envRT;
        envRT = pmrem.fromScene(skyOnly);
        scene.environment = envRT.texture;
        scene.environmentIntensity = lerp(0.9, 0.65, t);
        if (old) old.dispose();
        return true; // 重い処理が走ったフレーム
      }
      return false;
    },
  };

  S.setShadowArea(60);
  S.update(0, null);
  return S;
}
