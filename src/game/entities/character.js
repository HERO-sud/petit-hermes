// プロシージャル人体（カプセルベース・関節階層・歩行サイクル）
import * as THREE from 'three';

export function makeCharacter(G, o = {}) {
  const T = G.tex;
  const skinMat = new THREE.MeshStandardMaterial({ color: o.skin ?? 0xe8b890, roughness: 0.55 });
  const clothMat = new THREE.MeshStandardMaterial({
    color: o.shirt ?? 0xdfe3e8, roughness: 0.9,
    normalMap: T.fabric.normalMap, normalScale: new THREE.Vector2(0.5, 0.5),
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: o.pants ?? 0x33404e, roughness: 0.92,
    normalMap: T.fabric.normalMap, normalScale: new THREE.Vector2(0.5, 0.5),
  });
  const hairMat = new THREE.MeshStandardMaterial({ color: o.hair ?? 0x2c2018, roughness: 0.7 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: o.shoe ?? 0x3a342e, roughness: 0.6 });

  const g = new THREE.Group();

  // 胴（カプセル）
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.165, 0.42, 6, 12), clothMat);
  torso.position.y = 1.12;
  torso.scale.set(1.25, 1, 0.85);
  torso.castShadow = true;
  // 腰
  const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.12, 6, 12), pantsMat);
  hips.position.y = 0.86;
  hips.scale.set(1.2, 1, 0.9);
  hips.castShadow = true;
  // 首・頭
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.09, 10), skinMat);
  neck.position.y = 1.44;
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), skinMat);
  skull.scale.set(0.92, 1.05, 0.98);
  skull.castShadow = true;
  head.add(skull);
  // 髪（控えめ）
  const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.118, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
  hairTop.scale.set(0.95, 1.05, 1.0);
  hairTop.position.y = 0.012;
  head.add(hairTop);
  if (o.kerchief) { // 三角巾
    const kc = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.1, 4), new THREE.MeshStandardMaterial({ color: 0xfaf6ec, roughness: 0.9 }));
    kc.position.y = 0.11; kc.rotation.y = Math.PI / 4;
    head.add(kc);
  }
  if (o.strawHat) { // 麦わら帽子
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.02, 14), new THREE.MeshStandardMaterial({ color: 0xd8bd72, roughness: 0.85 }));
    brim.position.y = 0.08;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.09, 12), brim.material);
    top.position.y = 0.13;
    head.add(brim, top);
  }
  if (o.cap) {
    const cp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: o.cap, roughness: 0.8 }));
    cp.position.y = 0.03;
    const brim2 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.015, 0.09), cp.material);
    brim2.position.set(0, 0.045, 0.13);
    head.add(cp, brim2);
  }
  // 目（控えめなディテール）
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x241a12 });
  for (const ex of [-0.045, 0.045]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), eyeM);
    eye.position.set(ex, 0.01, 0.105);
    head.add(eye);
  }
  head.position.y = 1.6;

  // 腕（肩ピボット）
  const mkArm = (sx) => {
    const a = new THREE.Group();
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.24, 4, 10), clothMat);
    up.position.y = -0.16;
    up.castShadow = true;
    const lo = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.22, 4, 10), skinMat);
    lo.position.y = -0.44;
    lo.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skinMat);
    hand.position.y = -0.6;
    a.add(up, lo, hand);
    a.position.set(sx, 1.38, 0);
    a.rotation.z = sx > 0 ? -0.08 : 0.08;
    return a;
  };
  // 脚（股関節ピボット）
  const mkLeg = (sx) => {
    const l = new THREE.Group();
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 4, 10), pantsMat);
    up.position.y = -0.2;
    up.castShadow = true;
    const lo = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.28, 4, 10), pantsMat);
    lo.position.y = -0.55;
    lo.castShadow = true;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.24), shoeMat);
    shoe.position.set(0, -0.76, 0.04);
    shoe.castShadow = true;
    l.add(up, lo, shoe);
    l.position.set(sx, 0.8, 0);
    return l;
  };
  const lArm = mkArm(-0.26), rArm = mkArm(0.26);
  const lLeg = mkLeg(-0.1), rLeg = mkLeg(0.1);

  if (o.apron) {
    const ap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xf5efe2, roughness: 0.92, normalMap: T.fabric.normalMap }));
    ap.position.set(0, 1.0, 0.15);
    g.add(ap);
  }
  if (o.backpack) {
    const bp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.13),
      new THREE.MeshStandardMaterial({ color: 0x4E5D3E, roughness: 0.85, normalMap: T.fabric.normalMap }));
    bp.position.set(0, 1.18, -0.18);
    g.add(bp);
  }

  g.add(torso, hips, neck, head, lArm, rArm, lLeg, rLeg);

  let runPhase = 0;
  return {
    group: g, head, torso, lArm, rArm, lLeg, rLeg,
    // 速度に応じた歩行/走行サイクル
    animate(dt, speed, grounded, time) {
      const ratio = Math.min(speed / 6.4, 1);
      runPhase += speed * dt * 2.0;
      if (!grounded) {
        lArm.rotation.x = rArm.rotation.x = -0.5;
        lLeg.rotation.x = 0.35; rLeg.rotation.x = -0.25;
        return;
      }
      if (ratio < 0.03) {
        const b = Math.sin(time * 1.8) * 0.03;
        lArm.rotation.x = b; rArm.rotation.x = -b;
        lLeg.rotation.x = rLeg.rotation.x = 0;
        torso.rotation.x = 0;
      } else {
        const sw = Math.sin(runPhase) * (0.4 + ratio * 0.5);
        lArm.rotation.x = sw; rArm.rotation.x = -sw;
        lLeg.rotation.x = -sw * 0.9; rLeg.rotation.x = sw * 0.9;
        torso.rotation.x = ratio * 0.12;
      }
    },
    pose(p) { // 着席など
      if (p === 'sit') {
        lLeg.rotation.x = rLeg.rotation.x = -1.5;
        lArm.rotation.x = rArm.rotation.x = -0.4;
      }
    },
  };
}
