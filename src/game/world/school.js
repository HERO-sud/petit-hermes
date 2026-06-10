// 旧南方小学校（パン屋・教室カフェ）・体育館・南方総合センター・グラウンド
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { L } from '../config.js';
import { textBoard } from '../gen/textures.js';

export function createSchool(G) {
  const { scene, tex: T, colliders } = G;
  const g = new THREE.Group();
  scene.add(g);

  const S = L.school; // 中心(0,-60) 36×9、南面 z=-55.5
  const zF = S.z + S.d / 2, zB = S.z - S.d / 2;
  const xL = S.x - S.w / 2, xR = S.x + S.w / 2;
  const H1 = 3.3, H = S.h;

  const wallMat = new THREE.MeshStandardMaterial({
    map: T.mortar.map, normalMap: T.mortar.normalMap, roughnessMap: T.mortar.roughnessMap,
    roughness: 1, metalness: 0,
  });
  const concMat = new THREE.MeshStandardMaterial({
    map: T.concrete.map, normalMap: T.concrete.normalMap, roughness: 0.9,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: T.wood.map, normalMap: T.wood.normalMap, roughnessMap: T.wood.roughnessMap, roughness: 1,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x8fb0c0, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.4,
    envMapIntensity: 1.6,
  });
  const sashMat = new THREE.MeshStandardMaterial({ color: 0x3c4248, roughness: 0.45, metalness: 0.55 });
  const breadMat = new THREE.MeshStandardMaterial({
    map: T.bread.map, normalMap: T.bread.normalMap, roughnessMap: T.bread.roughnessMap, roughness: 1,
  });

  function wall(cx, cy, cz, sx, sy, sz, collide = true, mat = wallMat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(cx, cy, cz);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    if (collide) colliders.addBox(cx, cz, sx, sz);
    return m;
  }
  function windowUnit(x, y, z, w, h, ry = 0) {
    const u = new THREE.Group();
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), sashMat);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, h - 0.12), glassMat);
    gl.position.z = 0.05;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, h - 0.1, 0.1), sashMat);
    u.add(fr, gl, bar);
    u.position.set(x, y, z);
    u.rotation.y = ry;
    g.add(u);
  }

  // ---- 外壁 ----
  // 正面1F: 開口 = パン屋ドア x[7.2,8.8] / カフェ大窓 x[-10,-2] / 昇降口 x[-1,1]
  wall((xL + (-10)) / 2, H1 / 2, zF, (-10) - xL, H1, 0.3);
  wall((-2 + 7.2) / 2 + 0.0, H1 / 2, zF, 7.2 - (-2), H1, 0.3);
  wall((8.8 + xR) / 2, H1 / 2, zF, xR - 8.8, H1, 0.3);
  wall(-6, 0.45, zF, 8, 0.9, 0.3);              // カフェ窓腰壁
  wall(-6, 3.0, zF, 8, 0.6, 0.3, false);        // カフェ窓上枠
  wall(8, 2.95, zF, 1.6, 0.7, 0.3, false);      // ドア上
  // カフェ大窓ガラス
  const cafeGlass = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 1.7), glassMat);
  cafeGlass.position.set(-6, 1.78, zF + 0.02);
  g.add(cafeGlass);
  // 2F帯 + 屋上パラペット
  wall(S.x, H1 + (H - H1) / 2, zF, S.w, H - H1, 0.3, false);
  wall(S.x, H + 0.3, zF, S.w, 0.6, 0.3, false);
  wall(S.x, H + 0.3, zB, S.w, 0.6, 0.3, false);
  // 背面・側面
  wall(S.x, H / 2, zB, S.w, H, 0.3);
  wall(xL, H / 2, S.z, 0.3, H, S.d);
  wall(xR, H / 2, S.z, 0.3, H, S.d);
  // 屋上スラブ・1F天井
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(S.w + 0.6, 0.25, S.d + 0.6), concMat);
  roofSlab.position.set(S.x, H, S.z);
  roofSlab.castShadow = true;
  g.add(roofSlab);
  const ceil1 = new THREE.Mesh(new THREE.BoxGeometry(S.w, 0.2, S.d), concMat);
  ceil1.position.set(S.x, H1 + 0.1, S.z);
  g.add(ceil1);
  // 屋上フェンス
  {
    const fGeos = [];
    for (let x = -S.w / 2; x <= S.w / 2; x += 2.2) {
      fGeos.push(new THREE.BoxGeometry(0.05, 1.0, 0.05).translate(S.x + x, H + 0.5, zF - 0.1));
      fGeos.push(new THREE.BoxGeometry(0.05, 1.0, 0.05).translate(S.x + x, H + 0.5, zB + 0.1));
    }
    fGeos.push(new THREE.BoxGeometry(S.w, 0.05, 0.05).translate(S.x, H + 0.95, zF - 0.1));
    fGeos.push(new THREE.BoxGeometry(S.w, 0.05, 0.05).translate(S.x, H + 0.95, zB + 0.1));
    g.add(new THREE.Mesh(mergeGeometries(fGeos), sashMat));
  }

  // ---- 窓（2F全面・1Fは部屋の無い区画）----
  for (let x = -16; x <= 16; x += 3.2) {
    windowUnit(S.x + x, H1 + 1.9, zF + 0.18, 2.4, 1.7);
    if (x < -11.5 || (x > 2.5 && x < 6) || x > 10.5) windowUnit(S.x + x, 1.9, zF + 0.18, 2.4, 1.6);
  }
  // 時計
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24),
    new THREE.MeshStandardMaterial({ map: textBoard(128, 128, (c, w, h) => {
      c.fillStyle = '#f4f2ea'; c.beginPath(); c.arc(64, 64, 62, 0, 7); c.fill();
      c.strokeStyle = '#333'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 22); c.stroke();
      c.beginPath(); c.moveTo(64, 64); c.lineTo(92, 76); c.stroke();
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        c.fillStyle = '#333';
        c.fillRect(64 + Math.cos(a) * 54 - 2, 64 + Math.sin(a) * 54 - 2, 4, 4);
      }
    }), roughness: 0.4 }));
  clock.position.set(S.x, H - 0.9, zF + 0.17);
  g.add(clock);

  // ---- 昇降口ポーチ（中央・閉鎖）----
  wall(0, 1.5, zF + 0.5, 3.2, 3.0, 1.2);
  const porchDoor = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.3, 0.1), sashMat);
  porchDoor.position.set(0, 1.15, zF + 1.12);
  g.add(porchDoor);
  const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 2.0), concMat);
  porchRoof.position.set(0, 3.15, zF + 0.8);
  porchRoof.castShadow = true;
  g.add(porchRoof);
  // 校名プレート
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.6),
    new THREE.MeshStandardMaterial({ map: textBoard(96, 320, (c, w, h) => {
      c.fillStyle = '#ece8dc'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#8a8678'; c.lineWidth = 5; c.strokeRect(3, 3, w - 6, h - 6);
      c.fillStyle = '#2c2a24'; c.textAlign = 'center';
      c.font = '900 44px serif';
      const s = '旧南方小学校';
      for (let i = 0; i < s.length; i++) c.fillText(s[i], w / 2, 52 + i * 46);
    }), roughness: 0.6 }));
  plate.position.set(2.1, 1.7, zF + 1.13);
  g.add(plate);

  // ---- 店舗看板（パン屋入口の上）----
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.8),
    new THREE.MeshStandardMaterial({ map: textBoard(512, 114, (c, w, h) => {
      c.fillStyle = '#f7f3ea'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#4E5D3E'; c.lineWidth = 6; c.strokeRect(4, 4, w - 8, h - 8);
      c.fillStyle = '#3A4A2F'; c.textAlign = 'center';
      c.font = '700 46px serif';
      c.fillText('プチヘルメース', w / 2 - 30, 62);
      c.font = '24px system-ui'; c.fillText('🍞', w - 60, 60);
      c.fillStyle = '#A67C52'; c.font = '600 18px system-ui, sans-serif';
      c.fillText('petit hermes — 自家製天然酵母パン', w / 2, 96);
    }), roughness: 0.55 }));
  sign.position.set(8, 3.6, zF + 0.18);
  g.add(sign);

  // ---- 室内（パン屋 x[2,14] / カフェ x[-11,1.5]）----
  // 床は実写の木目（読込成功時）
  const floorMat = G.tex.hardwood
    ? new THREE.MeshStandardMaterial({
        map: G.tex.hardwood.map, bumpMap: G.tex.hardwood.bumpMap, bumpScale: 0.6,
        roughnessMap: G.tex.hardwood.roughnessMap, roughness: 1, metalness: 0,
      })
    : woodMat;
  const inFloor = new THREE.Mesh(new THREE.PlaneGeometry(26, S.d - 0.6), floorMat);
  inFloor.rotation.x = -Math.PI / 2;
  inFloor.position.set(1.5, 0.06, S.z);
  inFloor.receiveShadow = true;
  g.add(inFloor);
  // 間仕切り
  wall(14.5, H1 / 2, S.z, 0.25, H1, S.d);                 // 東キャップ
  wall(-11.5, H1 / 2, S.z, 0.25, H1, S.d);                // 西キャップ
  wall(1.8, H1 / 2, S.z - 2.4, 0.25, H1, S.d - 4.6);      // パン屋⇔カフェ（通路は南側）
  // パン屋のドア（自動）
  const door = new THREE.Group();
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.25, 0.07), woodMat);
  doorPanel.position.x = 0.75;
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), glassMat);
  doorGlass.position.set(0.75, 0.35, 0.05);
  door.add(doorPanel, doorGlass);
  door.position.set(7.25, 1.13, zF);
  g.add(door);

  // パン屋内装
  const counter = wall(8, 0.55, zF - 2.6, 4.6, 1.1, 0.9, true, woodMat);
  counter.material = woodMat;
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.06, 1.1), woodMat);
  counterTop.position.set(8, 1.13, zF - 2.6);
  g.add(counterTop);
  wall(8, 1.1, zB + 0.55, 5.6, 2.2, 0.5, true, woodMat);  // 背面棚
  // 陳列パン（インスタンス）
  {
    const breadGeo = new THREE.SphereGeometry(0.16, 10, 8);
    breadGeo.scale(1.4, 0.75, 0.95);
    const breads = new THREE.InstancedMesh(breadGeo, breadMat, 40);
    const m4 = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion();
    let i = 0;
    for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) {
      e.set(0, Math.random() * Math.PI, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(5.6 + k * 0.92, 1.05 + r * 0.78, zB + 0.62), q, new THREE.Vector3(1, 1, 1));
      breads.setMatrixAt(i++, m4);
    }
    for (let k = 0; k < 5; k++) {
      e.set(0, Math.random() * Math.PI, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(6.3 + k * 0.85, 1.27, zF - 2.6), q, new THREE.Vector3(0.9, 0.9, 0.9));
      breads.setMatrixAt(i++, m4);
    }
    breads.count = i;
    g.add(breads);
  }
  // 黒板メニュー
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.9),
    new THREE.MeshStandardMaterial({ map: textBoard(512, 304, (c, w, h) => {
      c.fillStyle = '#6a5238'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#2c4234'; c.fillRect(12, 12, w - 24, h - 24);
      c.fillStyle = '#f4efe0'; c.textAlign = 'center';
      c.font = '700 32px serif'; c.fillText('きょうのパン', w / 2, 58);
      c.font = '600 22px system-ui, sans-serif'; c.fillStyle = '#ffe9b0';
      c.fillText('プチカンパーニュ 各¥600', w / 2, 108);
      c.fillText('食パン ¥700 ・ フォカッチャ ¥450', w / 2, 146);
      c.fillText('コンフィチュール ・ コーヒー', w / 2, 184);
      c.fillStyle = '#bfe6a0'; c.font = '600 19px system-ui, sans-serif';
      c.fillText('きょうの酵母：ゆず', w / 2, 230);
      c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '600 14px system-ui, sans-serif';
      c.fillText('今日のパンが、明日の野菜に。', w / 2, 272);
    }), roughness: 0.85 }));
  board.position.set(8, 2.25, zB + 0.82);
  g.add(board);
  // 薪オーブン・酵母瓶
  wall(13, 1.05, zB + 1.0, 1.8, 2.1, 1.4, true, concMat);
  const ovenMouth = new THREE.Mesh(new THREE.CircleGeometry(0.4, 14),
    new THREE.MeshBasicMaterial({ color: 0xff7a26 }));
  ovenMouth.position.set(13, 0.85, zB + 1.72);
  g.add(ovenMouth);
  {
    const jarMat = new THREE.MeshPhysicalMaterial({ color: 0xd9c79a, roughness: 0.15, transparent: true, opacity: 0.7 });
    for (let i = 0; i < 3; i++) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.36, 10), jarMat);
      jar.position.set(2.6 + i * 0.4, 1.35, zB + 0.6);
      g.add(jar);
    }
  }
  // 店内のあたたかい光（×2）+ カフェ側
  for (const lx of [6, 10]) {
    const pl = new THREE.PointLight(0xffc890, 10, 10, 1.7);
    pl.position.set(lx, 2.7, S.z + 0.5);
    g.add(pl);
  }
  const cafeLight = new THREE.PointLight(0xffd9b0, 8, 10, 1.7);
  cafeLight.position.set(-6, 2.7, S.z);
  g.add(cafeLight);

  // カフェ内装（机・椅子）
  {
    const deskGeo = new THREE.BoxGeometry(1.1, 0.04, 0.75).translate(0, 0.72, 0);
    const legGeo = mergeGeometries([
      new THREE.CylinderGeometry(0.02, 0.02, 0.72, 6).translate(-0.48, 0.36, -0.3),
      new THREE.CylinderGeometry(0.02, 0.02, 0.72, 6).translate(0.48, 0.36, -0.3),
      new THREE.CylinderGeometry(0.02, 0.02, 0.72, 6).translate(-0.48, 0.36, 0.3),
      new THREE.CylinderGeometry(0.02, 0.02, 0.72, 6).translate(0.48, 0.36, 0.3),
    ]);
    const spots = [[-8.5, S.z - 1.5], [-5.5, S.z - 1.5], [-8.5, S.z + 1.2], [-3.5, S.z]];
    for (const [dx, dz] of spots) {
      const dt = new THREE.Mesh(deskGeo, woodMat); dt.position.set(dx, 0, dz); dt.castShadow = true;
      const lg = new THREE.Mesh(legGeo, sashMat); lg.position.set(dx, 0, dz);
      g.add(dt, lg);
      colliders.addBox(dx, dz, 1.2, 0.85);
      const ch = new THREE.Mesh(mergeGeometries([
        new THREE.BoxGeometry(0.45, 0.05, 0.45).translate(0, 0.46, 0),
        new THREE.BoxGeometry(0.45, 0.5, 0.05).translate(0, 0.73, -0.22),
        new THREE.CylinderGeometry(0.025, 0.025, 0.46, 6).translate(-0.18, 0.23, -0.18),
        new THREE.CylinderGeometry(0.025, 0.025, 0.46, 6).translate(0.18, 0.23, -0.18),
        new THREE.CylinderGeometry(0.025, 0.025, 0.46, 6).translate(-0.18, 0.23, 0.18),
        new THREE.CylinderGeometry(0.025, 0.025, 0.46, 6).translate(0.18, 0.23, 0.18),
      ]), woodMat);
      ch.position.set(dx, 0, dz + 0.85);
      ch.castShadow = true;
      g.add(ch);
    }
    // 窓ぎわのひとやすみチェア
    const sit = new THREE.Mesh(mergeGeometries([
      new THREE.BoxGeometry(0.5, 0.06, 0.5).translate(0, 0.45, 0),
      new THREE.BoxGeometry(0.5, 0.55, 0.06).translate(0, 0.75, -0.25),
      new THREE.BoxGeometry(0.44, 0.42, 0.44).translate(0, 0.21, 0),
    ]), woodMat);
    sit.position.set(L.cafeChair.x, 0, L.cafeChair.z);
    g.add(sit);
  }

  // ---- 体育館 ----
  {
    const gy = L.gym;
    wall(gy.x, 3.2, gy.z, gy.w, 6.4, gy.d);
    const arch = new THREE.Mesh(
      new THREE.CylinderGeometry(gy.d / 2, gy.d / 2, gy.w, 18, 1, false, 0, Math.PI).rotateZ(Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: T.corrugated.map, normalMap: T.corrugated.normalMap, roughness: 0.5, metalness: 0.4 }));
    arch.scale.y = 0.5;
    arch.position.set(gy.x, 6.4, gy.z);
    arch.castShadow = true;
    g.add(arch);
    const gymDoor = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 0.12), sashMat);
    gymDoor.position.set(gy.x + 6, 1.3, gy.z + gy.d / 2 + 0.06);
    g.add(gymDoor);
  }

  // ---- 南方総合センター ----
  {
    const c = L.center;
    wall(c.x, 1.9, c.z, c.w, 3.8, c.d);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(c.w + 0.8, 0.2, c.d + 0.8), concMat);
    roof.position.set(c.x, 3.85, c.z);
    roof.castShadow = true;
    g.add(roof);
    const cSign = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.7),
      new THREE.MeshStandardMaterial({ map: textBoard(512, 72, (cc, w, h) => {
        cc.fillStyle = '#f0ede2'; cc.fillRect(0, 0, w, h);
        cc.fillStyle = '#2c3a52'; cc.textAlign = 'center';
        cc.font = '700 44px serif';
        cc.fillText('南方総合センター', w / 2, 52);
      }), roughness: 0.6 }));
    cSign.position.set(c.x, 3.2, c.z + c.d / 2 + 0.02);
    g.add(cSign);
    for (let x = -6; x <= 6; x += 4) windowUnit(c.x + x, 1.7, c.z + c.d / 2 + 0.12, 2.6, 1.5);
  }

  // ---- グラウンド: カラーコーン駐車区画・サッカーゴール・朝礼台 ----
  {
    const coneGeos = [], bandGeos = [];
    for (let i = 0; i < 7; i++) {
      const x = L.cones.x - 12 + i * 4.2, z = L.cones.z;
      coneGeos.push(new THREE.BoxGeometry(0.5, 0.06, 0.5).translate(x, 0.03, z));
      coneGeos.push(new THREE.ConeGeometry(0.24, 0.72, 12).translate(x, 0.42, z));
      bandGeos.push(new THREE.CylinderGeometry(0.17, 0.2, 0.13, 12).translate(x, 0.4, z));
    }
    const cones = new THREE.Mesh(mergeGeometries(coneGeos),
      new THREE.MeshStandardMaterial({ color: 0xe84b1e, roughness: 0.45 }));
    cones.castShadow = true;
    g.add(cones);
    g.add(new THREE.Mesh(mergeGeometries(bandGeos),
      new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 })));

    const goal = new THREE.Mesh(mergeGeometries([
      new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8).translate(-3, 1.1, 0),
      new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8).translate(3, 1.1, 0),
      new THREE.CylinderGeometry(0.05, 0.05, 6, 8).rotateZ(Math.PI / 2).translate(0, 2.2, 0),
    ]), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4, metalness: 0.4 }));
    goal.position.set(-22, 0, L.grounds.z);
    goal.rotation.y = Math.PI / 2;
    g.add(goal);
  }

  // ---- 自動ドアの開閉 ----
  let doorOpen = 0;
  return {
    update(dt, playerPos) {
      const d = Math.hypot(L.bakeryDoor.x - playerPos.x, zF - playerPos.z);
      const target = d < 2.6 ? 1 : 0;
      doorOpen += (target - doorOpen) * Math.min(1, dt * 7);
      door.rotation.y = -doorOpen * 1.5;
    },
    isInsideBakery(p) {
      return p.x > 2 && p.x < 14.4 && p.z < zF - 0.4 && p.z > zB;
    },
    isIndoors(p) {
      return p.x > -11.5 && p.x < 14.5 && p.z < zF && p.z > zB && p.y < H1;
    },
  };
}
