# HANDOFF V6

## Current State

- Branch: `feature/supporter-bookmarks-synergy-tl`
- Remote: `origin/feature/supporter-bookmarks-synergy-tl`
- Current HEAD: `eb669a3 fix: TH/DPS filter (add Japanese job names to JOB_ROLE), enlarge pt-row-label font`
- Working tree at handoff creation: clean
- Netlify preview alias: `https://supporter-preview--vermillion-crumble-a1f1aa.netlify.app`

## Completed In This Session

サポーター機能プレビューUI（`premium.html` + `scripts/premium-preview.js`）を完成させた。

- HTML スナップショット注入方式で実際のタイムラインUIをデモ表示
- 個人比較 / PT比較 切り替え
- 全体 / 奇数分 / 偶数分 TL タブ（同一スナップショットをスクロールで対応）
- 横軸のみズーム（JS による inline left/width 再計算）
- ドラッグスクロール・ホイールスクロール
- シナジー / デバフ / ボスキャスト レイヤートグル
- フェーズボタン自動生成（`.phase-divider.a` から検出）
- 名前匿名化（SVGテキスト非表示・pt-row-label をジョブ名のみに）
- PT絞り込み：全員 / TH / DPS / カスタム（本家と同仕様。日英両言語のジョブ名対応）
- カスタムモーダル（ジョブ名 + A1/B1 等で匿名表示）

**既知の制限（意図的に未対応）：**
- PT DPS グラフはキャプチャ時の全員集計 SVG のみ。フィルター連動不可（元ダメージデータなし）

---

## 次のセッションで取り組むべきこと（優先順）

### 🔴 Priority 1 — 奇数分 / 偶数分 TL の絞り込み表示範囲バグ修正（最優先）

**対象：本番アプリのメインUI（比較結果画面）とプレミアムプレビューの両方。**

現状の問題：奇数分 TL・偶数分 TL を選択した際にフォーカスされる時間帯がめちゃくちゃ。

**正しい仕様：**
- 奇数分（1:00, 3:00, 5:00 …）偶数分（2:00, 4:00, 6:00 …）の各ターゲット時刻に対して
- **ターゲット時刻の10秒前**を左端、**ターゲット時刻から20秒後**を右端に収まるように表示する
- すなわち 30 秒間のウィンドウ（例：奇数分 1:00 → 0:50〜1:20 を表示）

**実装上の注意：**
- スクロール位置はターゲット - 10s を左端に合わせる（`scrollToSec` で `-200px` オフセットなし、`TAB_SCROLL_SEC.odd = 50, even = 110` は既にプレビューに適用済み）
- プレビュー側は修正済み。本番の比較結果 UI 側（`scripts/ui/timeline.js` の `isInTimelineFocusWindow` 周辺）がまだ未修正
- TLに描画するイベントの絞り込み範囲と、スクロール位置の両方を統一すること

関連ファイル：
- `scripts/ui/timeline.js` — `isInTimelineFocusWindow`、`currentTab` 判定、タブ切り替えのスクロール処理
- `scripts/premium-preview.js` — `TAB_SCROLL_SEC`、`scrollToSec`（プレビュー側は対応済み）

---

### 🟡 Priority 2 — サポーター登録画面（premium.html）の配置・構造修正

現状の問題：他のページのUIと比べて、サポーター登録画面のレイアウト・配置が構造的に崩れている。

**作業内容：**
- `premium.html` のセクション構造を見直す
- 他ページ（`index.html` 等）のUIスタイルと統一感を持たせる
- プレミアムプレビューUIとその周辺の表記・配置の整合性を確認
- モバイル対応も合わせて確認

---

### 🟢 Priority 3 — リポジトリ全体の最適化（セキュリティ・パフォーマンス）

全機能・UIのデザインが一通り完了した後にまとめて実施。

**作業内容：**
- セキュリティ脆弱性スキャン（XSS, CSP, 認証・認可の不備など）
- バンドルサイズ・依存関係の最適化
- 処理の重さチェック（特に大規模PT比較時の描画）
- 不要コード・デッドコードの除去
- `security-reviewer` エージェントおよび `refactor-cleaner` エージェントを活用

---

### ℹ️ 決済フロー — Codex で別途取り組む

Stripe 等の決済フロー実装は Codex と取り組む予定。このリポジトリでは対応しない。

---

## 補足

- スナップショットの再キャプチャが必要な場合はブラウザコンソールで `__captureTimelineHTML('personal')` / `__captureTimelineHTML('party')` を実行
- Netlify デプロイは `netlify deploy --build --alias supporter-preview` で随時可能
