// キャラクター: 実写系リグ済みGLB（Mixamoアニメ内蔵）を共有ソースから複製。
// GLB読込失敗時のみ簡易プロシージャル人体にフォールバック。
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { loadGLB } from '../core/loaders.js';

let baseGLTF = null;

export async function preloadCharacter() {
  try {
    baseGLTF = await loadGLB('assets/models/character.glb');
    baseGLTF.scene.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; }
    });
  } catch (e) {
    console.warn('character.glb の読込に失敗。簡易人体にフォールバックします:', e.message);
    baseGLTF = null;
  }
}

// ---- 役柄ごとの小物（帽子・三角巾・麦わら帽・エプロン）----
function buildProps(G, o) {
  const T = G.tex;
  const props = { head: [], chest: [] };
  if (o.kerchief) {
    const kc = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.1, 4),
      new THREE.MeshStandardMaterial({ color: 0xfaf6ec, roughness: 0.9 }));
    kc.rotation.y = Math.PI / 4;
    kc.position.y = 0.12;
    props.head.push(kc);
  }
  if (o.strawHat) {
    const m = new THREE.MeshStandardMaterial({ color: 0xd8bd72, roughness: 0.85 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.02, 14), m);
    brim.position.y = 0.09;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.09, 12), m);
    top.position.y = 0.14;
    props.head.push(brim, top);
  }
  if (o.cap) {
    const m = new THREE.MeshStandardMaterial({ color: o.cap, roughness: 0.8 });
    const cp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), m);
    cp.position.y = 0.05;
    const brim2 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.015, 0.09), m);
    brim2.position.set(0, 0.065, 0.13);
    props.head.push(cp, brim2);
  }
  if (o.apron) {
    const ap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.46, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xf5efe2, roughness: 0.92, normalMap: T.fabric.normalMap }));
    ap.position.set(0, -0.18, 0.13);
    props.chest.push(ap);
  }
  return props;
}

function makeGLBCharacter(G, o) {
  const inner = skeletonClone(baseGLTF.scene);
  // マテリアルを役柄ごとに複製してティント（軍装感を弱め作業着風に）
  inner.traverse((m) => {
    if (m.isMesh) {
      m.material = m.material.clone();
      if (o.tint) m.material.color = new THREE.Color(o.tint);
      m.material.roughness = Math.min(1, (m.material.roughness ?? 0.9) * 1.05);
      m.castShadow = true;
    }
  });
  // 元モデルは-Z向きのためラッパーで+Z向きに統一（既存のyaw計算と互換）
  inner.rotation.y = Math.PI;
  const scale = o.scale ?? 0.93;
  inner.scale.setScalar(scale);
  const g = new THREE.Group();
  g.add(inner);

  // アニメーション（Idle / Walk / Run）
  const mixer = new THREE.AnimationMixer(inner);
  const actions = {};
  for (const clip of baseGLTF.animations) {
    actions[clip.name] = mixer.clipAction(clip);
  }
  const idle = actions.Idle, walk = actions.Walk, run = actions.Run;
  for (const a of [idle, walk, run]) if (a) { a.enabled = true; a.setEffectiveWeight(0); a.play(); }
  if (idle) idle.setEffectiveWeight(1);

  // 小物をボーンに装着（スケール補正つき）
  const props = buildProps(G, o);
  inner.updateMatrixWorld(true);
  const headBone = inner.getObjectByName('mixamorigHead');
  const spineBone = inner.getObjectByName('mixamorigSpine2') || inner.getObjectByName('mixamorigSpine1');
  const _ws = new THREE.Vector3();
  function attach(bone, meshes, yOff) {
    if (!bone || !meshes.length) return;
    bone.getWorldScale(_ws);
    const inv = 1 / (_ws.x * (1 / scale)) / scale; // ボーンのワールドスケールを打ち消す
    for (const mesh of meshes) {
      const holder = new THREE.Group();
      holder.scale.setScalar(inv);
      mesh.position.y += yOff;
      holder.add(mesh);
      bone.add(holder);
    }
  }
  attach(headBone, props.head, 0.06);
  attach(spineBone, props.chest, 0);

  let sitting = false;
  return {
    group: g,
    animate(dt, speed, grounded) {
      if (sitting) { mixer.update(dt * 0.2); return; }
      const r = Math.min(speed / 6.4, 1);
      const walkW = r < 0.55 ? r / 0.55 : 1 - (r - 0.55) / 0.45;
      const runW = r > 0.55 ? (r - 0.55) / 0.45 : 0;
      const idleW = Math.max(0, 1 - r * 2.4);
      if (idle) idle.setEffectiveWeight(idleW);
      if (walk) { walk.setEffectiveWeight(Math.max(0, walkW - idleW * 0.3)); walk.setEffectiveTimeScale(0.85 + r * 0.5); }
      if (run) run.setEffectiveWeight(runW);
      mixer.update(dt);
    },
    pose(p) {
      if (p === 'sit') {
        sitting = true;
        for (const a of [idle, walk, run]) if (a) a.setEffectiveWeight(a === idle ? 1 : 0);
        // 簡易着席: 腰を落とし腿を上げる
        const lu = inner.getObjectByName('mixamorigLeftUpLeg');
        const ru = inner.getObjectByName('mixamorigRightUpLeg');
        const ll = inner.getObjectByName('mixamorigLeftLeg');
        const rl = inner.getObjectByName('mixamorigRightLeg');
        if (lu && ru) {
          mixer.stopAllAction();
          lu.rotation.x -= 1.35; ru.rotation.x -= 1.35;
          if (ll) ll.rotation.x += 1.25;
          if (rl) rl.rotation.x += 1.25;
          inner.position.y = -0.22;
        }
      }
    },
  };
}

// ---- フォールバック（GLB読込失敗時のみ）: 旧プロシージャル人体の簡易版 ----
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
  return baseGLTF ? makeGLBCharacter(G, o) : makeFallbackCharacter(G, o);
}
