# Handoff

更新日: 2026-04-15

## 現在地

- 現在ブランチは `main`
- `origin/main` とローカル `main` は同期済み
- 直近の反映済みコミットは `953751c Extract shared utilities and add Vitest coverage`
- `https://xiv-srd.com` にはこのコミット内容が反映済み
  - `script.js` が `scripts/shared/app-utils.js` と `scripts/shared/phase-utils.js` を読み込んでいることを確認
  - `https://xiv-srd.com/scripts/shared/app-utils.js` と `https://xiv-srd.com/scripts/shared/phase-utils.js` が `HTTP 200`

## このセッションで main に入ったもの

- `Vitest` を導入して `npm test` を有効化
- 共通ロジックを共有ファイルへ抽出
  - `scripts/shared/app-utils.js`
  - `scripts/shared/phase-utils.js`
  - `lib/analytics-utils.js`
  - `lib/fflogs-proxy-utils.js`
- テスト追加
  - `tests/app-utils.test.js`
  - `tests/analytics-utils.test.js`
  - `tests/fflogs-proxy-utils.test.js`
  - `tests/phase-utils.test.js`
- `scripts/data/fflogs.js` と `scripts/ui/timeline.js` を共有関数呼び出しに寄せた

確認済み:

- `npm test` -> `4 files / 19 tests passed`
- `node --check scripts/shared/phase-utils.js`
- `node --check scripts/ui/timeline.js`

## まだ main に入っていないローカル差分

未コミット変更:

- `analytics.html`
  - canonical URL 追加
- `index.html`
  - description / canonical 追加
  - `step4Message` 追加
- `scripts/app/bootstrap.js`
  - 比較失敗時のサンプルタイムライン表示を廃止
  - compare/render エラー時は明示的なメッセージ表示に変更
- `scripts/app/runtime.js`
  - `compareError` 状態追加
  - compare/render failure 文言追加
- `supabase/config.toml`
  - `site_url` を `https://xiv-srd.com` に変更
  - redirect URL を本番/ローカル向けに更新

未追跡:

- `ROADMAP.md`
- `.claude/`
- `.gitignore`
- `netlify-dev*.log`
- `node_modules/`

注意:

- `scripts/app/bootstrap.js` と `scripts/app/runtime.js` の差分は「比較失敗時にダミー結果を見せない」ための実装で、ローカルで動作確認済み
- ただしこの変更はまだ commit / push していない

## 次セッションの最初にやること

1. 未コミット差分をコミット単位で分ける
- 候補A: compare failure UI 修正
  - `index.html`
  - `scripts/app/bootstrap.js`
  - `scripts/app/runtime.js`
- 候補B: 本番 URL / canonical / Supabase 設定
  - `analytics.html`
  - `index.html`
  - `supabase/config.toml`
- `ROADMAP.md` は必要なら別コミット

2. `main` に新しい変更を入れる前にバージョン番号を上げる
- 以後の方針:
  - どんなに小さい更新でも、`main` に関わる新しい push / merge ごとにサイト下部の `Version vx.x.x` を更新する
- 現在の表示元:
  - `package.json` の `version`
  - `netlify/functions/build-info.js` と `scripts/shared/build-info.js` がそれを表示に使う

3. コード作業を続けるならロードマップ上の次候補へ進む
- `timeline.js` に残っている純ロジックの追加抽出
- もしくは compare failure UI 修正を先に main へ入れる

## 運用メモ

- 本番反映確認は `build-info` だけでは不十分
  - 現状 `https://xiv-srd.com/api/build-info` は `version` は返すが `commit` は空
  - 必要なら配信中の静的ファイルも見る
- `scripts/ui/timeline.js` は文字コードの都合で `apply_patch` が失敗することがある
  - `invalid utf-8 sequence` が出た場合は PowerShell 経由で慎重に編集する
- `netlify dev` のローカル確認では、FFLogs / Supabase の認証情報再現が安定しないことがある
  - UI 単体確認と API 疎通確認は切り分けて考える

## 参照用

- 反映済みコミット: `953751c`
- 直前の公開系コミット: `4e747ef`
- ロードマップ: `ROADMAP.md`
