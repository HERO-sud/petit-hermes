// 農家・ビニールハウス・バス停・祠・コンポスト・畑・ゆずの丘・収集物・バス
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { L } from '../config.js';
import { seed, rand, randR } from '../gen/noise.js';
import { textBoard } from '../gen/textures.js';
import { createSharedMaterials } from '../gen/materials.js';
import { placeProp, hasProp } from './props.js';

export function createVillage(G) {
  const { scene, terrain, tex: T, colliders } = G;
  const g = new THREE.Group();
  scene.add(g);

  const M = createSharedMaterials(T);
  const plasterMat = M.plaster;
  const woodMat = M.wood;
  const darkWoodMat = M.darkWood;
  const kawaraMat = M.kawara;
  const corruMat = M.corrugated;
  const glassMat = M.glass(0x90a8b8, 0.45);
  const sashMat = M.sash(0x4a4540);

  // 切妻屋根（瓦・軒の出つき）
  function gableRoof(w, h, d) {
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1);
    geo.rotateZ(Math.PI / 2); geo.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(geo, kawaraMat);
    m.scale.set(w, h * 2, d);
    return m;
  }

  // ---- 農家（パラメトリック）----
  function farmhouse(x, z, ry, sd) {
    seed(sd * 137.7);
    const w = randR(9, 13), d = randR(7, 9), h = randR(3.0, 3.5);
    const y = terrain.heightAt(x, z);
    const hg = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), plasterMat);
    body.position.y = h / 2;
    body.castShadow = body.receiveShadow = true;
    hg.add(body);
    // 腰板
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, h * 0.34, d + 0.06), darkWoodMat);
    skirt.position.y = h * 0.17;
    hg.add(skirt);
    // 屋根
    const roof = gableRoof(w + 1.7, randR(1.5, 1.9), d + 1.7);
    roof.position.y = h + 0.75;
    roof.castShadow = true;
    hg.add(roof);
    // 玄関と窓
    const doorM = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.0, 0.08), darkWoodMat);
    doorM.position.set(w * 0.18, 1.0, d / 2 + 0.05);
    hg.add(doorM);
    for (const wx of [-w * 0.28, w * 0.05]) {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 0.07), sashMat);
      fr.position.set(wx, 1.45, d / 2 + 0.05);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.15), glassMat);
      gl.position.set(wx, 1.45, d / 2 + 0.1);
      hg.add(fr, gl);
    }
    // 縁側
    const engawa = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.35, 1.1), woodMat);
    engawa.position.set(-w * 0.15, 0.18, d / 2 + 0.6);
    hg.add(engawa);
    // 物置（トタン）
    if (rand() < 0.7) {
      const shed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.2), corruMat);
      shed.position.set(w / 2 + 2.2, 1.1, -d * 0.2);
      shed.castShadow = true;
      hg.add(shed);
      const shedRoof = gableRoof(3.0, 0.6, 2.6);
      shedRoof.position.set(w / 2 + 2.2, 2.45, -d * 0.2);
      hg.add(shedRoof);
    }
    hg.position.set(x, y, z);
    hg.rotation.y = ry;
    g.add(hg);
    const s = Math.max(w, d) * 1.12;
    colliders.addBox(x, z, s, s);
  }
  // 数軒は KayKit のトゥーン民家を混在させる（読込失敗時は全軒手組み農家）
  const kaykitHouses = { 1: 'buildingB', 4: 'buildingD', 7: 'buildingF', 9: 'buildingB' };
  L.houses.forEach(([x, z, ry, sd], i) => {
    const key = kaykitHouses[i];
    if (key && hasProp(key)) {
      placeProp(G, key, { x, z, ry, targetW: 9.5, colliderBox: [10.5, 10.5] });
    } else {
      farmhouse(x, z, ry, sd);
    }
  });

  // ---- 車（GLBプロップ。読込失敗時は手組み軽トラで代替）----
  function keitruckFallback(x, z, ry) {
    const y = terrain.heightAt(x, z);
    const kg = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.3, metalness: 0.5 });
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.15, 1.3), bodyMat);
    cab.position.set(0, 1.0, 0.85);
    const winNew = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.5, 1.1), glassMat);
    winNew.position.set(0, 1.3, 0.85);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.45, 1.9), bodyMat);
    bed.position.set(0, 0.72, -0.8);
    const wheelGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.2, 12).rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.85 });
    for (const [wx, wz] of [[-0.62, 0.95], [0.62, 0.95], [-0.62, -0.95], [0.62, -0.95]]) {
      const wmesh = new THREE.Mesh(wheelGeo, wheelMat);
      wmesh.position.set(wx, 0.27, wz);
      kg.add(wmesh);
    }
    kg.add(cab, winNew, bed);
    kg.position.set(x, y, z);
    kg.rotation.y = ry;
    kg.castShadow = true;
    g.add(kg);
    colliders.addBox(x, z, 2.2, 3.2);
  }
  function vehicle(key, x, z, ry, targetL = 4.1) {
    if (hasProp(key)) placeProp(G, key, { x, z, ry, targetL, colliderBox: [2.2, 3.4] });
    else keitruckFallback(x, z, ry);
  }
  vehicle('truckFlat', L.houses[0][0] + 7, L.houses[0][1] + 4, 0.5, 3.4); // 農家の軽トラ
  vehicle('carSedan', L.cones.x - 4, L.cones.z + 3.5, -1.45);            // パン屋のお客さんの車
  vehicle('carHatchback', L.cones.x + 1.5, L.cones.z + 3.6, -1.65);      // もう一台のお客さん
  // 県道ぞいの駐車車両
  if (G.roads?.curve) {
    for (const [t, key, side] of [[0.50, 'carTaxi', 1], [0.585, 'truckFlat', -1]]) {
      const p = G.roads.curve.getPoint(t);
      const tan = G.roads.curve.getTangent(t);
      const nx = -tan.z * side, nz = tan.x * side;
      const px = p.x + nx * 4.4, pz = p.z + nz * 4.4;
      vehicle(key, px, pz, Math.atan2(tan.x, tan.z), key === 'truckFlat' ? 3.4 : 4.1);
    }
  }

  // ---- ビニールハウス ----
  for (const [x, z, ry] of L.greenhouses) {
    const y = terrain.heightAt(x, z);
    const vg = new THREE.Group();
    const vinyl = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 14, 12, 1, true, 0, Math.PI).rotateZ(Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: 0xeef4f0, roughness: 0.35, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    vinyl.scale.y = 0.78;
    vinyl.position.y = 0.1;
    vg.add(vinyl);
    const frames = [];
    for (let i = -6; i <= 6; i += 1.5) {
      frames.push(new THREE.TorusGeometry(2.38, 0.025, 6, 14, Math.PI).rotateY(Math.PI / 2).translate(i, 0.1, 0));
    }
    vg.add(new THREE.Mesh(mergeGeometries(frames),
      new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.4, metalness: 0.6 })));
    vg.position.set(x, y, z);
    vg.rotation.y = ry;
    g.add(vg);
    colliders.addBox(x, z, 15, 5.5);
  }

  // ---- バス停 ----
  {
    const b = L.busStop;
    const y = terrain.heightAt(b.x, b.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), sashMat);
    pole.position.set(b.x, y + 1.2, b.z);
    const signTop = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24),
      new THREE.MeshStandardMaterial({ map: textBoard(256, 256, (c, w, h) => {
        c.fillStyle = '#fffdf2'; c.beginPath(); c.arc(128, 128, 124, 0, 7); c.fill();
        c.strokeStyle = '#2c5c8a'; c.lineWidth = 10; c.beginPath(); c.arc(128, 128, 116, 0, 7); c.stroke();
        c.fillStyle = '#22426a'; c.textAlign = 'center';
        c.font = '700 36px system-ui, sans-serif';
        c.fillText('南方小学校前', 128, 105);
        c.font = '600 26px system-ui, sans-serif';
        c.fillText('バスのりば', 128, 158);
      }), roughness: 0.5, side: THREE.DoubleSide }));
    signTop.position.set(b.x, y + 2.5, b.z);
    const bench = new THREE.Mesh(mergeGeometries([
      new THREE.BoxGeometry(1.8, 0.07, 0.42).translate(0, 0.45, 0),
      new THREE.BoxGeometry(0.08, 0.45, 0.4).translate(-0.8, 0.22, 0),
      new THREE.BoxGeometry(0.08, 0.45, 0.4).translate(0.8, 0.22, 0),
    ]), woodMat);
    bench.position.set(b.x + 1.6, y, b.z);
    g.add(pole, signTop, bench);
    colliders.addCircle(b.x, b.z, 0.2);
  }

  // ---- 祠と鳥居 ----
  {
    const s = L.shrine;
    const y = terrain.heightAt(s.x, s.z);
    const hokora = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.2),
      new THREE.MeshStandardMaterial({ map: T.concrete.map, roughness: 0.9 }));
    base.position.y = 0.25;
    const room = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.8), darkWoodMat);
    room.position.y = 0.95;
    const hr = gableRoof(1.5, 0.5, 1.2);
    hr.position.y = 1.6;
    hokora.add(base, room, hr);
    hokora.position.set(s.x, y, s.z);
    g.add(hokora);
    colliders.addBox(s.x, s.z, 1.6, 1.4);
    // 鳥居
    const tMat = new THREE.MeshStandardMaterial({ color: 0xb33a26, roughness: 0.6 });
    const torii = new THREE.Mesh(mergeGeometries([
      new THREE.CylinderGeometry(0.1, 0.12, 2.6, 10).translate(-1.0, 1.3, 0),
      new THREE.CylinderGeometry(0.1, 0.12, 2.6, 10).translate(1.0, 1.3, 0),
      new THREE.BoxGeometry(2.9, 0.16, 0.16).translate(0, 2.62, 0),
      new THREE.BoxGeometry(2.4, 0.12, 0.12).translate(0, 2.2, 0),
    ]), tMat);
    torii.position.set(s.x, y, s.z + 3.2);
    torii.castShadow = true;
    g.add(torii);
    colliders.addCircle(s.x - 1, s.z + 3.2, 0.16);
    colliders.addCircle(s.x + 1, s.z + 3.2, 0.16);
  }

  // ---- コンポスト（校舎裏）----
  {
    const c = L.compost;
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.85, 0.95, 12), woodMat);
    bin.position.set(c.x, 0.48, c.z);
    bin.castShadow = true;
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.82, 12),
      new THREE.MeshStandardMaterial({ map: T.forest.map, roughness: 1 }));
    soil.rotation.x = -Math.PI / 2;
    soil.position.set(c.x, 0.97, c.z);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), woodMat);
    post.position.set(c.x - 1.5, 0.75, c.z);
    const csign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.85),
      new THREE.MeshStandardMaterial({ map: textBoard(300, 170, (cc, w, h) => {
        cc.fillStyle = '#fdf8ea'; cc.fillRect(0, 0, w, h);
        cc.strokeStyle = '#4E5D3E'; cc.lineWidth = 6; cc.strokeRect(4, 4, w - 8, h - 8);
        cc.fillStyle = '#3A4A2F'; cc.textAlign = 'center';
        cc.font = '700 34px system-ui, sans-serif';
        cc.fillText('ぐるぐる', w / 2, 52);
        cc.fillText('コンポスト', w / 2, 96);
        cc.fillStyle = '#777'; cc.font = '600 18px system-ui, sans-serif';
        cc.fillText('生ごみ → ふかふかの土', w / 2, 140);
      }), roughness: 0.6, side: THREE.DoubleSide }));
    csign.position.set(c.x - 1.5, 1.35, c.z);
    g.add(bin, soil, post, csign);
    colliders.addCircle(c.x, c.z, 1.05);
  }

  // ---- 田中さんの畑（畝＋規格外野菜）----
  const veggies = [];
  {
    const f = L.tanakaField;
    const rows = [];
    for (let r = 0; r < 4; r++) {
      rows.push(new THREE.BoxGeometry(20, 0.4, 1.1).translate(f.x, 0.2, f.z - 4 + r * 2.6));
    }
    const soilMat = new THREE.MeshStandardMaterial({
      map: T.dirt.map, normalMap: T.dirt.normalMap, roughness: 1,
    });
    const ridge = new THREE.Mesh(mergeGeometries(rows), soilMat);
    ridge.receiveShadow = true;
    g.add(ridge);
    // 葉物（インスタンス風に少数）
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a7a35, roughness: 0.8 });
    seed(8);
    for (let i = 0; i < 36; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5), leafMat);
      leaf.scale.y = 0.55;
      leaf.position.set(f.x - 9 + (i % 12) * 1.7, 0.45, f.z - 4 + Math.floor(i / 12) * 2.6);
      g.add(leaf);
    }
    // 規格外野菜（収集対象）
    const defs = [
      { x: f.x - 6, z: f.z + 2.8, label: 'まがりトマトを ひろう', build: () => {
        const t = new THREE.Group();
        const m = new THREE.MeshStandardMaterial({ color: 0xc83a28, roughness: 0.35 });
        const a = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), m); a.scale.set(1.2, 0.85, 1);
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), m); b.position.set(0.22, 0.1, 0);
        t.add(a, b); return t;
      }},
      { x: f.x + 2, z: f.z + 2.8, label: 'ふたまたにんじんを ひろう', build: () => {
        const t = new THREE.Group();
        const m = new THREE.MeshStandardMaterial({ color: 0xd9651e, roughness: 0.5 });
        const a = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), m); a.rotation.z = Math.PI + 0.25; a.position.x = -0.08;
        const b = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 8), m); b.rotation.z = Math.PI - 0.3; b.position.x = 0.1;
        t.add(a, b); return t;
      }},
      { x: f.x + 8, z: f.z + 2.8, label: 'でこぼこじゃがいもを ひろう', build: () => {
        const m = new THREE.MeshStandardMaterial({ map: T.dirt.map, color: 0xc9a06a, roughness: 0.95 });
        const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), m); a.scale.set(1.3, 0.85, 1);
        const t = new THREE.Group(); t.add(a); return t;
      }},
    ];
    for (const d of defs) {
      const mesh = d.build();
      mesh.position.set(d.x, 0.65, d.z);
      g.add(mesh);
      veggies.push({ mesh, x: d.x, z: d.z, label: d.label, taken: false });
    }
  }

  // ---- ゆずの丘 ----
  const yuzus = [];
  {
    const yh = L.yuzuHill;
    const leafM = new THREE.MeshStandardMaterial({ color: 0x2e5a28, roughness: 0.85 });
    const fruitM = new THREE.MeshStandardMaterial({ color: 0xe8c818, roughness: 0.45 });
    const trunkM = new THREE.MeshStandardMaterial({ map: T.wood.map, roughness: 0.95, color: 0x8a6a4e });
    seed(44);
    for (let i = 0; i < 5; i++) {
      const x = yh.x + randR(-14, 14), z = yh.z + randR(-12, 12);
      const y = terrain.heightAt(x, z);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.8, 7), trunkM);
      tr.position.set(x, y + 0.9, z);
      tr.castShadow = true;
      const cano = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), leafM);
      cano.scale.y = 0.85;
      cano.position.set(x, y + 2.4, z);
      cano.castShadow = true;
      g.add(tr, cano);
      for (let k = 0; k < 7; k++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), fruitM);
        const a = rand() * Math.PI * 2;
        f.position.set(x + Math.cos(a) * 1.2, y + 2.0 + rand() * 0.9, z + Math.sin(a) * 1.2);
        g.add(f);
      }
      colliders.addCircle(x, z, 0.35);
      if (yuzus.length < 3) {
        const cy = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), fruitM);
        cy.position.set(x + 0.7, y + 1.15, z + 0.5);
        g.add(cy);
        yuzus.push({ mesh: cy, x: x + 0.7, z: z + 0.5, label: 'ゆずを しゅうかくする', taken: false });
      }
    }
  }

  // ---- プチカンパーニュくん 木製看板スタンディ（店頭）----
  {
    const standTex = textBoard(256, 384, (c, w, h) => {
      c.fillStyle = '#f7f0de'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#8a6743'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
      // プチカンパーニュくん
      c.fillStyle = '#c8893b'; c.beginPath(); c.ellipse(128, 140, 84, 66, 0, 0, 7); c.fill();
      c.fillStyle = '#e0b269'; c.beginPath(); c.ellipse(128, 124, 70, 46, 0, 0, 7); c.fill();
      c.fillStyle = '#4a3013';
      c.beginPath(); c.arc(102, 128, 8, 0, 7); c.fill();
      c.beginPath(); c.arc(154, 128, 8, 0, 7); c.fill();
      c.beginPath(); c.arc(128, 152, 11, 0, Math.PI); c.fill();
      c.fillStyle = '#3A4A2F'; c.textAlign = 'center';
      c.font = '700 26px system-ui, sans-serif';
      c.fillText('プチカンパーニュくん', 128, 250);
      c.font = '600 19px system-ui, sans-serif'; c.fillStyle = '#6a5a40';
      c.fillText('日がたつごとに', 128, 296);
      c.fillText('あじわい ふかまる', 128, 326);
    });
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.3, 0.05),
      new THREE.MeshStandardMaterial({ map: standTex, roughness: 0.7 }));
    stand.position.set(L.bakeryDoor.x + 1.7, 0.7, L.bakeryDoor.z + 0.6);
    stand.rotation.y = 0.3;
    stand.castShadow = true;
    g.add(stand);
    colliders.addCircle(L.bakeryDoor.x + 1.7, L.bakeryDoor.z + 0.6, 0.3);
  }

  // ---- 路線バス（導入演出用）----
  const bus = new THREE.Group();
  {
    const busMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.3, metalness: 0.4 });
    const stripe = new THREE.MeshStandardMaterial({ color: 0x2c6a4a, roughness: 0.35 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.4, 7.6), busMat);
    body.position.y = 1.55;
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.4, 7.62), stripe);
    band.position.y = 1.25;
    const winB = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.7, 6.6), glassMat);
    winB.position.y = 2.25;
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14).rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.85 });
    for (const [wx, wz] of [[-1.0, 2.5], [1.0, 2.5], [-1.0, -2.5], [1.0, -2.5]]) {
      const wm = new THREE.Mesh(wheelGeo, wheelMat);
      wm.position.set(wx, 0.42, wz);
      bus.add(wm);
    }
    bus.add(body, band, winB);
    bus.castShadow = true;
    bus.visible = false;
    g.add(bus);
  }

  return { veggies, yuzus, bus };
}
