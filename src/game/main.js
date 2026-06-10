// 『みなみがたの朝 〜廃校のパン屋へ〜』 bootstrap & メインループ
import * as THREE from 'three';
import { CFG, L, DIALOGS } from './config.js';
import { buildTextures } from './gen/textures.js';
import { createQuality } from './core/quality.js';
import { createRenderer } from './core/renderer.js';
import { createSky } from './core/sky.js';
import { createPostFX } from './core/postfx.js';
import { createColliders } from './world/colliders.js';
import { createTerrain } from './world/terrain.js';
import { createRoads } from './world/roads.js';
import { createWater } from './world/water.js';
import { createVegetation } from './world/vegetation.js';
import { createSchool } from './world/school.js';
import { createVillage } from './world/village.js';
import { createPlayer } from './entities/player.js';
import { createNPCs } from './entities/npc.js';
import { preloadCharacter } from './entities/character.js';
import { loadTex } from './core/loaders.js';
import { createInteract } from './systems/interact.js';
import { createObjectives } from './systems/objectives.js';
import { createAudio } from './systems/audio.js';
import { createHUD } from './ui/hud.js';
import { createDialog } from './ui/dialog.js';
import { createShop } from './ui/shop.js';
import { createPhotoMode } from './ui/photomode.js';

const $ = (id) => document.getElementById(id);
const loadNote = (t) => { const el = $('tLoad'); if (el) el.textContent = t; };

// ---- ゲームコンテキスト ----
const G = {
  state: {
    phase: 'TITLE',   // TITLE INTRO PLAY DIALOG SHOP PHOTO SIT END
    time: 0,
    money: CFG.startMoney,
    breadsBought: [], boughtCount: 0, eatenCount: 0,
    vegCount: 0, yuzuCount: 0,
    paidOnce: false, metTanaka: false, gaveOshita: false, greetedOshita: false,
    sitT: 0, photoT: 0,
  },
};

async function boot() {
  loadNote('テクスチャを生成中…');
  await tick();
  G.quality = createQuality(G);
  G.tex = buildTextures(G.quality.tier.anisotropy);

  const { renderer, scene, camera, canvas } = createRenderer(G.quality.tier);
  Object.assign(G, { renderer, scene, camera, canvas });

  loadNote('実写HDRIの空をよみこみ中…');
  G.sky = await createSky(G);
  G.sky.setShadowSize(G.quality.tier.shadowSize);
  scene.fog.density = G.quality.tier.fogDensity;

  loadNote('実写テクスチャをよみこみ中…');
  // 実写素材でプロシージャルテクスチャを上書き（地形の草・水面・店内床）
  try {
    const [gd, wn, hd, hb, hr] = await Promise.all([
      loadTex('assets/textures/grass_diff.jpg', { repeat: [0.5, 0.5], aniso: G.quality.tier.anisotropy }),
      loadTex('assets/textures/waternormals.jpg', { srgb: false }),
      loadTex('assets/textures/hardwood_diff.jpg', { repeat: [7, 2.5] }),
      loadTex('assets/textures/hardwood_bump.jpg', { srgb: false, repeat: [7, 2.5] }),
      loadTex('assets/textures/hardwood_rough.jpg', { srgb: false, repeat: [7, 2.5] }),
    ]);
    // 拡散は実写、法線はタイル可能なプロシージャルを維持（実写NMは法線が壊れるため）
    G.tex.grass.map = gd;
    G.tex.waterNormal = wn;
    G.tex.hardwood = { map: hd, bumpMap: hb, roughnessMap: hr };
  } catch (e) {
    console.warn('実写テクスチャの読込に失敗。プロシージャルで続行:', e.message);
  }

  loadNote('キャラクターをよみこみ中…');
  await preloadCharacter();

  loadNote('地形を生成中…');
  await tick();
  G.colliders = createColliders();
  G.terrain = createTerrain(G);

  loadNote('村をつくっています…');
  await tick();
  G.roads = createRoads(G);
  G.water = createWater(G);
  G.school = createSchool(G);
  G.village = createVillage(G);

  loadNote('草と木を植えています…');
  await tick();
  G.vegetation = createVegetation(G);

  loadNote('じゅんびちゅう…');
  await tick();
  G.player = createPlayer(G);
  G.npcs = createNPCs(G);
  G.audio = createAudio(G);
  G.hud = createHUD(G);
  G.interact = createInteract(G);
  G.objectives = createObjectives(G);
  G.dialog = createDialog(G);
  G.shop = createShop(G);
  G.photo = createPhotoMode(G);
  G.postfx = createPostFX(G);
  G.postfx.build(G.quality.tier.post);
  G.quality.onChange((t) => G.postfx.build(t.post));

  setupGameplay();
  setupDebug();

  loadNote('');
  $('startBtn').disabled = false;
  $('fade').style.opacity = '0';

  requestAnimationFrame(loop);
}
const tick = () => new Promise(r => setTimeout(r, 0));

// ---- スロット使用（パンをたべる）----
G.useSlot = (n) => {
  if (n >= 3 && n <= 6) {
    const i = n - 3;
    const b = G.state.breadsBought[i];
    if (!b) return;
    G.state.breadsBought.splice(i, 1);
    G.state.eatenCount++;
    G.hud.renderHotbar();
    G.audio.sfx.eat();
    G.hud.toast(`${b.em} ${b.name} をたべた！おいしい！`, 'gold');
  }
};

// ---- インタラクト・目標の組み立て ----
function setupGameplay() {
  const I = G.interact, O = G.objectives, D = G.dialog, st = G.state;

  // 田中さん
  I.add({
    x: G.npcs.tanaka.x, z: G.npcs.tanaka.z, r: 3.2, label: '田中さんと 話す',
    enabled: () => true,
    onUse() {
      if (!st.metTanaka) {
        st.metTanaka = true;
        D.start(DIALOGS.tanaka1);
      } else if (st.vegCount >= 3 && !O.isDone('veg')) {
        D.start(DIALOGS.tanaka3, () => O.complete('veg'));
      } else {
        D.start(DIALOGS.tanaka2);
      }
    },
  });
  // 規格外野菜
  for (const v of G.village.veggies) {
    I.add({
      x: v.x, z: v.z, r: 2.6, key: 'E', label: v.label,
      enabled: () => !v.taken,
      onUse() {
        v.taken = true;
        v.mesh.visible = false;
        st.vegCount++;
        G.hud.renderHotbar(); G.hud.popSlot(1);
        G.audio.sfx.pickup();
        G.hud.toast('🥕 きかく外やさい をひろった');
        O.progress('veg');
      },
    });
  }
  // ゆず
  for (const y of G.village.yuzus) {
    I.add({
      x: y.x, z: y.z, r: 2.6, key: 'E', label: y.label,
      enabled: () => !y.taken,
      onUse() {
        y.taken = true;
        y.mesh.visible = false;
        st.yuzuCount++;
        G.hud.renderHotbar(); G.hud.popSlot(2);
        G.audio.sfx.pickup();
        G.hud.toast('🍋 ゆず をしゅうかくした');
        O.progress('yuzu');
      },
    });
  }
  // コンポスト
  I.add({
    x: L.compost.x, z: L.compost.z, r: 3.0, label: 'やさいくずを 入れる',
    enabled: () => !O.isDone('compost'),
    onUse() {
      D.start(DIALOGS.compost, () => {
        G.hud.telop('「今日のパンが、明日の野菜に。」', '生ごみ → たいひ → やさい → パン。めぐる、めぐる。');
        O.complete('compost');
      });
    },
  });
  // 大下さん
  I.add({
    x: G.npcs.oshita.x, z: G.npcs.oshita.z, r: 3.4, label: '大下さんと 話す',
    enabled: () => true,
    onUse() {
      if (!st.greetedOshita) {
        st.greetedOshita = true;
        D.start(DIALOGS.oshita1, () => {
          if ((st.vegCount >= 3 || st.yuzuCount >= 3) && !st.gaveOshita) giveProduce();
          else G.shop.open();
        });
      } else if ((st.vegCount >= 3 || st.yuzuCount >= 3) && !st.gaveOshita) {
        giveProduce();
      } else if (st.boughtCount > 0) {
        D.start(DIALOGS.oshitaAfter);
      } else {
        D.start(DIALOGS.oshitaShop, () => G.shop.open());
      }
    },
  });
  function giveProduce() {
    D.start(DIALOGS.oshitaVeg, () => {
      st.gaveOshita = true;
      st.vegCount = 0; st.yuzuCount = 0;
      G.hud.renderHotbar();
      st.money += 500;
      G.hud.toast('+500円 おこづかい！', 'gold');
      G.shop.open();
    });
  }
  // 看板スタンディ
  I.add({
    x: L.bakeryDoor.x + 1.7, z: L.bakeryDoor.z + 0.6, r: 2.2, label: 'かんばんを 見る',
    enabled: () => true,
    onUse() { D.start(DIALOGS.stand); },
  });
  // 祠
  I.add({
    x: L.shrine.x, z: L.shrine.z + 1.6, r: 2.6, label: '手をあわせる',
    enabled: () => true,
    onUse() { D.start(DIALOGS.shrine); },
  });
  // バス停
  I.add({
    x: L.busStop.x, z: L.busStop.z, r: 2.6, label: '時刻表を 見る',
    enabled: () => true,
    onUse() { D.start(DIALOGS.busstop); },
  });
  // カフェの椅子（パン購入後）
  I.add({
    x: L.cafeChair.x, z: L.cafeChair.z, r: 2.2, label: 'すわって ひとやすみ',
    enabled: () => st.boughtCount > 0,
    onUse() {
      st.phase = 'SIT';
      st.sitT = 0;
      st.sitStart = performance.now();
      G.player.pos.set(L.cafeChair.x, 0.42, L.cafeChair.z);
      G.player.group.rotation.y = 0;
      G.player.char.pose('sit');
      O.complete('cafe');
    },
  });
}

// ---- パン屋入店の検知 ----
let wasInside = false;
function checkBakeryEntry() {
  const inside = G.school.isInsideBakery(G.player.pos);
  if (inside && !wasInside) {
    G.audio.sfx.doorbell();
    if (!G.objectives.isDone('bakery')) {
      G.objectives.complete('bakery');
      G.hud.telop('🍞 ふわぁ…パンのいいにおい！', '元・教室がパン屋さんになっている');
    }
  }
  wasInside = inside;
}

// ---- 導入: 路線バス到着 ----
function startIntro() {
  G.audio.init();
  $('title').classList.add('hidden');
  G.hud.show();
  G.state.phase = 'INTRO';
  G.state.introT = 0;
  G.village.bus.visible = true;
  G.audio.sfx.bus();
}
function updateIntro(dt) {
  const st = G.state;
  st.introT += dt;
  const bus = G.village.bus;
  const curve = G.roads.curve;
  // バスが南から到着 → 停車 → プレイヤー降車 → バス発車
  const arrive = Math.min(st.introT / 5.5, 1);
  const tParam = 0.62 - (0.62 - 0.455) * easeOut(arrive);
  const p = curve.getPoint(tParam);
  const tan = curve.getTangent(tParam);
  bus.position.set(p.x, G.terrain.heightAt(p.x, p.z) + 0.05, p.z);
  bus.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI;
  // カメラ: バス停から見る
  G.camera.position.set(L.busStop.x + 7, G.terrain.heightAt(L.busStop.x + 7, L.busStop.z + 9) + 2.2, L.busStop.z + 9);
  G.camera.lookAt(bus.position.x, bus.position.y + 1.6, bus.position.z);
  if (st.introT > 6.2 && st.introT < 6.3 && !st.doorPlayed) {
    st.doorPlayed = true;
    G.audio.sfx.doorbell();
  }
  if (st.introT > 7.2) {
    st.phase = 'PLAY';
    G.player.teleport(CFG.spawn.x, CFG.spawn.z);
    G.player.yaw = 0; // 北（学校方面）
    G.hud.locationTitle('みなみがたの朝', 'HIROSHIMA · KITAHIROSHIMA · MINAMIGATA');
    G.hud.telop('🍞 パン屋「プチヘルメース」をたずねよう', '北のほう、廃校の小学校の1階だよ（Mで目標いちらん）');
    // バスは走り去る
    departBus();
  }
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function departBus() {
  let t0 = 0.455;
  const iv = setInterval(() => {
    t0 -= 0.0022;
    if (t0 < 0.32) { G.village.bus.visible = false; clearInterval(iv); return; }
    const p = G.roads.curve.getPoint(t0);
    const tan = G.roads.curve.getTangent(t0);
    G.village.bus.position.set(p.x, G.terrain.heightAt(p.x, p.z) + 0.05, p.z);
    G.village.bus.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI;
  }, 33);
}

// ---- エンドカード ----
function showEndcard() {
  G.state.phase = 'END';
  G.player.exitLock();
  const O = G.objectives.state;
  const done = Object.values(O).filter(s => s.done).length;
  $('endStats').innerHTML =
    `<div>🍞 かったパン ${G.state.boughtCount}こ</div>` +
    `<div>📷 しゃしん ${O.photo.count}まい</div>` +
    `<div>✅ もくひょう ${done}/6</div>`;
  $('endcard').classList.remove('hidden');
  G.audio.sfx.end();
}
$('againBtn').addEventListener('click', () => location.reload());
$('startBtn').addEventListener('click', startIntro);

// ---- デバッグ/E2Eフック ----
function setupDebug() {
  window.__game = {
    G, // デバッグ用にコンテキスト全体を公開
    state: G.state,
    player: { get position() { return G.player.pos; } },
    teleport: (x, z) => G.player.teleport(x, z),
    setYaw: (y) => { G.player.yaw = y; },
    camera: G.camera,
    renderer: G.renderer,
    quality: { get name() { return G.quality.name; }, setTier: (n) => G.quality.setTier(n) },
    setTimeOfDay: (t) => { G.sky.timeOfDay = t; },
    objectives: G.objectives,
    interact: G.interact,
    openShop: () => G.shop.open(),
    showEndcard,
    vegetation: G.vegetation,
    postfx: G.postfx,
    skipIntro: () => {
      if (G.state.phase === 'INTRO') { G.state.introT = 99; updateIntro(0.001); }
    },
  };
}

// ---- メインループ ----
const clock = new THREE.Clock();
const fpsEl = $('fps');
const debugMode = location.search.includes('debug');
if (debugMode) fpsEl.classList.remove('hidden');
let fpsN = 0, fpsLast = performance.now();

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const st = G.state;
  st.time += dt;

  const input = G.player.input;
  if (input.view && (st.phase === 'PLAY')) G.player.toggleView();
  if (input.photo && (st.phase === 'PLAY' || st.phase === 'PHOTO')) G.photo.toggle();
  if (input.map && (st.phase === 'PLAY')) G.objectives.togglePanel();
  if (input.act && st.phase === 'PHOTO') G.photo.shoot();
  if (input.useSlot && st.phase === 'PLAY') { G.useSlot(input.useSlot); input.useSlot = 0; }

  if (st.phase === 'TITLE') {
    // タイトル裏: 谷をゆっくり俯瞰
    const a = st.time * 0.05;
    G.camera.position.set(Math.sin(a) * 150, 55, Math.cos(a) * 150 - 10);
    G.camera.lookAt(0, 4, -30);
  } else if (st.phase === 'INTRO') {
    updateIntro(dt);
  } else {
    G.player.update(dt);
    G.player.updateCamera(dt);
    if (st.phase === 'PLAY') checkBakeryEntry();
    if (st.phase === 'SIT' && performance.now() - st.sitStart > 7000) showEndcard();
  }

  const heavy = G.sky.update(dt, st.phase === 'TITLE' ? null : G.player.pos);
  G.quality.update(dt);
  if (!heavy) G.vegetation.update(dt, st.phase === 'TITLE' ? G.camera.position : G.player.pos);
  G.water.update(dt);
  G.school.update(dt, G.player.pos);
  G.npcs.update(dt, G.player.pos);
  G.interact.update(dt);
  G.objectives.update();
  G.audio.update(G.player.pos);
  if (st.phase !== 'TITLE' && st.phase !== 'END') G.hud.update();

  input.act = false; input.view = false; input.photo = false; input.map = false;

  G.postfx.render();

  if (debugMode) {
    fpsN++;
    const now = performance.now();
    if (now - fpsLast > 600) {
      const info = G.renderer.info.render;
      fpsEl.textContent = `${Math.round(fpsN / ((now - fpsLast) / 1000))}fps calls:${info.calls} tris:${(info.triangles / 1e3).toFixed(0)}k tier:${G.quality.name}`;
      fpsN = 0; fpsLast = now;
    }
  }
}

$('startBtn').disabled = true;
boot();
