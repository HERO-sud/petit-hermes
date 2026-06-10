// 川（平面反射Water）と田んぼの水鏡
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { L } from '../config.js';

export function createWater(G) {
  const { scene, tex: T } = G;
  const group = new THREE.Group();
  scene.add(group);

  // ---- 川リボン（y=-0.95 平面）----
  const pts = L.riverPts.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.25);
  function riverGeo() {
    const N = 200, halfW = L.riverW / 2;
    const verts = [], uvs = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const nx = -tan.z, nz = tan.x;
      verts.push(p.x + nx * halfW, 0, p.z + nz * halfW, p.x - nx * halfW, 0, p.z - nz * halfW);
      uvs.push(0, t * 60, 1, t * 60);
      if (i < N) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  let river = null, riverIsReflective = false, paddyMatRef = null;

  function buildRiver(rtSize) {
    if (river) { group.remove(river); river.geometry.dispose(); river.material.dispose?.(); }
    const geo = riverGeo();
    if (rtSize > 0) {
      river = new Water(geo, {
        textureWidth: rtSize, textureHeight: rtSize,
        waterNormals: T.waterNormal,
        sunDirection: new THREE.Vector3(0.3, 0.8, 0.2),
        sunColor: 0xffffff,
        waterColor: 0x1d3a3a,
        distortionScale: 1.4,
        fog: true,
      });
      riverIsReflective = true;
    } else {
      const m = new THREE.MeshStandardMaterial({
        color: 0x2a4a4e, roughness: 0.08, metalness: 0,
        normalMap: T.waterNormal, normalScale: new THREE.Vector2(0.5, 0.5),
        envMapIntensity: 1.3,
      });
      river = new THREE.Mesh(geo, m);
      riverIsReflective = false;
    }
    river.position.y = -0.95;
    group.add(river);
  }
  buildRiver(G.quality.tier.waterRT);
  G.quality.onChange((t) => buildRiver(t.waterRT));

  // ---- 田んぼ水鏡 + 畦（あぜ）----
  {
    const paddyMat = new THREE.MeshStandardMaterial({
      color: 0x39443a, roughness: 0.06, metalness: 0,
      normalMap: T.waterNormal, normalScale: new THREE.Vector2(0.18, 0.18),
      envMapIntensity: 1.25,
    });
    const planes = [];
    const bunds = [];
    for (const [x, z, w, d] of L.paddies) {
      planes.push(new THREE.PlaneGeometry(w - 2, d - 2).rotateX(-Math.PI / 2).translate(x, -0.12, z));
      // 畦: 4辺の低い土手
      const t = 1.2, h = 0.5;
      bunds.push(
        new THREE.BoxGeometry(w + t, h, t).translate(x, -0.15, z - d / 2),
        new THREE.BoxGeometry(w + t, h, t).translate(x, -0.15, z + d / 2),
        new THREE.BoxGeometry(t, h, d + t).translate(x - w / 2, -0.15, z),
        new THREE.BoxGeometry(t, h, d + t).translate(x + w / 2, -0.15, z),
      );
    }
    const paddyMesh = new THREE.Mesh(mergeGeometries(planes), paddyMat);
    group.add(paddyMesh);
    const bundMat = new THREE.MeshStandardMaterial({
      map: T.grass.map, normalMap: T.grass.normalMap, roughness: 0.95,
    });
    const bundGeo = mergeGeometries(bunds);
    // 畦はワールドUVに合わせる
    const uv = bundGeo.attributes.uv, pos = bundGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 3, pos.getZ(i) / 3);
    const bundMesh = new THREE.Mesh(bundGeo, bundMat);
    bundMesh.receiveShadow = true;
    group.add(bundMesh);
    paddyMatRef = paddyMat;
  }

  return {
    get isReflective() { return riverIsReflective; },
    update(dt) {
      if (riverIsReflective) {
        river.material.uniforms.time.value += dt * 0.6;
        if (G.sky) river.material.uniforms.sunDirection.value.copy(G.sky.sun.position).normalize();
      } else if (river.material.normalMap) {
        river.material.normalMap.offset.y -= dt * 0.05;
      }
      if (paddyMatRef?.normalMap) {
        paddyMatRef.normalMap.offset.x += dt * 0.004;
      }
    },
  };
}
