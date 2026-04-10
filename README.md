# FFXIV Skill Rotation Diff (MVP)

ブラウザのみで動くMVPです。

## 現在の実装
- FFLogs URL 2件入力 + reportId/fightId抽出
- プレイヤー選択UI
- 横スクロールTL比較（全体/奇数分/偶数分）
- DPS推移（Canvas）
- `public/job-icons/job_icon.json` からアイコン引き当て

> 注: FFLogsの本番データ取得は次フェーズ（サーバー経由API連携）で実装。

## ローカル起動
```bash
python3 -m http.server 8080
```

ブラウザで `http://localhost:8080` を開く。

## 必要ファイル
- `public/job-icons/job_icon.json`
- `public/job-icons/...` 画像アセット
