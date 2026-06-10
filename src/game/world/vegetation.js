// 植生: 草（リング再配置＋風）・杉/赤松・遠景インポスタ・稲・竹
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { L, TIERS } from '../config.js';
import { rand, randR, seed, clamp } from '../gen/noise.js';

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

export function createVegetation(G) {
  const { scene, terrain, tex: T } = G;
  const group = new THREE.Group();
  scene.add(group);
  const windShaders = [];

  function windify(mat, strength = 1) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uWind = { value: strength };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ipos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float ph = uTime * 1.8 + ipos.x * 0.33 + ipos.z * 0.27;
          float sway = (sin(ph) * 0.06 + sin(ph * 2.33 + 1.7) * 0.03) * uWind;
          float hf = smoothstep(0.0, 1.4, transformed.y);
          transformed.x += sway * hf;
          transformed.z += sway * 0.6 * hf;
        #endif
      `);
      windShaders.push(shader);
    };
    return mat;
  }

  // 配置してよいか（道・水・建物を避ける）
  function placeOK(x, z, margin = 0) {
    if (terrain.distRoad(x, z) < 4.5 + margin) return false;
    if (terrain.distPath(x, z) < 2.5 + margin) return false;
    if (terrain.distRiver(x, z) < 7 + margin) return false;
    if (Math.abs(x - L.grounds.x) < L.grounds.w / 2 + 4 && Math.abs(z - L.grounds.z) < L.grounds.d / 2 + 4) return false;
    if (Math.abs(x - L.school.x) < 30 && Math.abs(z - L.school.z) < 18) return false;
    if (Math.abs(x - L.gym.x) < L.gym.w / 2 + 4 && Math.abs(z - L.gym.z) < L.gym.d / 2 + 4) return false;
    if (Math.abs(x - L.center.x) < L.center.w / 2 + 4 && Math.abs(z - L.center.z) < L.center.d / 2 + 4) return false;
    if (Math.abs(x - L.tanakaField.x) < 13 && Math.abs(z - L.tanakaField.z) < 10) return false;
    for (const p of L.paddies) {
      if (Math.abs(x - p[0]) < p[2] / 2 + 2 && Math.abs(z - p[1]) < p[3] / 2 + 2) return false;
    }
    for (const [hx, hz] of L.houses) {
      if (Math.abs(x - hx) < 13 && Math.abs(z - hz) < 13) return false;
    }
    return true;
  }

  const maxTier = TIERS.high;

  // ============ 草（プレイヤー周囲リング・インクリメンタル再配置） ============
  const grassGeo = mergeGeometries([
    new THREE.PlaneGeometry(0.75, 0.7).translate(0, 0.35, 0),
    new THREE.PlaneGeometry(0.75, 0.7).rotateY(Math.PI / 2).translate(0, 0.35, 0),
  ]);
  const grassMat = windify(new THREE.MeshStandardMaterial({
    map: T.grassBlade, alphaTest: 0.4, side: THREE.DoubleSide,
    roughness: 0.92, metalness: 0,
  }), 1.4);
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, maxTier.grass);
  grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  grass.frustumCulled = false;
  group.add(grass);

  let grassCount = G.quality.tier.grass;
  let grassRadius = G.quality.tier.grassRadius;
  let scatterCenter = new THREE.Vector3(1e9, 0, 1e9);
  let scatterIdx = 0;
  seed(77);

  function scatterGrassSlot(i, cx, cz) {
    // 中心から半径内の一様分布
    for (let tries = 0; tries < 4; tries++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * grassRadius;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (!placeOK(x, z)) continue;
      const y = terrain.fastY(x, z);
      if (y < -0.3 || y > 60) continue;
      const sc = randR(0.55, 1.25) * (1 - r / grassRadius * 0.45);
      _e.set(0, rand() * Math.PI, 0);
      _q.setFromEuler(_e);
      _v.set(x, y, z);
      _s.set(sc, sc * randR(0.8, 1.3), sc);
      _m4.compose(_v, _q, _s);
      grass.setMatrixAt(i, _m4);
      return;
    }
    _m4.makeScale(0, 0, 0);
    _m4.setPosition(cx, -50, cz);
    grass.setMatrixAt(i, _m4);
  }

  function updateGrass(playerPos) {
    const moved = Math.hypot(playerPos.x - scatterCenter.x, playerPos.z - scatterCenter.z);
    if (moved > grassRadius * 0.45) {
      scatterCenter.copy(playerPos);
      scatterIdx = 0; // 全体を作り直すキューを開始
    }
    if (scatterIdx < grassCount) {
      const budget = Math.min(scatterIdx + 6000, grassCount);
      for (let i = scatterIdx; i < budget; i++) scatterGrassSlot(i, scatterCenter.x, scatterCenter.z);
      scatterIdx = budget;
      grass.instanceMatrix.needsUpdate = true;
    }
  }

  // ============ 樹木（杉・赤松：幹と葉の2メッシュ×2種） ============
  // 杉: 幹 + 円錐3段（葉αテクスチャ）
  const cedarTrunk = new THREE.CylinderGeometry(0.22, 0.42, 7.2, 7).translate(0, 3.6, 0);
  const cedarLeaf = mergeGeometries([
    new THREE.ConeGeometry(2.3, 4.2, 8, 1, true).translate(0, 4.6, 0),
    new THREE.ConeGeometry(1.8, 3.6, 8, 1, true).translate(0, 6.6, 0),
    new THREE.ConeGeometry(1.2, 3.0, 8, 1, true).translate(0, 8.4, 0),
  ]);
  // 赤松: 屈曲幹 + 楕円葉クラスタ3つ
  const pineTrunk = mergeGeometries([
    new THREE.CylinderGeometry(0.18, 0.3, 4.4, 7).translate(0, 2.2, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(0.12)),
    new THREE.CylinderGeometry(0.13, 0.18, 3.4, 6).translate(0.6, 5.6, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(-0.18)),
  ]);
  const pineLeaf = mergeGeometries([
    new THREE.SphereGeometry(1.9, 8, 6).scale(1.4, 0.55, 1.2).translate(0.4, 7.0, 0),
    new THREE.SphereGeometry(1.4, 8, 6).scale(1.3, 0.5, 1).translate(-1.0, 5.9, 0.5),
    new THREE.SphereGeometry(1.2, 8, 6).scale(1.2, 0.5, 1).translate(1.6, 6.2, -0.4),
  ]);
  const barkMat = new THREE.MeshStandardMaterial({
    map: T.wood.map, normalMap: T.wood.normalMap, roughness: 0.95, color: 0x9a7a5e,
  });
  const cedarMat = windify(new THREE.MeshStandardMaterial({
    map: T.cedarLeaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9,
  }), 0.4);
  const pineMat = windify(new THREE.MeshStandardMaterial({
    map: T.pineLeaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9,
  }), 0.4);

  // 配置（丘の上＝heightAt>3 の場所、近距離 260m 以内）
  seed(31);
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < maxTier.trees && guard++ < maxTier.trees * 30) {
    const a = rand() * Math.PI * 2;
    const r = 30 + Math.pow(rand(), 0.7) * 290;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!placeOK(x, z, 2)) continue;
    const y = terrain.fastY(x, z);
    if (y < 2.5 || y > 120) continue;
    treeSpots.push([x, y, z, rand() < 0.7 ? 0 : 1, randR(0.7, 1.5), rand() * Math.PI * 2]);
  }
  const nCedar = treeSpots.filter(s => s[3] === 0).length;
  const nPine = treeSpots.length - nCedar;
  const cedarT = new THREE.InstancedMesh(cedarTrunk, barkMat, nCedar);
  const cedarL = new THREE.InstancedMesh(cedarLeaf, cedarMat, nCedar);
  const pineT = new THREE.InstancedMesh(pineTrunk, barkMat, nPine);
  const pineL = new THREE.InstancedMesh(pineLeaf, pineMat, nPine);
  cedarT.castShadow = cedarL.castShadow = pineT.castShadow = pineL.castShadow = true;
  {
    let ci = 0, pi = 0;
    const col = new THREE.Color();
    for (const [x, y, z, kind, sc, rot] of treeSpots) {
      _e.set(0, rot, 0); _q.setFromEuler(_e);
      _v.set(x, y - 0.2, z); _s.set(sc, sc * randR(0.85, 1.15), sc);
      _m4.compose(_v, _q, _s);
      col.setHSL(0.31 + randR(-0.025, 0.025), randR(0.32, 0.5), randR(0.32, 0.45));
      if (kind === 0) {
        cedarT.setMatrixAt(ci, _m4); cedarL.setMatrixAt(ci, _m4);
        cedarL.setColorAt(ci, col); ci++;
      } else {
        pineT.setMatrixAt(pi, _m4); pineL.setMatrixAt(pi, _m4);
        pineL.setColorAt(pi, col); pi++;
      }
      G.colliders.addCircle(x, z, 0.4 * sc);
    }
  }
  group.add(cedarT, cedarL, pineT, pineL);

  // ============ 遠景インポスタ（十字ビルボード） ============
  const impGeo = mergeGeometries([
    new THREE.PlaneGeometry(7, 12).translate(0, 6, 0),
    new THREE.PlaneGeometry(7, 12).rotateY(Math.PI / 2).translate(0, 6, 0),
  ]);
  const impMat = new THREE.MeshLambertMaterial({
    map: T.impostor, alphaTest: 0.35, side: THREE.DoubleSide,
  });
  const impostors = new THREE.InstancedMesh(impGeo, impMat, maxTier.impostors);
  impostors.frustumCulled = false;
  seed(57);
  {
    let placed = 0, guard2 = 0;
    while (placed < maxTier.impostors && guard2++ < maxTier.impostors * 25) {
      const a = rand() * Math.PI * 2;
      const r = 180 + Math.pow(rand(), 0.8) * 380;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = terrain.heightAt(x, z);
      if (y < 4) continue;
      const sc = randR(0.8, 1.8);
      _e.set(0, rand() * Math.PI, 0); _q.setFromEuler(_e);
      _v.set(x, y - 0.5, z); _s.set(sc, sc, sc);
      _m4.compose(_v, _q, _s);
      impostors.setMatrixAt(placed, _m4);
      placed++;
    }
    impostors.count = placed;
  }
  group.add(impostors);

  // ============ 稲（畦の中に整列） ============
  const riceGeo = mergeGeometries([
    new THREE.PlaneGeometry(0.45, 0.55).translate(0, 0.27, 0),
    new THREE.PlaneGeometry(0.45, 0.55).rotateY(Math.PI / 2).translate(0, 0.27, 0),
  ]);
  const riceMat = windify(new THREE.MeshStandardMaterial({
    map: T.riceBlade, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9,
  }), 1.0);
  const rice = new THREE.InstancedMesh(riceGeo, riceMat, maxTier.rice);
  rice.frustumCulled = false;
  seed(91);
  {
    // 全田んぼのセルを集めてシャッフル → どのティアでも全域に均一分布
    const cells = [];
    for (const [px, pz, pw, pd] of L.paddies) {
      for (let gz = -pd / 2 + 2; gz < pd / 2 - 2; gz += 0.95) {
        for (let gx = -pw / 2 + 2; gx < pw / 2 - 2; gx += 0.8) {
          cells.push([px + gx, pz + gz]);
        }
      }
    }
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    const n = Math.min(maxTier.rice, cells.length);
    for (let i = 0; i < n; i++) {
      const [cx, cz] = cells[i];
      _e.set(0, rand() * Math.PI, 0); _q.setFromEuler(_e);
      const sc = randR(0.85, 1.15);
      _v.set(cx + randR(-0.12, 0.12), -0.34, cz + randR(-0.12, 0.12));
      _s.set(sc, sc, sc);
      _m4.compose(_v, _q, _s);
      rice.setMatrixAt(i, _m4);
    }
    rice.count = n;
  }
  group.add(rice);

  // ============ 竹林 ============
  const bambooGeo = mergeGeometries([0, 1, 2, 3].map(k =>
    new THREE.CylinderGeometry(0.07 - k * 0.008, 0.08 - k * 0.008, 2.2, 6).translate(0, 1.1 + k * 2.15, 0)
  ));
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x6a8c3c, roughness: 0.55 });
  const bamboo = new THREE.InstancedMesh(bambooGeo, bambooMat, maxTier.bamboo);
  bamboo.castShadow = true;
  seed(13);
  for (let i = 0; i < maxTier.bamboo; i++) {
    const x = L.bamboo.x + randR(-16, 16), z = L.bamboo.z + randR(-14, 14);
    const y = terrain.fastY(x, z);
    _e.set(randR(-0.04, 0.04), rand() * Math.PI, randR(-0.04, 0.04)); _q.setFromEuler(_e);
    const sc = randR(0.7, 1.3);
    _v.set(x, y, z); _s.set(sc, sc, sc);
    _m4.compose(_v, _q, _s);
    bamboo.setMatrixAt(i, _m4);
  }
  group.add(bamboo);

  // ============ ティア切替 ============
  function applyTier(t) {
    grassCount = t.grass;
    grassRadius = t.grassRadius;
    grass.count = t.grass;
    scatterCenter.set(1e9, 0, 1e9); // 再配置
    cedarT.count = Math.round(nCedar * t.trees / maxTier.trees);
    cedarL.count = cedarT.count;
    pineT.count = Math.round(nPine * t.trees / maxTier.trees);
    pineL.count = pineT.count;
    impostors.count = Math.min(impostors.instanceMatrix.count, t.impostors);
    rice.count = Math.min(rice.instanceMatrix.count, t.rice);
    bamboo.count = t.bamboo;
  }
  applyTier(G.quality.tier);
  G.quality.onChange(applyTier);

  return {
    counts: () => ({ grass: grass.count, trees: cedarT.count + pineT.count, rice: rice.count, impostors: impostors.count }),
    update(dt, playerPos) {
      for (const s of windShaders) s.uniforms.uTime.value += dt;
      updateGrass(playerPos);
    },
  };
}
