# petit-hermes

広島県北広島町・旧南方小学校のパン屋「プチヘルメース」をモチーフにした
**ファンメイドの架空デモ**プロジェクト。

- `index.html` — ブランドデモサイト（React／単一ファイル）
- `game.html` + `src/game/` — オープンワールド擬似体験ゲーム
  **『みなみがたの朝 〜廃校のパン屋へ〜』**（three.js／ビルドレスESM）
- `assets/` — 無料アセット（MIT/CC0、出典は `assets/LICENSES.md`）

> ※実際の店舗情報・価格・メニューとは異なります。本物の情報は
> 公式Instagram（@petit_hermes）をご確認ください。

## 遊ぶ

公開版: GitHub Pages の `…/game.html`

ローカル実行は **httpサーバ必須**（ESM＋アセット読込のため `file://` 不可）:

```bash
npm install        # 開発用（three / puppeteer / eslint）
npm run serve      # http://localhost:8910/game.html
```

### 操作
WASD 移動 / Shift 走る / マウス カメラ / F・E しらべる /
V 一人称⇔三人称 / P フォトモード / M 目標 / 3〜6 パンをたべる。
スマホは左スティック＋画面ドラッグ＋ボタン。

## 開発

```bash
npm run check      # 全JSの構文チェック
npm run lint       # ESLint
npm run test:e2e   # puppeteer E2E（全行程・ビジュアル・モバイル）
npm run fetch-assets  # アセット再取得（再現可能）
```

- 構成・設計は `ARCHITECTURE.md` を参照
- CIはPRごとに check / lint / E2E を実行（`.github/workflows/ci.yml`）
- mainへのpushで GitHub Pages に自動デプロイ（`.github/workflows/pages.yml`）

### デバッグ
`game.html?debug` でFPS表示、`?q=min|low|mid|high` で画質ティア固定。
`window.__game` にテスト用フック（teleport / setTimeOfDay / openShop 等）。
