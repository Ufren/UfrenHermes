# Ufren Hermes Desktop

[中文](./README.md) | [English](./README.en.md) | [日本語](./README.ja.md)

WSL2 上で動作する Hermes Agent を、Electron UI からインストール、起動、管理、利用するための Windows デスクトップクライアントです。

## 現在の対応範囲

`ufren-hermes-desktop` は現在、以下のフローをカバーしています。

- Installer、Runtime、Dashboard、Chat を 1 つのデスクトップクライアントに統合
- 実行環境を WSL2 側に配置し、ホスト差異を低減
- WSL 確認、ディストリビューション準備、runtime bootstrap、リソース同期を含むワンクリック導入
- 状態更新、エラー分類、実行トレース、リトライを備えた可観測なインストールフロー
- 実行に必要なリソースを同梱した Windows パッケージング

## パッケージング保証

この README は最新のパッケージング動作に合わせて更新されています。

- `hermes-agent` の Dashboard フロントエンドは毎回パッケージ前に強制再ビルドされ、古い `web_dist` が新しいインストーラーに混入しません
- Electron メインプロセスが必要とする `@ufren/shared`、`@ufren/runtime-sdk`、`@ufren/installer-sdk` はアプリに同梱され、インストール後の `ERR_MODULE_NOT_FOUND` を防ぎます
- Renderer の本番ビルドは相対アセットパスを使用し、`file://` で開くパッケージ版 Electron でも正しく動作します
- `bootstrap-runtime.ps1` は Bash スクリプトをそのまま WSL に渡すため、PowerShell が `$(mktemp -d)` のような Bash 構文を先に評価しません
- パッケージには `hermes_cli/web_dist` を含めつつ、`../hermes-agent/web`、`package-lock.json`、その他の開発用ファイルは除外されます

> 設計方針: `../hermes-agent` は上流依存のまま維持し、このリポジトリがその開発本体にはなりません。

## リポジトリ構成

```text
ufren-hermes-desktop/
  apps/
    electron-main/   # Electron メインプロセス、preload、IPC handlers
    renderer/        # React フロントエンド
  packages/
    shared/          # IPC チャネル、DTO、Zod schema、共有型
    runtime-sdk/     # プロセス実行、WSL/runtime ヘルパー
    installer-sdk/   # Installer 状態機械とオーケストレーション
  resources/
    powershell/      # Windows 側 bootstrap/sync スクリプト
    wsl/             # WSL 内で実行する runtime スクリプト
```

## 必要環境

- Windows 10/11、推奨は Windows 11
- Node.js `>= 20.11.0`
- `pnpm`
- `npm`、`hermes-agent/web` の再ビルドに使用
- PowerShell 5 以上
- BIOS 仮想化の有効化を推奨

任意の環境変数:

- `UFREN_WSL_DISTRO`: 対象ディストリビューションを上書き、未指定時は自動判定、フォールバックは `Ubuntu`
- `UFREN_RUNTIME_ROOT`: WSL 内の runtime インストール先
- `UFREN_BOOTSTRAP_SCRIPT`: bootstrap スクリプトのパスを上書き
- `UFREN_HERMES_AGENT_PATH`: `hermes-agent` の Windows 側ソースパスを上書き

## 依存関係のインストール

```bash
pnpm install
```

## 開発モード

完全な開発チェーンを起動します。

```bash
pnpm run dev
```

起動されるもの:

- `pnpm run dev:renderer`
- `pnpm run dev:electron`

開発時は Vite dev server から Renderer を読み込み、本番パッケージではローカルのビルド成果物を読み込みます。

## ビルド

フルビルド:

```bash
pnpm run build
```

段階的ビルド:

```bash
pnpm run build:packages
pnpm run build:apps
```

品質チェック:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
```

補足:

- `test` は現在 `runtime-sdk`、`installer-sdk`、`electron-main` を対象にしています
- `electron-main` のテストは先にビルドし、その後 `node --test dist/**/*.test.js` を実行します

## リリースとパッケージング

リリース前準備:

```bash
pnpm run release:prepare
```

主なパッケージングコマンド:

```bash
pnpm run package:dir
pnpm run package:win
pnpm run package:win:x64
pnpm run package:win:portable
pnpm run package:win:ci
```

補足:

- `release:prepare` = `clean + assets:icons + release:verify + build + assets:hermes-dashboard`
- `assets:icons` はアプリアイコン、NSIS 用画像、`manifest.json` を生成します
- `assets:hermes-dashboard` は `../hermes-agent/web` を強制再ビルドし、`hermes_cli/web_dist` を更新します
- `package:dir` は未インストールの展開ディレクトリを生成し、内容確認に向いています
- `package:win` は `electron-builder.yml` に定義された Windows ターゲットを生成します
- `package:win:x64` は NSIS x64 インストーラーのみ生成します
- `package:win:portable` は x64 portable パッケージのみ生成します
- `package:win:ci` は publish を無効にした CI 向け経路です
- デフォルトの出力先は `release/` です

## パッケージ内容ポリシー

現在の `electron-builder.yml` は以下のように動作します。

- `apps/electron-main/dist`、`apps/renderer/dist`、`packages/*/dist` を含める
- 実行時 `node_modules` として `@ufren/*` と `zod` を明示的に含める
- `resources/powershell` と `resources/wsl` を `extraResources` として同梱する
- `../hermes-agent` を `extraResources/hermes-agent` として同梱する
- `../hermes-agent/web`、テストディレクトリ、キャッシュ、入れ子の `node_modules`、開発専用ファイルを除外する

## Installer フロー

メインフロー:

1. WSL の利用可否を確認
2. 対象ディストリビューションを決定
3. ディストリビューションを確認またはインストール
4. 必要に応じて WSL2 へ更新
5. WSL 内で runtime を bootstrap

主な特性:

- 同時実行防止: Installer は同時に 1 回のみ
- 構造化エラー: リトライ可否、管理者権限要否、再起動要否を返す
- `installer/context-changed` によるライブ状態更新
- コマンド、引数、終了コード、実行時間、出力要約を含む実行トレース
- `installer/retry` による再試行
- `$RUNTIME_DIR/.venv` による Python 分離

## Hermes Agent 同期モデル

- パッケージ段階: `../hermes-agent/web` を強制再ビルドしてから `../hermes-agent` を読み取り専用リソースとして同梱
- インストール段階: `bootstrap-runtime.ps1` が同梱済み `hermes-agent` を WSL 内の `$RUNTIME_DIR/hermes-agent` へ同期
- 依存解決段階: `$RUNTIME_DIR/.venv` を作成し、`pip install "$RUNTIME_DIR/hermes-agent[web]"` を実行
- 起動段階: `start-hermes.sh` は常に `$RUNTIME_DIR/.venv/bin/hermes` を使用

## アイコン資産

`pnpm run assets:icons` を実行すると以下が生成されます。

- `resources/icons/icon.ico`
- `resources/icons/icon.png`
- `resources/icons/source/icon-dark.svg`
- `resources/icons/source/icon-light.svg`
- `resources/icons/variants/icon-<theme>-<size>.png`
- `resources/icons/installer/installer-header.bmp`
- `resources/icons/installer/installer-sidebar.bmp`
- `resources/icons/installer/uninstaller-sidebar.bmp`
- `resources/icons/manifest.json`

## FAQ

- 権限不足: 管理者権限でアプリを起動して再試行してください
- 再起動が必要: Windows を再起動してから再度実行してください
- bootstrap スクリプトが見つからない: `resources/powershell/bootstrap-runtime.ps1` が同梱されているか確認するか、`UFREN_BOOTSTRAP_SCRIPT` で上書きしてください
- インストール後に白画面または空画面になる: 古いビルドでは本番アセットパスに問題があったため、最新版インストーラーを使用してください
