// NPC: 店主・大下さん（店内）/ 農家・田中さん（畑）/ 村人たち（徘徊・犬の散歩）
import { makeCharacter, loadCharacter } from './character.js';
import { L, DIALOGS } from '../config.js';
import { dampAngle } from '../gen/noise.js';

export function createNPCs(G) {
  const npcs = [];

  function add(id, opts, x, z, ry, extra = {}) {
    const c = makeCharacter(G, opts);
    c.group.position.set(x, G.colliders.getGroundY(x, z), z);
    c.group.rotation.y = ry;
    G.scene.add(c.group);
    const circle = { x, z, r: 0.4 };
    G.colliders.circles.push(circle);
    const n = { id, char: c, x, z, baseRy: ry, circle, wi: 0, pause: 0, ...extra };
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

  // 村人: モデルを遅延ロードし、完了し次第スポーン＋会話を登録
  function spawnVillagers() {
    for (const v of L.villagers) {
      loadCharacter(v.model).then((gltf) => {
        if (!gltf) return;
        const n = add(v.id, { model: v.model, targetH: v.targetH }, v.x, v.z, v.ry ?? 0,
          { wander: v.wander });
        G.interact.add({
          get x() { return n.x; }, get z() { return n.z; },
          r: 3.0, label: v.label ?? 'はなしかける',
          enabled: () => true,
          onUse() { G.dialog.start(DIALOGS[v.dialog]); },
        });
        if (v.dog) {
          loadCharacter('Pug').then((pug) => {
            if (pug) add(v.id + 'Dog', { model: 'Pug', targetH: 0.55 }, v.x + 1.2, v.z + 1, 0,
              { follow: n });
          });
        }
      });
    }
  }

  function moveTo(n, x, z) {
    n.x = x; n.z = z;
    n.char.group.position.set(x, G.colliders.getGroundY(x, z), z);
    n.circle.x = x; n.circle.z = z;
  }

  return {
    oshita, tanaka, npcs, spawnVillagers,
    update(dt, playerPos) {
      for (const n of npcs) {
        const dx = playerPos.x - n.x, dz = playerPos.z - n.z;
        const near = Math.hypot(dx, dz) < 5;
        let speed = 0;
        let wantRy = near ? Math.atan2(dx, dz) : n.baseRy;

        if (n.follow) {
          // 犬: 飼い主を追いかける（プレイヤーが近くても散歩はやめない）
          const fx = n.follow.x - n.x, fz = n.follow.z - n.z;
          const fd = Math.hypot(fx, fz);
          if (fd > 2.0) {
            speed = Math.min(2.4, fd * 1.2);
            moveTo(n, n.x + fx / fd * speed * dt, n.z + fz / fd * speed * dt);
            wantRy = Math.atan2(fx, fz);
          } else if (!near) {
            wantRy = n.follow.char.group.rotation.y;
          }
        } else if (n.wander && !near) {
          // 徘徊: ウェイポイントを巡回（到着でひと休み・プレイヤー接近で停止）
          if (n.pause > 0) {
            n.pause -= dt;
          } else {
            const [tx, tz] = n.wander[n.wi];
            const wx = tx - n.x, wz = tz - n.z;
            const wd = Math.hypot(wx, wz);
            if (wd < 0.6) {
              n.wi = (n.wi + 1) % n.wander.length;
              n.pause = 1.8 + (n.wi * 1.7) % 3;
            } else {
              speed = 1.1;
              moveTo(n, n.x + wx / wd * speed * dt, n.z + wz / wd * speed * dt);
            }
          }
          if (speed > 0) {
            const [tx, tz] = n.wander[n.wi];
            wantRy = Math.atan2(tx - n.x, tz - n.z);
          } else if (n.lastRy !== undefined) {
            wantRy = n.lastRy;
          }
        }
        if (speed > 0) n.lastRy = wantRy;

        n.char.group.rotation.y = dampAngle(n.char.group.rotation.y, wantRy, 4.5, dt);
        n.char.animate(dt, speed, true, G.state.time);
      }
    },
  };
}
