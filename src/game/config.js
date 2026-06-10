// ============================================================
// CONFIG — 定数・ワールド座標・商品・セリフ・品質ティア
// ============================================================

export const CFG = {
  walkSpeed: 3.4, sprintSpeed: 6.4, accel: 30, jumpVel: 4.6, gravity: -16,
  playerR: 0.38, playerH: 1.62, eyeH: 1.55,
  camDist: 3.6, camDistIndoor: 2.4, camShoulder: 0.5, camHeight: 1.5,
  startMoney: 1000,
  worldSize: 1200,          // 地形全体
  innerSize: 700,           // 内周高解像度メッシュ
  dayLengthSec: 1200,       // 朝→夕方 実時間20分
  hdriRotationY: 2.6,       // HDRIの太陽方位をワールド南東に合わせる回転
  spawn: { x: 30.2, z: 44 },  // バス停そば（道路の東脇）
};

// ---- ワールドレイアウト（原点=校舎前、+X=東、-Z=北）----
export const L = {
  school:   { x: 0, z: -60, w: 36, d: 9, h: 7.4 },   // 旧南方小学校（南向き）
  bakeryDoor: { x: 8, z: -55.4 },
  bakeryIn: { x: 8, z: -58 },
  cafeChair:{ x: -6, z: -56.6 },
  grounds:  { x: 0, z: -22, w: 70, d: 48 },
  cones:    { x: 14, z: -38 },
  gym:      { x: -35, z: -66, w: 28, d: 18 },
  center:   { x: 42, z: -68, w: 18, d: 12 },          // 南方総合センター
  busStop:  { x: 29.8, z: 40 },  // 県道の東脇
  bridge:   { x: 60, z: -5 },
  tanakaField: { x: -52, z: 25 },
  tanakaNpc:   { x: -48, z: 22 },
  yuzuHill: { x: -120, z: 140 },
  compost:  { x: 15, z: -67.5 },
  shrine:   { x: -80, z: -140 },
  bamboo:   { x: -150, z: -60 },
  // 県道スプライン制御点（南→北）
  roadPts: [ [34, 560], [30, 300], [25, 120], [25, 40], [18, -40], [12, -120], [-8, -300], [-30, -560] ],
  // 農家への小道
  pathTanaka: [ [22, 28], [-20, 26], [-48, 24] ],
  pathYuzu:   [ [24, 80], [-40, 110], [-110, 138] ],
  // 川中心線（南→北、東側）
  riverPts: [ [96, 560], [88, 300], [95, 120], [86, 0], [94, -140], [88, -320], [96, -560] ],
  riverW: 10,
  // 田んぼ（x,z,w,d）川と県道の間+西側
  paddies: [
    [55, 120, 34, 42], [55, 70, 34, 40], [58, 20, 30, 40], [56, -40, 32, 38], [58, -90, 30, 38],
    [55, -140, 32, 40], [-10, 120, 36, 40], [-12, 70, 36, 40], [-14, 170, 34, 40],
    [52, 175, 30, 42], [-55, 80, 30, 36], [-58, 130, 30, 36], [55, -190, 30, 40], [-12, 220, 36, 40],
  ],
  // 農家（x,z,回転,シード）
  houses: [
    [-60, 80, 0.3, 1], [-90, 10, -0.5, 2], [55, 145, 0.15, 3], [70, -110, 0.7, 4],
    [-45, 170, -0.2, 5], [95, 60, 0.45, 6], [-95, -50, 0.1, 7], [40, 215, -0.4, 8],
    [-70, 220, 0.25, 9], [85, -180, -0.15, 10],
  ],
  greenhouses: [ [-70, 50, 0.2], [68, 95, -0.1] ],
};

// ---- ショップ（実商品をモチーフにしたゲーム内表記）----
export const SHOP_ITEMS = [
  { id: 'camp_plain',  em: '🍞', name: 'プチカンパーニュ プレーン', price: 600 },
  { id: 'camp_raisin', em: '🍇', name: 'プチカンパーニュ レーズン', price: 600 },
  { id: 'camp_choco',  em: '🍫', name: 'プチカンパーニュ チョコ',   price: 600 },
  { id: 'camp_walnut', em: '🌰', name: 'プチカンパーニュ クルミ',   price: 600 },
  { id: 'shokupan',    em: '🍞', name: '食パン（ふんわり）',        price: 700 },
  { id: 'focaccia',    em: '🫓', name: 'フォカッチャ',              price: 450 },
  { id: 'confiture',   em: '🍓', name: '季節のコンフィチュール',    price: 1000 },
  { id: 'coffee',      em: '☕', name: 'オリジナルブレンドコーヒー', price: 400 },
];

// ---- 目標（オープンワールド・すべて任意）----
export const OBJECTIVES = [
  { id: 'bakery',  mk: '🍞', name: 'パン屋「プチヘルメース」へ行く', desc: '廃校になった小学校の1階。グラウンド側の入口から。', target: () => L.bakeryDoor, core: true },
  { id: 'veg',     mk: '🥕', name: 'きかく外やさいを 3つ あつめて 田中さんへ', desc: '田中さんの畑に、形はわるいけど あじは一級品のやさいが。', target: () => L.tanakaNpc, count: 3 },
  { id: 'yuzu',    mk: '🍋', name: 'ゆずを 3つ しゅうかくする', desc: '西のおかに ゆずの木がある。酵母（こうぼ）のもとになるよ。', target: () => L.yuzuHill, count: 3 },
  { id: 'compost', mk: '🌀', name: 'ぐるぐるコンポストに くずを入れる', desc: '校舎のうらがわ。「今日のパンが、明日の野菜に。」', target: () => L.compost },
  { id: 'photo',   mk: '📷', name: 'すきな景色を 3まい 撮る（Pキー）', desc: 'フォトモードで里山のきれいなところをさがそう。', target: () => null, count: 3 },
  { id: 'cafe',    mk: '☕', name: '教室カフェで ひとやすみ', desc: 'パンを買ったら、となりの教室カフェの窓ぎわで。', target: () => L.cafeChair },
];

// ---- セリフ ----
export const DIALOGS = {
  tanaka1: { name: '農家の田中さん', lines: [
    'おお、バスで来た子じゃね！ようこそ南方（みなみがた）へ。',
    'うちの畑のやさい、ちょっと形がわるうて お店に出せんのよ。でもな、あじは一級品なんじゃ。',
    'パン屋のプチヘルメースさんが「酵母（こうぼ）」にして パンにいかしてくれるけえ、3つ もっていってくれんかね？',
  ]},
  tanaka2: { name: '農家の田中さん', lines: [ 'すまんのう！のこりのやさいも たのんだで。' ]},
  tanaka3: { name: '農家の田中さん', lines: [
    'ようけ あつめてくれたのう！プチヘルメースさんに とどけちゃってくれ。',
    'すてるはずのものが パンになる。「今日のパンが、明日の野菜に。」っちゅうやつじゃ。',
  ]},
  oshita1: { name: '店主の大下さん', lines: [
    'いらっしゃいませ、プチヘルメースへ ようこそ！',
    'ここはね、2013年に閉校した 南方小学校の校舎なんよ。子どもたちの声のかわりに、いまはパンの香りがひろがってるの。',
    '「ヘルメース」は、泉から出てきて しあわせをくばる神さまの名前。きみにも しあわせのおすそわけ！',
  ]},
  oshitaVeg: { name: '店主の大下さん', lines: [
    'あら、そのやさいとゆず…田中さんとこのじゃね！ありがとう、げんきな酵母（こうぼ）に そだてるね。',
    'はい、おつかいのおれい。おこづかい500円！すきなパンを えらんでね。',
  ]},
  oshitaShop: { name: '店主の大下さん', lines: [ 'どうぞ、ゆっくりみていってね。' ]},
  oshitaAfter: { name: '店主の大下さん', lines: [
    'おとなりの教室は カフェになってるんよ。グラウンドをながめて ひとやすみしていきんさい☕',
  ]},
  compost: { name: 'ぐるぐるコンポスト', lines: [
    'やさいのくずを 入れた。生ごみが ふかふかの土に もどっていく…',
  ]},
  stand: { name: 'プチカンパーニュくん（看板）', lines: [
    '『ようこそ！ここのパンは、やきたてから日がたつごとに あじわいが ふかくなるよ』と書いてある。',
  ]},
  shrine: { name: 'ちいさな祠', lines: [ '村をみまもる ちいさな祠。そっと手をあわせた。' ]},
  busstop: { name: 'バス停「南方小学校前」', lines: [ '時刻表は 1日に4本。のんびりした谷の時間がながれている。' ]},
};

export const DISCLAIMER = '※架空のファンメイドデモです。実際の情報は公式Instagram @petit_hermes へ';

// ---- 品質ティア ----
export const TIERS = {
  // E2E/最弱端末向け（自動昇格の対象外、?q=min でのみ使用）
  min: {
    label: '最小', pixelRatio: 0.75, shadowSize: 512, anisotropy: 1,
    grass: 800, trees: 60, impostors: 200, rice: 600, bamboo: 12,
    grassRadius: 18, fogDensity: 0.0028, post: 'none', waterRT: 0, msaa: false,
  },
  low: {
    label: '低', pixelRatio: 1.0, shadowSize: 1024, anisotropy: 2,
    grass: 10000, trees: 350, impostors: 1500, rice: 6000, bamboo: 40,
    grassRadius: 38, fogDensity: 0.0024, post: 'none', waterRT: 0, msaa: true,
  },
  mid: {
    label: '中', pixelRatio: 1.5, shadowSize: 2048, anisotropy: 4,
    grass: 30000, trees: 700, impostors: 3500, rice: 14000, bamboo: 80,
    grassRadius: 65, fogDensity: 0.0016, post: 'bloom', waterRT: 256, msaa: false,
  },
  high: {
    label: '高', pixelRatio: 2.0, shadowSize: 4096, anisotropy: 8,
    grass: 60000, trees: 1200, impostors: 6000, rice: 24000, bamboo: 120,
    grassRadius: 100, fogDensity: 0.0011, post: 'full', waterRT: 512, msaa: false,
  },
};
