// キャラクター: トゥーン調リグ済みglTF（Quaternius UAC, CC0, アニメ内蔵）を役柄別にロードして複製。
// 読込失敗時のみ簡易プロシージャル人体にフォールバック。
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { loadGLB } from '../core/loaders.js';

const cache = new Map();    // model名 → gltf（失敗時 null）
const pending = new Map();  // model名 → Promise

export function loadCharacter(name) {
  if (cache.has(name)) return Promise.resolve(cache.get(name));
  if (!pending.has(name)) {
    pending.set(name, loadGLB(`assets/models/characters/${name}.gltf`)
      .then((g) => {
        g.scene.traverse((o) => {
          if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; }
        });
        cache.set(name, g);
        return g;
      })
      .catch((e) => {
        console.warn(`${name}.gltf の読込に失敗。簡易人体にフォールバックします:`, e.message);
        cache.set(name, null);
        return null;
      }));
  }
  return pending.get(name);
}

export function preloadCharacters(names) {
  return Promise.all(names.map(loadCharacter));
}

// アニメクリップを名前の候補（正規表現）で解決
function pickClip(animations, ...patterns) {
  for (const re of patterns) {
    const c = animations.find((a) => re.test(a.name));
    if (c) return c;
  }
  return null;
}

// ---- 役柄ごとの小物（麦わら帽・三角巾・エプロン）。トゥーン体型に合わせた寸法 ----
function buildProps(o) {
  const props = { head: [], chest: [] };
  if (o.kerchief) {
    const kc = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.13, 4),
      new THREE.MeshStandardMaterial({ color: 0xfaf6ec, roughness: 0.9 }));
    kc.rotation.y = Math.PI / 4;
    props.head.push(kc);
  }
  if (o.strawHat) {
    const m = new THREE.MeshStandardMaterial({ color: 0xd8bd72, roughness: 0.85 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.025, 14), m);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.11, 12), m);
    top.position.y = 0.06;
    props.head.push(brim, top);
  }
  if (o.apron) {
    const ap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xf5efe2, roughness: 0.92 }));
    ap.position.set(0, -0.2, 0.16);
    props.chest.push(ap);
  }
  return props;
}

function makeGLBCharacter(G, gltf, o) {
  const inner = skeletonClone(gltf.scene);
  inner.traverse((m) => {
    if (m.isMesh) { m.castShadow = true; }
  });

  // Box3 実測で身長を目標値（既定 1.66m）へ正規化
  if (!gltf.userData.rawHeight) {
    gltf.userData.rawHeight = new THREE.Box3().setFromObject(gltf.scene)
      .getSize(new THREE.Vector3()).y || 1;
  }
  const scale = (o.targetH ?? 1.66) / gltf.userData.rawHeight * (o.scale ?? 1);
  inner.scale.setScalar(scale);
  const g = new THREE.Group();
  g.add(inner);

  // アニメーション（Idle / Walk / Run / SitDown）
  const mixer = new THREE.AnimationMixer(inner);
  const idle = pickClip(gltf.animations, /^idle$/i, /idle/i);
  const walk = pickClip(gltf.animations, /^walk$/i, /^walk(?!.*carry)/i, /walk/i);
  const run = pickClip(gltf.animations, /^run$/i, /^run(?!.*carry)/i);
  const sitClip = pickClip(gltf.animations, /^sitdown$/i, /sit/i);
  const act = (clip) => {
    if (!clip) return null;
    const a = mixer.clipAction(clip);
    a.enabled = true; a.setEffectiveWeight(0); a.play();
    return a;
  };
  const aIdle = act(idle), aWalk = act(walk), aRun = act(run);
  if (aIdle) aIdle.setEffectiveWeight(1);

  // 小物をボーンに装着（ボーンのワールドスケールを打ち消して実寸配置）
  const props = buildProps(o);
  inner.updateMatrixWorld(true);
  const _ws = new THREE.Vector3();
  function attach(bone, meshes, yOff) {
    if (!bone || !meshes.length) return;
    bone.getWorldScale(_ws);
    const holder = new THREE.Group();
    holder.scale.setScalar(1 / (_ws.x || 1));
    holder.position.y = yOff * _ws.x;
    for (const mesh of meshes) holder.add(mesh);
    bone.add(holder);
  }
  attach(inner.getObjectByName('Head'), props.head, 0.22);
  attach(inner.getObjectByName('Torso'), props.chest, 0);

  let sitting = false;
  return {
    group: g,
    animate(dt, speed) {
      if (sitting) { mixer.update(dt); return; }
      const r = Math.min(speed / 6.4, 1);
      const walkW = r < 0.55 ? r / 0.55 : 1 - (r - 0.55) / 0.45;
      const runW = r > 0.55 ? (r - 0.55) / 0.45 : 0;
      const idleW = Math.max(0, 1 - r * 2.4);
      if (aIdle) aIdle.setEffectiveWeight(idleW);
      if (aWalk) {
        // Runクリップが無いモデル（子供役）は Walk を速回しして走りを代用
        aWalk.setEffectiveWeight(Math.max(0, walkW - idleW * 0.3) + (aRun ? 0 : runW));
        aWalk.setEffectiveTimeScale(0.85 + r * (aRun ? 0.5 : 1.1));
      }
      if (aRun) aRun.setEffectiveWeight(runW);
      mixer.update(dt);
    },
    pose(p) {
      if (p !== 'sit') return;
      sitting = true;
      if (sitClip) {
        for (const a of [aIdle, aWalk, aRun]) a?.fadeOut(0.2);
        const s = mixer.clipAction(sitClip);
        s.setLoop(THREE.LoopOnce, 1);
        s.clampWhenFinished = true;
        s.reset().fadeIn(0.15).play();
      } else {
        // クリップが無い場合の簡易着席（ボーン名検索・回転）
        mixer.stopAllAction();
        const rot = (re, x) => {
          for (const side of ['L', 'R']) {
            const b = inner.getObjectByName(`${re}.${side}`);
            if (b) b.rotation.x += x;
          }
        };
        rot('UpperLeg', -1.35);
        rot('LowerLeg', 1.25);
        inner.position.y = -0.22;
      }
    },
  };
}

// ---- フォールバック（GLB読込失敗時のみ）: 簡易プロシージャル人体 ----
function makeFallbackCharacter(G, o) {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: o.tint ?? 0xdfe3e8, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b890, roughness: 0.55 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 6, 12), cloth);
  torso.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), skin);
  head.position.y = 1.58;
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.6, 6, 10), cloth);
  legs.position.y = 0.5;
  torso.castShadow = head.castShadow = legs.castShadow = true;
  g.add(torso, head, legs);
  return { group: g, animate() {}, pose() {} };
}

export function makeCharacter(G, o = {}) {
  const gltf = cache.get(o.model ?? 'Casual_Male');
  return gltf ? makeGLBCharacter(G, gltf, o) : makeFallbackCharacter(G, o);
}
