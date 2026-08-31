<div align="center">
<div align="right">
  <a href="../README.md">English</a> | <a href="../README.fa.md">فارسی</a>
</div>

<img src="../assets/readme/hero.svg" width="100%" alt="NovaRoute">

**NovaRoute – 高度な AI プロバイダー＆チャットプラットフォーム**

AI プロバイダー（API、CLI、OAuth、Cookie）を管理し、モデルコンボを構築し、すべてのモデルを一か所でチャットできる強力なセルフホストプラットフォーム。

[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](../LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blueviolet?style=for-the-badge)](https://github.com/IRNova/NovaRoute)
</div>

---

## 🚀 ワンクリックインストール

新しい Linux サーバーで実行します（Ubuntu/Debian、RHEL/CentOS/Fedora または互換性のあるもの）：

```bash
curl -fsSL https://raw.githubusercontent.com/IRNova/NovaRoute/main/install.sh | sudo bash
```

インストーラーは以下を行います：

1. Node.js が不足している場合はインストールします。
2. このリポジトリを `/opt/novaroute` にクローンします。
3. 依存関係をインストールし、本番バンドルをビルドします。
4. 隔離された Linux ユーザー `novaroute` とデータディレクトリ `/var/lib/novaroute` を作成します。
5. ランダムな秘密鍵で安全な `.env` ファイルを生成します。
6. `novaroute` という名前の systemd サービスをインストールして開始します。
7. ダッシュボード上のすべての無料認証不要プロバイダーを自動設定し、すぐに使用を開始できます。

デフォルトポートは **20126** です（OmniRoute との競合を回避するために選択）。インストーラーは確認または変更を求めてきます。

インストール後、ダッシュボードを開きます：

```text
http://<server-ip>:20126/dashboard
```

インストールログの最後に印刷された初期パスワードを使用してください。

---

## 📋 要件

- `systemd` 付きの Linux サーバー
- `curl`、`git`、`openssl`
- Node.js **20+**（不足している場合は自動インストール）
- 最低 1 GB RAM（推奨 2 GB）
- 2 GB の空きディスク容量
- systemd と `/opt` インストール用の root/sudo アクセス

---

## 🌐 API

NovaRoute は以下の場所で OpenAI 互換エンドポイントを公開します：

```text
http://<server-ip>:20126/v1
```

AI クライアント（Claude Code、Cursor、Cline、Codex など）を設定します：

- **ベース URL：** `http://<server-ip>:20126/v1`
- **API キー：** ダッシュボードの **設定 → API キー** で作成
- **モデル：** ダッシュボードに表示されるプロバイダー/モデルエイリアスを使用

---

## 📄 ライセンス

NovaRoute は [MIT ライセンス](../LICENSE) の下でリリースされています。
