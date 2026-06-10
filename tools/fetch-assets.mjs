// 無料アセット取得スクリプト（再現可能・出典は assets/LICENSES.md に記録）
// すべて three.js 公式リポジトリ（MITライセンス）の examples アセット。
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const THREE = (tag, p) => `https://raw.githubusercontent.com/mrdoob/three.js/${tag}/examples/${p}`;

const ASSETS = [
  // リアル人体（Mixamoリグ・Idle/Walk/Run アニメ内蔵）
  { url: THREE('r170', 'models/gltf/Soldier.glb'), out: 'assets/models/character.glb', min: 2_000_000 },
  // 実写テクスチャ
  { url: THREE('r170', 'textures/terrain/grasslight-big.jpg'), out: 'assets/textures/grass_diff.jpg', min: 2_000_000 },
  { url: THREE('r140', 'textures/terrain/grasslight-big-nm.jpg'), out: 'assets/textures/grass_nm.jpg', min: 100_000 },
  { url: THREE('r170', 'textures/waternormals.jpg'), out: 'assets/textures/waternormals.jpg', min: 200_000 },
  { url: THREE('r170', 'textures/hardwood2_diffuse.jpg'), out: 'assets/textures/hardwood_diff.jpg', min: 300_000 },
  { url: THREE('r170', 'textures/hardwood2_bump.jpg'), out: 'assets/textures/hardwood_bump.jpg', min: 80_000 },
  { url: THREE('r170', 'textures/hardwood2_roughness.jpg'), out: 'assets/textures/hardwood_rough.jpg', min: 100_000 },
  // 実写HDRI（屋外環境光）— spruit_sunrise: 里山の日の出・開けた地平線
  { url: THREE('r170', 'textures/equirectangular/spruit_sunrise_1k.hdr'), out: 'assets/hdri/morning_1k.hdr', min: 800_000 },
  { url: THREE('r170', 'textures/equirectangular/venice_sunset_1k.hdr'), out: 'assets/hdri/evening_1k.hdr', min: 1_000_000 },
];

let fail = 0;
for (const a of ASSETS) {
  const out = join(ROOT, a.out);
  if (existsSync(out) && statSync(out).size >= a.min) {
    console.log(`skip (exists): ${a.out}`);
    continue;
  }
  process.stdout.write(`fetch ${a.url} ... `);
  try {
    const res = await fetch(a.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < a.min) throw new Error(`too small: ${buf.length}B`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, buf);
    console.log(`${(buf.length / 1e6).toFixed(2)}MB → ${a.out}`);
  } catch (e) {
    console.error(`FAILED: ${e.message}`);
    fail = 1;
  }
}
process.exit(fail);
