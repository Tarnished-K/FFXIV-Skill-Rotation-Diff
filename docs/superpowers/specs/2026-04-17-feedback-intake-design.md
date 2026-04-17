# Feedback Intake Design

## Goal

FFXIV Skill Rotation Diff に `ご要望フォーム` と `管理画面` を追加する。送信された内容は保存時に AI で `一般` と `ゴミ箱` に自動仕分けし、`一般` のものだけを送信時カテゴリごとに管理できるようにする。管理画面では `未読 / 既読` を扱え、`既読後 7 日` で削除対象になる運用を前提とする。

## Scope

- トップ画面に `ご要望フォーム` 導線を追加する
- 既存の `Log` / `Error Log` の表示を消す
- `ご要望フォーム` 用の別画面を追加する
- ご要望フォーム送信用の保存 API を追加する
- ご要望フォーム管理用の別画面を追加する
- `一般 / ゴミ箱`、`未読 / 既読`、`復元`、`期限切れ削除` を扱う管理 API を追加する
- ご要望フォーム専用テーブルを追加する
- 将来の Claude / Codex 自動運用を見据えて、一覧取得・既読化・復元・削除を API 経由で実行できる構造にする
- テスト版であってもバージョン番号を更新する

## Non-goals

- 管理画面の認証実装
- 送信時カテゴリの AI 再分類
- メールアドレスや名前などの連絡先入力
- AI による返信文生成や自動応答
- 既読前データの自動削除

## User-facing UX

### Top page

- 既存の `初めての方はこちら` と同じ導線グループに `ご要望フォーム` リンクを追加する
- `Log` / `Error Log` のカードは画面から非表示にする
- 内部ログ処理は残し、画面上に出さないだけにする

### Feedback form page

- 新規ページ `contact.html` を追加する
- 入力項目は以下の 3 つだけにする
  - `カテゴリ`
  - `件名`
  - `本文`
- カテゴリ選択肢は固定値とする
  - `不具合報告`
  - `改善要望`
  - `質問`
  - `その他`
- 送信成功後は簡潔な完了メッセージを表示する
- このページは「折り返し連絡」の意味合いを避けるため、表記は `ご要望フォーム` で統一する

### Feedback admin page

- 新規ページ `feedback-admin.html` を追加する
- トップ画面や `analytics.html` からはリンクしない
- URL を知っている人だけが直接開くテスト版運用とする
- 画面上部に集計サマリーを表示する
  - `未読件数`
  - `一般件数`
  - `ゴミ箱件数`
  - `削除待ち件数`
- 一次分類の表示は `一般 / ゴミ箱` の 2 タブにする
- `一般` タブでは以下のカテゴリごとに一覧を分ける
  - `不具合報告`
  - `改善要望`
  - `質問`
  - `その他`
- `ゴミ箱` タブでは以下を優先して見せる
  - 元カテゴリ
  - AI 判定理由
  - 未読 / 既読
- 各カードには以下を表示する
  - 未読 / 既読
  - カテゴリ
  - 件名
  - 本文
  - 送信日時
- `ゴミ箱` では追加で `AI 判定理由` を表示する
- `既読` にしたものは `7 日後に削除予定` の日時を表示する
- 一覧は `未読優先` で見せ、必要なら既読も見られる切り替えを用意する
- 管理操作として以下を持つ
  - `既読にする`
  - `未読に戻す`
  - `ゴミ箱へ移す`
  - `ゴミ箱から復元する`
  - `期限切れ削除を実行する`

## Classification rules

### Bucket selection

- AI は送信時に本文を読み、`general` または `trash` の 2 値だけを決める
- AI はカテゴリの再分類をしない
- 以下に該当するものは送信時カテゴリに関係なく `trash` を優先する
  - 攻撃的な内容
  - 誹謗中傷
  - 意味不明で処理対象にできない内容
- AI 判定が微妙なケースは、誤って捨てないことを優先して `general` 側へ残す

### Category handling

- 送信時カテゴリは常に保存する
- `general` の場合だけ、一覧表示の二次分類としてカテゴリを使う
- `trash` でも元カテゴリ情報は保持し、管理画面では `元カテゴリ` として表示できるようにする

### Restore behavior

- `trash` に入ったものは管理画面から `general` に復元できる
- 復元時は保存されている元カテゴリに戻す
- 復元時は再確認が必要な実データとして扱うため、`is_read = false` に戻す
- 復元時は `read_at = null`、`delete_after_at = null` に戻す

## Data model

ご要望フォームは既存の `app_events` と用途が異なるため、専用テーブル `feedback_entries` を新設する。

### feedback_entries

- `id`
  - 主キー
- `category`
  - 送信時カテゴリ
  - 値は `bug_report / feature_request / question / other`
- `subject`
  - 件名
- `body`
  - 本文
- `bucket`
  - `general / trash`
- `ai_reason`
  - AI が `trash` または `general` と判断した短い理由
- `is_read`
  - 既読かどうか
- `read_at`
  - 既読にした日時
- `delete_after_at`
  - 既読後 7 日の削除基準日時
- `created_at`
  - 送信日時
- `updated_at`
  - 更新日時
- `ip_hash`
  - 生の IP は保持せず、レート制限用にハッシュ化した値だけを内部保存する
- `moderation_provider`
  - どの AI サービスで判定したかを保存する
- `moderation_model`
  - どのモデルで判定したかを保存する

### feedback_rate_limits

- `ip_hash`
  - レート制限対象のハッシュ化済み識別子
- `window_started_at`
  - 10 分ウィンドウの開始時刻
- `request_count`
  - そのウィンドウでの送信回数
- `created_at`
  - 作成日時
- `updated_at`
  - 更新日時

### Retention

- 未読データは自動削除しない
- 既読化した時点で `delete_after_at = read_at + 7日` を設定する
- 削除対象は `is_read = true` かつ `delete_after_at <= now()` のものだけにする
- `feedback_rate_limits` は `feedback-submit` 実行時に古い行をサイレント削除する
- 削除条件は `window_started_at < now() - interval '10 minutes'`
- 初期スコープでは `pg_cron` は使わず、送信時クリーンアップだけで運用する

## API design

### `POST /api/feedback-submit`

役割:

- ご要望フォームの送信受付
- 入力バリデーション
- AI による `general / trash` 判定
- `feedback_entries` への保存

入力:

- `category`
- `subject`
- `body`

入力制約:

- `category` は `bug_report / feature_request / question / other` のいずれか
- `subject` は 1 文字以上 200 文字以下
- `body` は 1 文字以上 2000 文字以下
- 空白のみは不可
- hidden honeypot フィールドが埋まっている場合はスパムとして拒否する

出力:

- `ok`
- 保存成功時の最小限の結果
- AI 判定失敗時はエラーを返すのではなく、実装では `general` 側へフォールバックして保存する

レート制限:

- サーバー側で `ip_hash` を計算し、生 IP は保存しない
- Netlify Functions はステートレスなので、Supabase の `feedback_rate_limits` テーブルでカウントを保持する
- 同一 `ip_hash` からの送信は `10 分で 5 件まで` に制限する
- `feedback-submit` 実行時に、まず `feedback_rate_limits` の古い行を削除してから現在ウィンドウの回数を確認する
- 制限超過時は `429` を返し、AI 判定は実行しない

### `GET /api/feedback-admin-list`

役割:

- 管理画面の一覧取得
- 将来の Claude / Codex による読取用窓口

想定フィルタ:

- `bucket`
- `category`
- `is_read`
- `limit`
- `offset`

出力:

- `summary`
  - `unread_count`
  - `general_count`
  - `trash_count`
  - `pending_purge_count`
- `items`
  - `id`
  - `category`
  - `subject`
  - `body`
  - `bucket`
  - `is_read`
  - `created_at`
  - `delete_after_at`
  - `ai_reason`
  - `admin_note`
  - `moderation_provider`
  - `moderation_model`
- `pagination`
  - `limit`
  - `offset`
  - `returned_count`

### `POST /api/feedback-admin-mark-read`

役割:

- 既読化または未読化

入力:

- `id`
- `isRead`

出力:

- `ok`
- 更新後の `is_read`
- 更新後の `delete_after_at`

挙動:

- 既読にする時
  - `is_read = true`
  - `read_at = now()`
  - `delete_after_at = now() + 7日`
- 未読に戻す時
  - `is_read = false`
  - `read_at = null`
  - `delete_after_at = null`

### `POST /api/feedback-admin-restore`

役割:

- `trash` から `general` に復元する

入力:

- `id`

出力:

- `ok`
- 更新後の `bucket`
- 更新後の `category`
- 更新後の `is_read`

挙動:

- `bucket = general`
- `category` は保存済みの元カテゴリをそのまま使う
- `is_read = false`
- `read_at = null`
- `delete_after_at = null`

### `POST /api/feedback-admin-move-to-trash`

役割:

- 管理者が `general` のデータを手動で `trash` に移す

入力:

- `id`
- `reason`

出力:

- `ok`
- 更新後の `bucket`

挙動:

- `bucket = trash`
- `reason` は `ai_reason` を上書きせず、`admin_note` に保存する
- 誤って purge 対象になるのを防ぐため、`is_read = false` に戻す
- `read_at = null`
- `delete_after_at = null`

### `POST /api/feedback-admin-purge`

役割:

- 期限切れの既読データを削除する

入力:

- なし

出力:

- `ok`
- `deletedCount`

挙動:

- `is_read = true`
- `delete_after_at <= now()`
- 条件に一致するデータだけを削除する

実行トリガー:

- 初期スコープでは管理画面に `今すぐ削除` ボタンを置き、人が手動実行できるようにする
- 同じ API を将来の Claude / Codex の定期タスクや curl からも呼べるようにする
- Netlify Scheduled Functions での自動実行は今回のスコープ外とする

## AI moderation design

- AI は送信時にのみ実行する
- 役割は `bucket` 判定のみ
- 判定結果は `ai_reason` とあわせて保存する
- 送信時カテゴリは AI が書き換えない
- 将来の Claude / Codex の要約運用では、保存済みデータを読むだけでよい構造にする
- 初期実装の AI サービスは `OpenAI Responses API` を使う
- 初期実装の AI サービスは `OpenAI API` を使う
- 正確なモデル名はデプロイ時に環境変数で指定できるようにし、コードに固定しない
- 初期値は `低コストの小型テキストモデル` を前提とし、将来のモデル差し替えを容易にする

## Claude / Codex automation readiness

将来の予約タスクで以下を API だけで実行できる状態にする。

- 一覧取得
- 未読だけ取得
- 要約対象の本文抽出
- 既読化
- ゴミ箱からの復元
- 期限切れ削除

このため、管理画面で行う操作は人間向け UI 専用ロジックに閉じず、必ず API を通じて更新する。

## Versioning

- テスト版の変更でも `package.json` のバージョンを更新する
- 画面下部の build info 表示は既存の仕組みをそのまま使い、更新後のバージョンが反映される状態にする

## Testing strategy

### UI

- トップ画面で `Log` / `Error Log` が非表示になっていること
- トップ画面から `ご要望フォーム` へ遷移できること
- フォーム画面から送信できること
- 管理画面で `一般 / ゴミ箱` の切り替えができること
- `一般` でカテゴリ別表示ができること
- `ゴミ箱` で AI 判定理由と元カテゴリが見えること

### API

- 正常なフォーム送信で `general` 保存されること
- 攻撃的な入力で `trash` 保存されること
- 既読化で `delete_after_at` が 7 日後になること
- 未読に戻した時に `delete_after_at` が消えること
- 復元で `general` に戻ること
- 手動で `trash` に移せること
- purge で期限切れだけ削除されること
- レート制限超過時は `429` が返ること
- honeypot フィールドが埋まっている場合は拒否されること

### Data

- 送信時カテゴリが常に保持されること
- `trash` に入っても元カテゴリが保持されること
- `general` 表示は送信時カテゴリで分かれること

### AI-specific test policy

- AI 呼び出しに依存する自動テストは、実 API を直接叩かずモックまたはスタブで差し替える
- `攻撃的な入力で trash 保存されること` は automated test では判定ラッパーをモックする
- 実際の AI サービスとの接続確認は手動確認として分離する

## Risks and mitigations

- AI 誤判定で通常のフォームが `trash` に入る
  - `復元` 操作を入れる
  - 微妙なケースは `general` に寄せる
- 管理画面が未認証のまま公開される
  - 今回はテスト版前提で認証を後回しにする
  - 将来は API 保護と画面認証を追加する前提を明記する
- Supabase 容量が増える
  - `既読後 7 日` の削除運用を入れる
  - purge API で定期清掃できるようにする
- AI API コストがスパムで増える
  - `ip_hash` ベースの rate limit を入れる
  - honeypot と文字数制限で無駄な AI 呼び出しを減らす
