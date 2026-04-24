# HANDOFF V4

## 現在の状態

- ブランチ: `feature/supporter-bookmarks-synergy-tl`
- 直近コミット: `be053e0 feat: add party timeline boss and debuff lanes`
- リモート: `origin/feature/supporter-bookmarks-synergy-tl`
- 直近プレビュー: `https://69eba82d8f1a2232a7877e15--vermillion-crumble-a1f1aa.netlify.app`

## 完了した作業

- PT比較をサポーター専用機能にした
- PT比較の絞り込みUIを追加し、専用カスタムモーダルへ移した
- 比較開始中は読み込み系と比較操作をブロックし、`null.name` 系の比較失敗を防いだ
- PTタイムラインにボス詠唱レーンとプレイヤーデバフレーンを追加した
- FFLogs取得を修正し、ボス詠唱は敵対対象から取得、デバフは失敗していた `targetID` 条件を外して取得するようにした
- 比較フローとタイムライン描画のテストを更新し、`npm test` を通した
- 専用リモートブランチへの push まで完了した

## 未完了の作業

- ボス詠唱レーンは、敵対対象の詠唱数が多い戦闘ではまだ密になりやすい
- この密度改善は別作業として切り出している

## 今後の作業予定

- ボス詠唱レーンの密度改善を別途入れる
- 今回の修正範囲からは広げず、次の差分で詰める
- 必要なら詠唱のまとめ方や表示圧縮を先に見直してから、タイムライン全体へ反映する

## 必須方針

- `main` への `git push` はしない
- `git commit` もしない。実装だけ行い、ユーザー確認後にコミット・プッシュする
- 変更済み・未追跡ファイルを勝手に `revert` / `cleanup` しない

## 補足

- `HANDOFF.md`, `HANDOFF-V2.md`, `HANDOFF-V3.md` は `handoffs/` 配下に集約済み
- ルートの `HANDOFF.md` は、このフォルダへの案内だけを置く
