// 県道リボン・ガードレール・電柱と垂れ電線・マンホール・橋
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { L } from '../config.js';

export function createRoads(G) {
  const { scene, terrain, tex: T } = G;
  const group = new THREE.Group();
  scene.add(group);

  // ---- 県道リボン（スプライン沿い幅6m）----
  const pts = L.roadPts.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2);
  const N = 360, halfW = 3.1;
  {
    const verts = [], uvs = [], idx = [];
    let arc = 0, prev = null;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const nx = -tan.z, nz = tan.x; // 左法線
      if (prev) arc += p.distanceTo(prev);
      prev = p.clone();
      const y1 = terrain.heightAt(p.x + nx * halfW, p.z + nz * halfW) + 0.07;
      const y2 = terrain.heightAt(p.x - nx * halfW, p.z - nz * halfW) + 0.07;
      verts.push(p.x + nx * halfW, y1, p.z + nz * halfW, p.x - nx * halfW, y2, p.z - nz * halfW);
      uvs.push(0, arc / 9, 1, arc / 9);
      if (i < N) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: T.road,
      normalMap: T.asphalt.normalMap,
      roughnessMap: T.asphalt.roughnessMap,
      roughness: 1, metalness: 0,
    });
    mat.map.wrapT = THREE.RepeatWrapping;
    const road = new THREE.Mesh(geo, mat);
    road.receiveShadow = true;
    group.add(road);
  }

  // ---- 電柱（東側オフセット4.6m・35m間隔）＋垂れ電線 ----
  {
    const poleGeo = mergeGeometries([
      new THREE.CylinderGeometry(0.13, 0.18, 9, 8).translate(0, 4.5, 0),
      new THREE.BoxGeometry(2.4, 0.12, 0.12).translate(0, 8.1, 0),   // 腕金
      new THREE.BoxGeometry(0.1, 0.25, 0.1).translate(-0.9, 8.3, 0), // 碍子
      new THREE.BoxGeometry(0.1, 0.25, 0.1).translate(0, 8.3, 0),
      new THREE.BoxGeometry(0.1, 0.25, 0.1).translate(0.9, 8.3, 0),
    ]);
    const poleMat = new THREE.MeshStandardMaterial({
      map: T.concrete.map, normalMap: T.concrete.normalMap, roughness: 0.85,
    });
    const tops = [];
    const range = [];
    for (let t = 0.28; t <= 0.74; t += 0.022) range.push(t);
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, range.length);
    poles.castShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    range.forEach((t, i) => {
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const ox = -tan.z * 4.6, oz = tan.x * 4.6;
      const x = p.x + ox, z = p.z + oz;
      const y = terrain.heightAt(x, z);
      q.setFromEuler(new THREE.Euler(0, Math.atan2(tan.x, tan.z), (i % 5 - 2) * 0.008));
      m4.compose(new THREE.Vector3(x, y, z), q, s);
      poles.setMatrixAt(i, m4);
      tops.push([x, y + 8.32, z, Math.atan2(tan.x, tan.z)]);
      G.colliders.addCircle(x, z, 0.25);
    });
    group.add(poles);

    // 電線（3本×区間、たわみ1.1m、全マージで1call）
    const wireGeos = [];
    for (let i = 0; i < tops.length - 1; i++) {
      const [x1, y1, z1, a1] = tops[i];
      const [x2, y2, z2, a2] = tops[i + 1];
      for (const off of [-0.9, 0, 0.9]) {
        const o1x = Math.cos(a1) * off, o1z = -Math.sin(a1) * off;
        const o2x = Math.cos(a2) * off, o2z = -Math.sin(a2) * off;
        const A = new THREE.Vector3(x1 + o1x, y1, z1 + o1z);
        const B = new THREE.Vector3(x2 + o2x, y2, z2 + o2z);
        const mid = A.clone().lerp(B, 0.5); mid.y -= 1.1;
        const c = new THREE.QuadraticBezierCurve3(A, mid, B);
        wireGeos.push(new THREE.TubeGeometry(c, 10, 0.022, 5));
      }
    }
    const wires = new THREE.Mesh(mergeGeometries(wireGeos),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.6 }));
    group.add(wires);
  }

  // ---- ガードレール（学校区間の西側）----
  {
    const postGeos = [], beamGeos = [];
    const beamPts = [];
    for (let t = 0.40; t <= 0.56; t += 0.006) {
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const x = p.x - (-tan.z) * 3.7, z = p.z - (tan.x) * 3.7; // 西側
      const y = terrain.heightAt(x, z);
      beamPts.push(new THREE.Vector3(x, y + 0.68, z));
      if (beamPts.length % 3 === 1) {
        postGeos.push(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 6).translate(x, y + 0.37, z));
      }
    }
    const beamCurve = new THREE.CatmullRomCurve3(beamPts);
    beamGeos.push(new THREE.TubeGeometry(beamCurve, 80, 0.09, 6));
    const grMat = new THREE.MeshStandardMaterial({ color: 0xe8eaea, roughness: 0.35, metalness: 0.6 });
    group.add(new THREE.Mesh(mergeGeometries([...postGeos, ...beamGeos]), grMat));
  }

  // ---- マンホール ----
  {
    const mhMat = new THREE.MeshStandardMaterial({ color: 0x3a3a38, roughness: 0.55, metalness: 0.7 });
    for (const t of [0.45, 0.52, 0.6]) {
      const p = curve.getPoint(t);
      const mh = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), mhMat);
      mh.rotation.x = -Math.PI / 2;
      mh.position.set(p.x + 1, terrain.heightAt(p.x + 1, p.z) + 0.085, p.z);
      group.add(mh);
    }
  }

  // ---- 橋（コンクリ桁＋欄干）----
  {
    const b = L.bridge;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 16),
      new THREE.MeshStandardMaterial({ map: T.concrete.map, normalMap: T.concrete.normalMap, roughness: 0.85 }));
    slab.rotation.y = Math.PI / 2;
    slab.position.set(86, 0.15, b.z);
    slab.receiveShadow = slab.castShadow = true;
    group.add(slab);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.4, metalness: 0.5 });
    for (const side of [-1.8, 1.8]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(16, 0.08, 0.08), railMat);
      rail.position.set(86, 1.0, b.z + side);
      group.add(rail);
      for (let i = -7; i <= 7; i += 2) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.65, 0.07), railMat);
        post.position.set(86 + i, 0.72, b.z + side);
        group.add(post);
      }
      G.colliders.addBox(86, b.z + side, 16.4, 0.3);
    }
  }

  return { curve };
}
