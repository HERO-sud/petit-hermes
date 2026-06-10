// 無料アセット取得スクリプト（再現可能・出典は assets/LICENSES.md に記録）
// three.js 公式リポジトリ（MIT）＋ CC0 アセット（Quaternius / KayKit / Kenney 系ミラー）。
// 取得物はすべて git にコミットして自リポジトリから配信する（第三者ミラー消失対策）。
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const THREE = (tag, p) => `https://raw.githubusercontent.com/mrdoob/three.js/${tag}/examples/${p}`;
// Quaternius「Ultimate Animated Character Pack」(CC0) のGitHubミラー（自己完結.gltf・アニメ内蔵）
const CHAR = (n) => `https://raw.githubusercontent.com/dancerphil/games/main/shared/models/characters/${n}.gltf`;
// KayKit「City Builder Bits」(CC0)。.gltf が同階層の .bin / citybits_texture.png を相対参照する
const KAYKIT = (f) => `https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/main/addons/kaykit_city_builder_bits/Assets/gltf/${f}`;
// pmndrs/market-assets (CC0, Kenney/Quaternius 由来)
const MARKET = (s) => `https://raw.githubusercontent.com/pmndrs/market-assets/main/files/models/${s}/model.gltf`;

const ASSETS = [
  // 実写テクスチャ（地形・水・店内床）
  { url: THREE('r170', 'textures/terrain/grasslight-big.jpg'), out: 'assets/textures/grass_diff.jpg', min: 2_000_000 },
  { url: THREE('r140', 'textures/terrain/grasslight-big-nm.jpg'), out: 'assets/textures/grass_nm.jpg', min: 100_000 },
  { url: THREE('r170', 'textures/waternormals.jpg'), out: 'assets/textures/waternormals.jpg', min: 200_000 },
  { url: THREE('r170', 'textures/hardwood2_diffuse.jpg'), out: 'assets/textures/hardwood_diff.jpg', min: 300_000 },
  { url: THREE('r170', 'textures/hardwood2_bump.jpg'), out: 'assets/textures/hardwood_bump.jpg', min: 80_000 },
  { url: THREE('r170', 'textures/hardwood2_roughness.jpg'), out: 'assets/textures/hardwood_rough.jpg', min: 100_000 },
  // 実写HDRI（屋外環境光）— spruit_sunrise: 里山の日の出・開けた地平線
  { url: THREE('r170', 'textures/equirectangular/spruit_sunrise_1k.hdr'), out: 'assets/hdri/morning_1k.hdr', min: 800_000 },
  { url: THREE('r170', 'textures/equirectangular/venice_sunset_1k.hdr'), out: 'assets/hdri/evening_1k.hdr', min: 1_000_000 },

  // ---- キャラクター（Quaternius UAC, CC0, Idle/Walk/Run 等アニメ内蔵）----
  ...[
    'Casual_Male',     // プレイヤー
    'Casual_Female',   // 大下さん（店主・エプロン小物を装着）
    'Worker_Male',     // 田中さん（農家）
    'OldClassy_Male',  // バス停の老人
    'Kimono_Female',   // 祠のおばあちゃん
    'Casual2_Male',    // 畑近くの村人
    'Casual3_Female',  // 犬の散歩の人
    'Casual_Bald',     // 子供（縮小表示）
    'Pug',             // 犬
  ].map((n) => ({ url: CHAR(n), out: `assets/models/characters/${n}.gltf`, min: 200_000, gltfDeps: true })),

  // ---- 車・建物（KayKit City Builder Bits, CC0）----
  ...['car_sedan', 'car_hatchback', 'car_taxi', 'building_B', 'building_D', 'building_F']
    .map((n) => ({ url: KAYKIT(`${n}.gltf`), out: `assets/models/kaykit/${n}.gltf`, min: 2_000, gltfDeps: true })),

  // ---- 軽トラ代用（pmndrs market-assets, CC0。Draco圧縮）----
  { url: MARKET('truck-flat'), out: 'assets/models/market/truck-flat/model.gltf', min: 20_000, gltfDeps: true },

  // ---- Dracoデコーダ（three.js 同梱, MIT）— market系GLTFの展開に必要・ローカル配信 ----
  ...['draco_decoder.wasm', 'draco_wasm_wrapper.js', 'draco_decoder.js']
    .map((f) => ({ url: THREE('r170', `jsm/libs/draco/gltf/${f}`), out: `assets/draco/${f}`, min: 10_000 })),
];

async function fetchTo(url, out, min) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < min) throw new Error(`too small: ${buf.length}B: ${url}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
  return buf;
}

// .gltf が相対参照する外部ファイル（buffers/images の非 data: URI）を同じベースURLから取得する
async function fetchGltfDeps(gltfBuf, srcUrl, outPath) {
  const json = JSON.parse(gltfBuf.toString('utf8'));
  const uris = [...(json.buffers ?? []), ...(json.images ?? [])]
    .map((x) => x.uri)
    .filter((u) => u && !u.startsWith('data:'));
  const baseUrl = srcUrl.slice(0, srcUrl.lastIndexOf('/') + 1);
  const baseDir = dirname(outPath);
  for (const uri of new Set(uris)) {
    const depOut = join(baseDir, uri);
    if (existsSync(depOut) && statSync(depOut).size > 1024) continue;
    const buf = await fetchTo(baseUrl + uri, depOut, 1024);
    console.log(`  dep ${(buf.length / 1e6).toFixed(2)}MB → ${uri}`);
  }
}

let fail = 0;
for (const a of ASSETS) {
  const out = join(ROOT, a.out);
  try {
    let buf = null;
    if (existsSync(out) && statSync(out).size >= a.min) {
      console.log(`skip (exists): ${a.out}`);
    } else {
      process.stdout.write(`fetch ${a.url} ... `);
      buf = await fetchTo(a.url, out, a.min);
      console.log(`${(buf.length / 1e6).toFixed(2)}MB → ${a.out}`);
    }
    if (a.gltfDeps) {
      buf ??= Buffer.from(await import('node:fs/promises').then((fs) => fs.readFile(out)));
      await fetchGltfDeps(buf, a.url, out);
    }
  } catch (e) {
    console.error(`FAILED: ${e.message}`);
    fail = 1;
  }
}
process.exit(fail);
