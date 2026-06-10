// 共有マテリアルファクトリ — school.js / village.js で重複していた定義を一元化。
// 意図的な色・不透明度の差は引数で残す（見た目は従来と同一）。
import * as THREE from 'three';

export function createSharedMaterials(T) {
  // トゥーン統一: 建物系はテクスチャを使わないフラットな面色（キャラ/車のローポリ素材に合わせる）
  const flat = (color, roughness = 0.9, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const M = {
    mortar: flat(0xefe8d8),         // 校舎の外壁（あたたかい生成り）
    plaster: flat(0xf7efdd),        // 農家の漆喰
    concrete: flat(0xbcb7ab),
    wood: flat(0xb98c5a, 0.85),
    darkWood: flat(0x77604c),
    kawara: flat(0x5a6b85, 0.8, 0.05),   // 釉薬瓦の青グレー
    corrugated: flat(0x9fb3bd, 0.55, 0.35),
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
