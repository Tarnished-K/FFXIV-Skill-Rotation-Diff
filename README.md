# FFXIV Skill Rotation Diff (MVP)

ブラウザのみで動くMVPです。

## 現在の実装
- FFLogs URL 2件入力（report単位）
- FFLogs API（V1）でKill戦闘一覧（ボス名/討伐時間）を取得
- 戦闘を各ログ1件ずつ選択後、その戦闘に参加したプレイヤー一覧を取得
- プレイヤー選択UI
- 横スクロールTL比較（全体/奇数分/偶数分）
- DPS推移（Canvas）
- `public/job-icons/job_icon.json` からアイコン引き当て

> 注: TLイベントとDPSは次フェーズでFFLogs実データ連携予定。現状は選択プレイヤー名でサンプル描画。

## ローカル起動
```bash
python -m http.server 8080
```

ブラウザで `http://localhost:8080` を開く。

## 必要ファイル
- `public/job-icons/job_icon.json`
- `public/job-icons/...` 画像アセット
