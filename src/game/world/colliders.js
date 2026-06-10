// 衝突: XZ平面の円柱 vs AABB/円 + 地形高さ
import { clamp } from '../gen/noise.js';
import { CFG } from '../config.js';

export function createColliders() {
  const boxes = [];   // {minX,minZ,maxX,maxZ}
  const circles = []; // {x,z,r}
  let groundFn = () => 0;

  return {
    boxes, circles,
    setGround(fn) { groundFn = fn; },
    getGroundY(x, z) { return groundFn(x, z); },
    addBox(cx, cz, sx, sz) {
      boxes.push({ minX: cx - sx / 2, minZ: cz - sz / 2, maxX: cx + sx / 2, maxZ: cz + sz / 2 });
    },
    addCircle(x, z, r) { circles.push({ x, z, r }); },

    resolve(p, r = CFG.playerR) {
      for (let it = 0; it < 2; it++) {
        for (const b of boxes) {
          const qx = clamp(p.x, b.minX, b.maxX), qz = clamp(p.z, b.minZ, b.maxZ);
          const dx = p.x - qx, dz = p.z - qz;
          const d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            if (d2 > 1e-8) {
              const d = Math.sqrt(d2), push = (r - d) / d;
              p.x += dx * push; p.z += dz * push;
            } else {
              const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bt = b.maxZ - p.z;
              const m = Math.min(l, rr, t, bt);
              if (m === l) p.x = b.minX - r;
              else if (m === rr) p.x = b.maxX + r;
              else if (m === t) p.z = b.minZ - r;
              else p.z = b.maxZ + r;
            }
          }
        }
        for (const c of circles) {
          const dx = p.x - c.x, dz = p.z - c.z;
          const rr = r + c.r;
          const d2 = dx * dx + dz * dz;
          if (d2 < rr * rr && d2 > 1e-8) {
            const d = Math.sqrt(d2), push = (rr - d) / d;
            p.x += dx * push; p.z += dz * push;
          }
        }
      }
      // ワールド外周
      const rad = Math.hypot(p.x, p.z);
      if (rad > 330) { p.x *= 330 / rad; p.z *= 330 / rad; }
    },
  };
}
