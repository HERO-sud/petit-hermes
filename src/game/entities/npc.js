// NPC: 店主・大下さん（店内）/ 農家・田中さん（畑）
import { makeCharacter } from './character.js';
import { L } from '../config.js';
import { dampAngle } from '../gen/noise.js';

export function createNPCs(G) {
  const npcs = [];

  function add(id, opts, x, z, ry) {
    const c = makeCharacter(G, opts);
    const y = G.colliders.getGroundY(x, z);
    c.group.position.set(x, y, z);
    c.group.rotation.y = ry;
    G.scene.add(c.group);
    G.colliders.addCircle(x, z, 0.4);
    const n = { id, char: c, x, z, baseRy: ry };
    npcs.push(n);
    return n;
  }

  // 大下さん: カウンターの中（店の奥側）
  const oshita = add('oshita',
    { model: 'Casual_Female', apron: true, kerchief: true, targetH: 1.6 },
    8, L.school.z - 1.2, Math.PI);
  // 田中さん: 畑
  const tanaka = add('tanaka',
    { model: 'Worker_Male', strawHat: true, targetH: 1.64 },
    L.tanakaNpc.x, L.tanakaNpc.z, 2.2);

  return {
    oshita, tanaka, npcs,
    update(dt, playerPos) {
      for (const n of npcs) {
        const dx = playerPos.x - n.x, dz = playerPos.z - n.z;
        const near = Math.hypot(dx, dz) < 5;
        n.char.group.rotation.y = dampAngle(
          n.char.group.rotation.y,
          near ? Math.atan2(dx, dz) : n.baseRy, 4.5, dt);
        n.char.animate(dt, 0, true, G.state.time);
      }
    },
  };
}
