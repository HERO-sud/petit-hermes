// 共有マテリアルファクトリ — school.js / village.js で重複していた定義を一元化。
// 意図的な色・不透明度の差は引数で残す（見た目は従来と同一）。
import * as THREE from 'three';

export function createSharedMaterials(T) {
  const M = {
    mortar: new THREE.MeshStandardMaterial({
      map: T.mortar.map, normalMap: T.mortar.normalMap, roughnessMap: T.mortar.roughnessMap,
      roughness: 1, metalness: 0,
    }),
    plaster: new THREE.MeshStandardMaterial({
      map: T.mortar.map, normalMap: T.mortar.normalMap, roughness: 0.9, color: 0xf2ede2,
    }),
    concrete: new THREE.MeshStandardMaterial({
      map: T.concrete.map, normalMap: T.concrete.normalMap, roughness: 0.9,
    }),
    wood: new THREE.MeshStandardMaterial({
      map: T.wood.map, normalMap: T.wood.normalMap, roughnessMap: T.wood.roughnessMap, roughness: 1,
    }),
    darkWood: new THREE.MeshStandardMaterial({
      map: T.wood.map, normalMap: T.wood.normalMap, roughness: 0.9, color: 0x6a584a,
    }),
    kawara: new THREE.MeshStandardMaterial({
      map: T.kawara.map, normalMap: T.kawara.normalMap, roughnessMap: T.kawara.roughnessMap,
      roughness: 1, metalness: 0.08,
    }),
    corrugated: new THREE.MeshStandardMaterial({
      map: T.corrugated.map, normalMap: T.corrugated.normalMap, roughness: 0.5, metalness: 0.4,
    }),
    bread: new THREE.MeshStandardMaterial({
      map: T.bread.map, normalMap: T.bread.normalMap, roughnessMap: T.bread.roughnessMap, roughness: 1,
    }),
    glass(color = 0x8fb0c0, opacity = 0.4) {
      return new THREE.MeshPhysicalMaterial({
        color, roughness: 0.06, metalness: 0, transparent: true, opacity, envMapIntensity: 1.6,
      });
    },
    sash(color = 0x3c4248) {
      return new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.55 });
    },
  };
  return M;
}
