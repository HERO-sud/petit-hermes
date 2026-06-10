# ARCHITECTURE — 『みなみがたの朝』

## 設計制約
- **ビルドレス**: GitHub Pagesに素のESMで配信。バンドラ・トランスパイラなし
- **依存は three.js のみ**（CDN・バージョンピン）。npm依存は開発用のみ
- **アセットは無料ライセンスのみ**（MIT/CC0、`assets/LICENSES.md`）。
  それ以外は全てプロシージャル生成（`gen/textures.js`）

## モジュール構成（src/game/）
```
main.js            bootstrap・フェーズ管理・メインループ・__gameフック
config.js          CFG定数 / ワールド座標表 L / 商品 / セリフ / 品質ティア
core/  renderer    WebGLRenderer・カメラ・コンテキスト喪失対応
       sky         実写HDRI背景+IBL・太陽光（影）・露出の時刻変化
       weather     天候状態機械（晴/霧/雨）・雨粒Points・風/雨音/霧連動
       loaders     GLB/HDR/テクスチャの非同期ロード（Draco対応）
       postfx      Bloom+SMAAコンポーザ（ティア別）
       quality     低/中/高オートスケーラ（fpsヒステリシス）
gen/   noise       seed付きfbm/ridged・数学ユーティリティ
       textures    プロシージャルPBR工場（高さ場→Sobel法線→粗さ）
       materials   school/village共有マテリアルファクトリ
world/ props       配置用GLBプロップ（車・民家）の事前ロード+実寸設置
       terrain     ハイトフィールド+スプラットシェーダ+getGroundY
       roads       県道リボン・電柱+垂れ電線・ガードレール・橋
       water       川(平面反射)・田んぼ水鏡
       vegetation  草/杉・赤松/稲/竹/遠景インポスタ（Instanced+風）
       school      校舎・パン屋内装・カフェ・体育館・総合センター
       village     農家・車(GLB)・バス停・祠・コンポスト・収集物・バス
       colliders   円柱vsAABB/円の衝突・地面高さ
entities/ character  トゥーン調GLTF（Quaternius）役柄別ロード+アニメブレンド
          player     入力（KB/マウス/タッチ）・移動・カメラリグ（ジャンプなし/ダッシュあり）
          npc        大下さん/田中さん+村人6体（徘徊・犬追従・視線追従）
systems/ interact   [F/E]プロンプト / objectives 任意目標+光柱 / audio WebAudio
ui/    hud         徹底ミニマルHUD（所持金/ホットバーは変化時のみ表示）
       dialog/shop 会話・購入（現金/PayPay）
       photomode   P: HUD非表示+撮影
```

## Gコンテキスト（依存の要点）
`main.js` が全システムを生成し単一オブジェクト `G` で配線する。
読み書きの中心は `G.state`（phase/money/カウント類）。
worldモジュールは `G.scene/G.tex/G.colliders/G.terrain` に依存、
uiは `G.state/G.player/G.audio` に依存。循環なし（コールバックは
`quality.onChange` のみ）。

## ビジュアル方針
キャラ・車・一部民家は **CC0トゥーン素材**（Quaternius / KayKit / Kenney系）、
建物の手組みプリミティブは**フラット彩色**で統一。ライティングだけは
実写HDRI+IBLを維持し「絵本の世界に本物の朝の光」を狙う。

## グラフィックパイプライン
1. HDRI（spruit_sunrise 1k）→ 背景 + PMREM 1回 → `scene.environment`
2. DirectionalLight（HDRIの太陽に整合・プレイヤー追従シャドウ
   ・テクセルスナップ・**normalBiasはテクセルサイズ比例**）
3. 地形: MeshStandardMaterial + onBeforeCompile 4種スプラット。
   制御テクスチャは **DataTexture**（canvas経由はα=0画素のRGBが
   プリマルチプライで消えるため不可）
4. 植生カットアウトも同理由で `cutoutTexture()`（DataTexture）を使用
5. ポスト: Bloom+SMAA（低ティアはMSAA直描き）

## 品質ティア
| | min(E2E) | low | mid | high |
|---|---|---|---|---|
| 草/木/稲 | 0.8k/60/0.6k | 10k/350/6k | 30k/700/14k | 60k/1200/24k |
| 影 | 512 | 1024 | 2048 | 4096 |
| 水反射RT | なし | なし | 256 | 512 |
| ポスト | なし | なし | Bloom+SMAA | Bloom+SMAA |

## テスト
`tools/e2e/` — server.mjs（CDN→node_modules差し替え配信）、
full-flow（全行程アサート）、visual（定点スクショ+輝度サニティ）、
mobile（タッチUI）。swiftshaderはfps絶対値が当てにならないため
**例外ゼロ・状態アサート・スクショ**で判定する。
