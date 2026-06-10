// プレイヤー: 三人称/一人称コントローラ・カメラリグ・入力（キーボード/マウス/タッチ）
import * as THREE from 'three';
import { CFG } from '../config.js';
import { makeCharacter } from './character.js';
import { clamp, dampAngle } from '../gen/noise.js';

export function createPlayer(G) {
  const { scene, camera, colliders, canvas } = G;

  const char = makeCharacter(G, { model: 'Casual_Male' });
  const player = char.group;
  player.position.set(CFG.spawn.x, colliders.getGroundY(CFG.spawn.x, CFG.spawn.z), CFG.spawn.z);
  scene.add(player);

  // ---- 入力 ----
  const keys = {};
  const input = { jump: false, act: false, useSlot: 0, photo: false, view: false, map: false };
  const joy = { x: 0, y: 0 };
  let pointerLocked = false;
  let camYaw = 0;             // 0 = 北向き（学校方面）
  let camPitch = 0.18;
  let firstPerson = false;

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'Space') {
      if (G.state.phase === 'PLAY') input.jump = true;
      e.preventDefault();
    }
    if (e.code === 'KeyF' || e.code === 'KeyE') input.act = true;
    if (e.code === 'KeyV') input.view = true;
    if (e.code === 'KeyP') input.photo = true;
    if (e.code === 'KeyM') input.map = true;
    if (/^Digit[1-6]$/.test(e.code)) input.useSlot = +e.code.slice(5);
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });

  // requestPointerLock のPromise拒否は無害（ロック要求中のフェーズ遷移等）なので握りつぶす
  const tryLock = () => { try { canvas.requestPointerLock()?.catch?.(() => {}); } catch { /* noop */ } };
  canvas.addEventListener('click', () => {
    if (!G.quality.isTouch && !pointerLocked && ['PLAY', 'PHOTO'].includes(G.state.phase)) {
      tryLock();
    }
  });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
  });
  addEventListener('mousemove', (e) => {
    if (pointerLocked) {
      camYaw -= e.movementX * 0.0021;
      camPitch = clamp(camPitch + e.movementY * 0.0021, -0.6, 1.15);
    }
  });
  let dragLast = null;
  canvas.addEventListener('mousedown', (e) => { if (!pointerLocked) dragLast = [e.clientX, e.clientY]; });
  addEventListener('mousemove', (e) => {
    if (!pointerLocked && dragLast && e.buttons) {
      camYaw -= (e.clientX - dragLast[0]) * 0.005;
      camPitch = clamp(camPitch + (e.clientY - dragLast[1]) * 0.005, -0.6, 1.15);
      dragLast = [e.clientX, e.clientY];
    }
  });
  addEventListener('mouseup', () => { dragLast = null; });

  // ---- タッチ ----
  let touchSprint = false;
  if (G.quality.isTouch) {
    document.getElementById('touchUI').classList.remove('hidden');
    const joyBase = document.getElementById('joyBase');
    const joyStick = document.getElementById('joyStick');
    const baseR = 56;
    let joyId = null;
    const setStick = (dx, dy) => {
      const d = Math.hypot(dx, dy), max = baseR * 0.7;
      if (d > max) { dx *= max / d; dy *= max / d; }
      joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      joy.x = dx / max; joy.y = dy / max;
    };
    joyBase.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      joyId = t.identifier;
      const r = joyBase.getBoundingClientRect();
      setStick(t.clientX - r.left - baseR, t.clientY - r.top - baseR);
    }, { passive: false });
    joyBase.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === joyId) {
        const r = joyBase.getBoundingClientRect();
        setStick(t.clientX - r.left - baseR, t.clientY - r.top - baseR);
      }
    }, { passive: false });
    const endJoy = (e) => {
      for (const t of e.changedTouches) if (t.identifier === joyId) {
        joy.x = joy.y = 0;
        joyStick.style.transform = 'translate(-50%,-50%)';
      }
    };
    joyBase.addEventListener('touchend', endJoy);
    joyBase.addEventListener('touchcancel', endJoy);

    let lookId = null, lookLast = null;
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX > innerWidth * 0.4 && lookId === null) {
          lookId = t.identifier; lookLast = [t.clientX, t.clientY];
        }
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookId) {
        camYaw -= (t.clientX - lookLast[0]) * 0.006;
        camPitch = clamp(camPitch + (t.clientY - lookLast[1]) * 0.006, -0.6, 1.15);
        lookLast = [t.clientX, t.clientY];
      }
    }, { passive: true });
    const endLook = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
    canvas.addEventListener('touchend', endLook);
    canvas.addEventListener('touchcancel', endLook);

    document.getElementById('btnJump').addEventListener('touchstart', (e) => { e.preventDefault(); input.jump = true; }, { passive: false });
    const btnDash = document.getElementById('btnDash');
    btnDash.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchSprint = !touchSprint;
      btnDash.classList.toggle('on', touchSprint);
    }, { passive: false });
    document.getElementById('btnAct').addEventListener('touchstart', (e) => { e.preventDefault(); input.act = true; }, { passive: false });
  }

  // ---- 物理状態 ----
  const vel = new THREE.Vector3();
  let onGround = true, coyote = 0, modelYaw = Math.PI;
  let stepAcc = 0;
  const _camTarget = new THREE.Vector3();
  const _camIdeal = new THREE.Vector3();
  const _camCur = new THREE.Vector3(CFG.spawn.x, 4, CFG.spawn.z + 8);

  function pointBlocked(x, y, z) {
    if (y > 7.5) return false;
    for (const b of colliders.boxes) {
      if (x > b.minX - 0.1 && x < b.maxX + 0.1 && z > b.minZ - 0.1 && z < b.maxZ + 0.1) return true;
    }
    return false;
  }

  const P = {
    char, group: player, input, keys,
    get yaw() { return camYaw; },
    set yaw(v) { camYaw = v; },
    get pitch() { return camPitch; },
    get firstPerson() { return firstPerson; },
    get speed() { return Math.hypot(vel.x, vel.z); },
    pos: player.position,
    exitLock() { if (document.pointerLockElement) document.exitPointerLock(); },
    requestLock() { if (!G.quality.isTouch) tryLock(); },
    teleport(x, z) {
      player.position.set(x, colliders.getGroundY(x, z), z);
      vel.set(0, 0, 0);
    },
    toggleView() {
      firstPerson = !firstPerson;
      player.visible = !firstPerson;
    },

    update(dt) {
      if (G.state.phase !== 'PLAY' && G.state.phase !== 'SIT') return;
      if (G.state.phase === 'SIT') { vel.set(0, 0, 0); return; }

      let ix = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0) + joy.x;
      let iz = (keys['KeyS'] ? 1 : 0) - (keys['KeyW'] ? 1 : 0) + joy.y;
      const l = Math.hypot(ix, iz);
      if (l > 1) { ix /= l; iz /= l; }
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const wishX = cos * ix + sin * iz;
      const wishZ = -sin * ix + cos * iz;

      const sprinting = (keys['ShiftLeft'] || keys['ShiftRight'] || touchSprint) && (ix || iz);
      const maxSpd = sprinting ? CFG.sprintSpeed : CFG.walkSpeed;
      if (ix || iz) {
        vel.x += wishX * CFG.accel * dt;
        vel.z += wishZ * CFG.accel * dt;
      } else {
        const f = Math.pow(0.0001, dt);
        vel.x *= f; vel.z *= f;
      }
      const hs = Math.hypot(vel.x, vel.z);
      if (hs > maxSpd) { vel.x *= maxSpd / hs; vel.z *= maxSpd / hs; }

      if (onGround) coyote = 0.1; else coyote -= dt;
      if (input.jump && coyote > 0) {
        vel.y = CFG.jumpVel;
        onGround = false; coyote = 0;
        G.audio?.sfx.jump();
      }
      input.jump = false;

      vel.y += CFG.gravity * dt;
      player.position.addScaledVector(vel, dt);
      colliders.resolve(player.position);
      const gy2 = colliders.getGroundY(player.position.x, player.position.z);
      if (player.position.y <= gy2) {
        player.position.y = gy2;
        vel.y = 0;
        onGround = true;
      } else {
        // 緩斜面では地面に貼り付ける
        if (onGround && player.position.y - gy2 < 0.5 && vel.y <= 0) {
          player.position.y = gy2;
          vel.y = 0;
        } else onGround = false;
      }

      // 足音
      const sp = Math.hypot(vel.x, vel.z);
      if (onGround && sp > 0.8) {
        stepAcc += sp * dt;
        if (stepAcc > 2.1) {
          stepAcc = 0;
          G.audio?.sfx.step(G.terrain.distRoad(player.position.x, player.position.z) < 3.5);
        }
      }

      if (sp > 0.3) modelYaw = dampAngle(modelYaw, Math.atan2(vel.x, vel.z), 11, dt);
      player.rotation.y = modelYaw;
      char.animate(dt, sp, onGround, G.state.time);
    },

    updateCamera(dt) {
      const p = player.position;
      if (G.state.phase === 'SIT') {
        G.state.sitT += dt;
        const a = G.state.sitT * 0.15;
        camera.position.set(p.x + Math.sin(a) * 2.2, p.y + 1.7, p.z + 1.4 + Math.cos(a) * 1.4);
        camera.lookAt(p.x, p.y + 0.9, p.z + 14); // 窓のそと（グラウンド）方向
        return;
      }
      if (G.state.phase === 'PHOTO') {
        // ゆっくり自動オービット
        G.state.photoT += dt;
        const a = camYaw + Math.sin(G.state.photoT * 0.13) * 0.15;
        const d = 4.5;
        camera.position.set(
          p.x - Math.sin(a + Math.PI) * d,
          p.y + 1.7 + Math.sin(G.state.photoT * 0.21) * 0.5,
          p.z - Math.cos(a + Math.PI) * d);
        camera.lookAt(p.x, p.y + 1.1, p.z);
        return;
      }
      if (firstPerson) {
        camera.position.set(p.x, p.y + CFG.eyeH, p.z);
        const dx = Math.sin(camYaw + Math.PI) * Math.cos(camPitch);
        const dy = -Math.sin(camPitch);
        const dz = Math.cos(camYaw + Math.PI) * Math.cos(camPitch);
        camera.lookAt(p.x + dx, p.y + CFG.eyeH + dy, p.z + dz);
        return;
      }
      const indoors = G.school?.isIndoors(p);
      const dist = indoors ? CFG.camDistIndoor : CFG.camDist;
      const sideX = Math.cos(camYaw) * CFG.camShoulder, sideZ = -Math.sin(camYaw) * CFG.camShoulder;
      _camTarget.set(p.x + sideX, p.y + CFG.camHeight, p.z + sideZ);
      const dirX = -Math.sin(camYaw + Math.PI) * Math.cos(camPitch);
      const dirY = Math.sin(camPitch);
      const dirZ = -Math.cos(camYaw + Math.PI) * Math.cos(camPitch);
      let d = dist;
      for (const t of [0.45, 0.7, 1.0]) {
        if (pointBlocked(_camTarget.x + dirX * dist * t, _camTarget.y + dirY * dist * t, _camTarget.z + dirZ * dist * t)) {
          d = Math.min(d, dist * t - 0.45);
        }
      }
      d = Math.max(d, 0.9);
      const groundAt = colliders.getGroundY(_camTarget.x + dirX * d, _camTarget.z + dirZ * d);
      _camIdeal.set(
        _camTarget.x + dirX * d,
        Math.max(_camTarget.y + dirY * d, groundAt + 0.4),
        _camTarget.z + dirZ * d);
      _camCur.lerp(_camIdeal, 1 - Math.exp(-13 * dt));
      camera.position.copy(_camCur);
      camera.lookAt(_camTarget);
    },

    headingRad() {
      const fx = Math.sin(camYaw + Math.PI), fz = Math.cos(camYaw + Math.PI);
      return Math.atan2(fx, -fz);
    },
  };
  return P;
}
