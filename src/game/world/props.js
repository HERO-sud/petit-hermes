// 配置用GLBプロップ（車・建物など）: 事前ロード＋実寸スケール設置ヘルパー
import * as THREE from 'three';
import { loadGLB } from '../core/loaders.js';

const URLS = {
  truckFlat: 'assets/models/market/truck-flat/model.gltf', // 軽トラ風平ボディ
  carSedan: 'assets/models/kaykit/car_sedan.gltf',
  carHatchback: 'assets/models/kaykit/car_hatchback.gltf',
  carTaxi: 'assets/models/kaykit/car_taxi.gltf',
  buildingB: 'assets/models/kaykit/building_B.gltf',
  buildingD: 'assets/models/kaykit/building_D.gltf',
  buildingF: 'assets/models/kaykit/building_F.gltf',
};

const cache = new Map(); // key → gltf.scene（失敗時 null）

export async function preloadProps() {
  await Promise.all(Object.entries(URLS).map(async ([key, url]) => {
    try {
      const g = await loadGLB(url);
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        // transmission(物理ガラス)はシーン全体の追加描画パスを強制し激重 → 軽量な半透明へ置換
        if (o.material?.transmission > 0) {
          o.material = new THREE.MeshStandardMaterial({
            color: o.material.color, roughness: 0.15, metalness: 0.1,
            transparent: true, opacity: 0.55,
          });
        }
      });
      cache.set(key, g.scene);
    } catch (e) {
      console.warn(`プロップ ${key} の読込に失敗（手組みで代替）:`, e.message);
      cache.set(key, null);
    }
  }));
  return cache;
}

export function hasProp(key) { return !!cache.get(key); }

// 実寸スケールで設置: targetL=全長(Z) または targetW=全幅(X) を指定
export function placeProp(G, key, { x, z, ry = 0, targetL, targetW, colliderBox, yOff = 0 }) {
  const src = cache.get(key);
  if (!src) return null;
  const obj = src.clone(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = targetL ? targetL / (size.z || 1) : targetW ? targetW / (size.x || 1) : 1;
  obj.scale.setScalar(s);
  obj.position.set(x, G.terrain.heightAt(x, z) - box.min.y * s + yOff, z);
  obj.rotation.y = ry;
  G.scene.add(obj);
  if (colliderBox) G.colliders.addBox(x, z, colliderBox[0], colliderBox[1]);
  return obj;
}
