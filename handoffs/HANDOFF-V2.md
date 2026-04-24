# Handoff V2

## 前提

リポジトリ:
`C:\Users\ishih\Documents\GitHub\FFXIV-Skill-Rotation-Diff`

現在の作業保存ブランチ:
`feature/supporter-bookmarks-synergy-tl`

保存済みコミット:
`ba4b63b feat: add supporter bookmarks and synergy lane`

リモート保存済み:
`origin/feature/supporter-bookmarks-synergy-tl`

最新プレビューURL:
`https://69eae7a4865fce47e44fadc1--vermillion-crumble-a1f1aa.netlify.app`

重要:
- `main` には push していない。
- `main` への push は必ずユーザー確認が必要。
- 次作業は `feature/supporter-bookmarks-synergy-tl` から継続する。
- 作業ツリーはコミット時点でクリーン。
- ユーザーは技術初心者なので、説明は専門用語をかみ砕いて行う。

## HANDOFF.md基準の進捗

### フェーズ1: DB基盤

状態: 完了済み / main反映済み

内容:
- Supabase側の会員・課金・利用回数・ブックマーク用テーブル作成済み。
- RLS設定済み。
- 主なテーブル:
  - `billing_customers`
  - `billing_subscriptions`
  - `comparison_daily_usage`
  - `comparison_bookmarks`
  - `stripe_webhook_events`

### フェーズ2: サーバーサイドAPI

状態: 完了済み / main反映済み

内容:
- 課金、利用回数、Stripe Webhook、Supabase設定取得系のNetlify Functionsを実装済み。
- 主なファイル:
  - `lib/billing.js`
  - `netlify/functions/stripe-webhook.js`
  - `netlify/functions/check-usage.js`
  - `netlify/functions/supabase-config.js`

### フェーズ3: 認証UI

状態: 完了済み / main反映済み

内容:
- Supabase Authのログイン/ログアウトUIを追加済み。
- Googleログイン対応済み。
- ヘッダーに認証状態を表示。
- 主なファイル:
  - `scripts/auth/auth.js`
  - `scripts/auth/auth-ui.js`
  - `index.html`
  - `styles.css`

## HANDOFF.mdのフェーズ4

### フェーズ4: 会員基盤・サポーター導線・利用回数制御

状態: Step 1〜7完了 / 専用ブランチに保存済み

### Step 1: Stripeで価格を作成

状態: 完了

内容:
- ユーザー側でStripeの商品・価格ID作成済み。
- Netlify環境変数 `STRIPE_PRICE_ID` 登録済み。

### Step 2: `netlify/functions/create-checkout.js`

状態: 完了

内容:
- `/api/create-checkout` を追加。
- ログイン済みユーザーをStripe Checkoutへ送る処理を実装。
- 主なファイル:
  - `netlify/functions/create-checkout.js`
  - `netlify.toml`

### Step 3: `netlify/functions/auth-status.js`

状態: 完了

内容:
- `/api/auth-status` を追加。
- ログイン状態、サポーター状態、残り利用回数を取得。
- 主なファイル:
  - `netlify/functions/auth-status.js`
  - `lib/billing.js`

### Step 4: `premium.html`

状態: 完了

内容:
- サポーター案内ページを追加。
- Stripe Checkoutへ進むボタンを追加。
- 主なファイル:
  - `premium.html`

### Step 5: シナジーTLの有料判定

状態: 仕様変更のうえ実装中

HANDOFF.md上の元仕様:
- 「シナジーTL」を有料会員のみ表示する想定。

現在の正しい仕様:
- 別タブや別画面の「シナジーTL」ではない。
- 通常タイムライン内に「シナジーレーン」を追加する。
- 表示位置は `WS/魔法` レーンの下。
- サポーターのみ表示。
- 無料版では表示しない。

実装済み:
- サポーター限定のシナジーレーン表示。
- 通常TL内へのシナジーレーン追加。
- 不要な点線の削除。
- シナジーレーン用の横線追加。

残作業:
- 細かい表示調整。
- 実ログでの精度確認。
- ピクトマンサーの対象シナジー修正。

### Step 6: 比較回数チェックの組み込み

状態: 完了

内容:
- 比較開始時に `/api/check-usage` を呼ぶ。
- 無料版は利用回数制限あり。
- サポーターは実質無制限。
- リロードやURL復元では回数消費しないよう整理済み。
- 主なファイル:
  - `scripts/app/bootstrap.js`
  - `lib/billing.js`

### Step 7: `netlify.toml` に新規エンドポイント追記

状態: 完了

内容:
- `/api/create-checkout`
- `/api/auth-status`
- `/api/bookmarks`
- などをNetlify Functionへルーティング済み。

## HANDOFF.mdのフェーズ5

### フェーズ5: サポーター特典・ブックマーク・広告非表示

状態: Step 8はほぼ完了 / Step 9は一部完了・一部保留

### Step 8: ブックマーク機能

状態: ほぼ完了

実装済み:
- サポーター専用のブックマーク保存・一覧・削除。
- API: `/api/bookmarks`
- Function: `netlify/functions/bookmarks.js`
- 無料会員が保存しようとすると、サポーター専用機能である旨を表示。
- 保存/削除時に完了ポップアップ表示。
- ブックマーク一覧の表示名を改善。
- コンテンツ名、プレイヤー情報、保存日時を分けて表示。
- サポーターは比較前でもブックマーク保存/一覧ボタンが表示される。
- ブックマーク関連文言の多言語対応を追加。

主なファイル:
- `netlify/functions/bookmarks.js`
- `scripts/app/bootstrap.js`
- `scripts/app/runtime.js`
- `index.html`
- `styles.css`

残確認:
- 長期利用時のブックマーク上限100件まわりのUI。
- スマホ表示は終盤対応でよい。

### Step 9: 広告非表示制御

状態: サポーター側は完了 / 無料版広告配置は未完了・保留

完了:
- サポーターでログイン時、広告は非表示になる。
- ユーザー確認でも、サポーターでは広告が消えている。

未完了/保留:
- 無料版で広告がヘッダー付近に変な位置で表示される問題が残っている。
- 何度かCSS調整したが完全解決せず、ユーザー判断でいったん保留。
- ユーザーはこの広告崩れをClaude側に任せる予定と言っていた。
- 現在のブランチには広告配置調整途中のCSS変更が入っているため、次に触る場合は慎重に確認すること。

## HANDOFF.md外で進んだ作業

### フェーズ6相当: シナジーレーン機能

状態: 開発中

重要な仕様:
- 「シナジーTL」は別タブではない。
- 通常TL内に「シナジーレーン」を追加する機能。
- 表示位置は `WS/魔法` レーンの下。
- GCD軸、アビリティ軸に加えて、PTメンバーのシナジー軸を横方向TL上に表示する。
- サポーター専用機能。
- 自己バフは含めない。
- 選択プレイヤー本人のシナジーも表示対象から除外する。
- 同PT内の他プレイヤーが使ったPT火力バフ/敵デバフだけを表示する。

実装済み:
- 通常TL内にシナジーレーンを追加。
- サポーター限定表示。
- 無料版では非表示。
- 不要な点線を削除。
- シナジーレーン用の横線を追加。
- 当初は選択プレイヤー本人のバフが表示されていたが、他PTメンバーのシナジーキャストを取得する方式へ修正。
- `Casts` イベントベースで取得。
- 短時間の重複表示を抑える処理を追加。
- ユーザー確認では「大体あっている」とのこと。

対象シナジー一覧:
- モンク: 桃園結義
- 竜騎士: バトルリタニー
- リーパー: アルケインサークル
- 吟遊詩人: バトルボイス
- 吟遊詩人: 光神のフィナーレ
- 踊り子: テクニカルステップ / テクニカルフィニッシュ
- 召喚士: シアリングライト
- 赤魔道士: エンボルデン
- ピクトマンサー: スターリーミューズ
- ピクトマンサー: イマジンスカイ
- 占星術師: ディヴィネーション
- 忍者: 毒盛の術
- 学者: 連環計

重要修正:
- ピクトマンサーのシナジーは「ハルシネーション」ではない。
- 正しくは **イマジンスカイ**。
- 次作業で `scripts/data/fflogs.js` の `PARTY_SYNERGY_ACTIONS` からハルシネーションを外し、イマジンスカイへ修正すること。

主なファイル:
- `scripts/data/fflogs.js`
- `scripts/app/bootstrap.js`
- `scripts/ui/timeline.js`
- `styles-timeline.css`
- `scripts/app/runtime.js`
- `scripts/auth/auth-ui.js`

残作業:
- イマジンスカイのFFLogs上の正式名称・ability IDを確認して実装。
- シナジーレーンの細かい表示修正。
- 他PTメンバーのシナジーだけが正しい時刻に出るか実ログで確認。
- 選択プレイヤー本人のシナジーが混ざっていないか確認。
- 同じシナジーが短時間に重複表示されないか確認。
- シナジー名、色、ラベル位置、表示幅を調整。
- サポーター/無料版の表示制御を再確認。
- 長時間ログでFFLogs APIのページングが必要か確認。

## 今後の残作業まとめ

### 未完了1: フェーズ4 Step 5 / フェーズ6相当のシナジーレーン

優先度: 高

次にやること:
1. `feature/supporter-bookmarks-synergy-tl` をチェックアウトする。
2. `scripts/data/fflogs.js` の `PARTY_SYNERGY_ACTIONS` を確認。
3. ピクトマンサーの「ハルシネーション」を削除。
4. ピクトマンサーの「イマジンスカイ」を追加。
5. FFLogs上の正式名称/ability IDが分からない場合は、まず名前マッチングで実装。
6. 実ログでイマジンスカイが表示されるか確認。
7. シナジーレーンの見た目をユーザーFBに合わせて調整。
8. `npm test` 実行。
9. Netlifyプレビュー作成。

### 未完了2: フェーズ5 Step 9 無料版広告配置

優先度: 中 / 現在は保留

内容:
- サポーター広告非表示は完了。
- 無料版広告の表示位置だけ問題が残っている。
- ユーザーはClaudeに任せる予定。
- もしこちらで触る場合は、ヘッダーUIと広告CSSの相互影響を確認する。

### 未完了3: ブックマークの細部確認

優先度: 低

内容:
- ブックマーク上限100件時のUI確認。
- 長期利用時の一覧整理。
- スマホ表示は終盤対応。

### 未完了4: スマホ対応

優先度: 低 / 終盤対応

内容:
- 現時点ではPC優先。
- スマホ幅のUI崩れは開発終盤でまとめて対応する方針。

### 未完了5: フェーズ7以降

状態: 未着手

内容:
- HANDOFF.mdにはフェーズ5までしか明確な作業仕様はない。
- フェーズ6シナジーレーンが実用レベルになってから次を決める。
- `ROADMAP.md` には今後候補として以下がある:
  - コアUX改善
  - analytics v2
  - 保守性改善
  - 比較機能の拡張

## 検証状況

最後に確認済み:
- `npm test` 通過。
- 48 test files / 192 tests passed。
- Netlifyプレビュー作成済み。
- 専用ブランチへコミット・push済み。

## 次セッションで最初に実行する確認コマンド

```powershell
git status --short --branch
git branch --show-current
npm test
```

期待:
- ブランチは `feature/supporter-bookmarks-synergy-tl`
- 作業ツリーはクリーン
- テストは全件通過

## 注意事項

- `main` に勝手に push しない。
- `main` 反映はユーザー確認後のみ。
- ユーザーは技術初心者なので、専門用語は説明しながら進める。
- 広告配置問題は保留扱い。触るなら事前に確認した方がよい。
- シナジー機能では「自己バフ」と「選択プレイヤー本人のシナジー」を混ぜないこと。
- ピクトマンサーの対象シナジーは「イマジンスカイ」。ハルシネーションではない。
