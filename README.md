# Ufren Hermes Desktop

[中文](./README.md) | [English](./README.en.md) | [日本語](./README.ja.md)

Windows 桌面客户端，用于在 Electron UI 中安装、启动、管理并使用运行在 WSL2 中的 Hermes Agent。

## 当前状态

`ufren-hermes-desktop` 当前已经覆盖以下链路：

- 桌面端统一入口：Installer、Runtime、Dashboard、Chat 共用一个 Electron + React 客户端。
- WSL2 运行时承载：将 Hermes Agent 实际运行环境放到 WSL 中，降低宿主机差异。
- 一键安装流程：检查 WSL、检查或安装发行版、bootstrap runtime、同步脚本和 hermes-agent。
- 运行可观测性：提供安装状态、错误分类、执行 trace、失败后重试。
- 交付打包：生成 NSIS 安装包与 portable 包，并将运行所需资源打入安装产物。

## 最近同步的打包保证

当前文档已经与最新打包行为对齐，以下保证已生效：

- `hermes-agent` Dashboard 前端在每次重新打包前都会强制重建，避免旧 `web_dist` 混入新包。
- Electron 主进程需要的 `@ufren/shared`、`@ufren/runtime-sdk`、`@ufren/installer-sdk` 会作为运行时依赖一并入包，避免安装后出现 `ERR_MODULE_NOT_FOUND`。
- Renderer 生产构建使用相对资源路径，避免安装后因 `file://` 场景下 `/assets/...` 解析错误而出现深蓝白板。
- `bootstrap-runtime.ps1` 现在将 Bash 脚本以字面量模板传入 WSL，避免 PowerShell 预执行 `$(mktemp -d)` 这类 Bash 语法。
- 打包产物会保留 `hermes_cli/web_dist`，同时排除 `../hermes-agent/web` 源码、`package-lock.json` 等开发期文件。

> 设计原则：上游 `../hermes-agent` 目录保持为外部依赖源，本项目不直接承载其业务开发。

## 项目结构

```text
ufren-hermes-desktop/
  apps/
    electron-main/   # Electron 主进程、preload、IPC handlers
    renderer/        # React 前端
  packages/
    shared/          # IPC 通道、DTO、Zod schema、共享类型
    runtime-sdk/     # 进程调用、WSL/运行时封装
    installer-sdk/   # 安装状态机与编排器
  resources/
    powershell/      # Windows 侧 bootstrap/sync 脚本
    wsl/             # WSL 内部启停/状态脚本
```

## 环境要求

- Windows 10/11，推荐 Windows 11
- Node.js `>= 20.11.0`
- `pnpm`
- `npm`，用于 `hermes-agent/web` 前端重建
- PowerShell 5+
- 建议开启 BIOS 虚拟化能力

可选环境变量：

- `UFREN_WSL_DISTRO`：指定目标发行版，默认自动选择，兜底为 `Ubuntu`
- `UFREN_RUNTIME_ROOT`：指定 runtime 在 WSL 中的安装目录
- `UFREN_BOOTSTRAP_SCRIPT`：覆盖默认 bootstrap 脚本路径
- `UFREN_HERMES_AGENT_PATH`：覆盖 `hermes-agent` 的 Windows 源目录

## 安装依赖

在项目根目录执行：

```bash
pnpm install
```

## 开发模式

启动完整开发链路：

```bash
pnpm run dev
```

该命令会并行启动：

- `pnpm run dev:renderer`
- `pnpm run dev:electron`

开发态通过 Vite dev server 加载 Renderer；生产打包时则加载本地构建产物。

## 构建

全量构建：

```bash
pnpm run build
```

分步构建：

```bash
pnpm run build:packages
pnpm run build:apps
```

质量校验：

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
```

说明：

- `test` 当前覆盖 `runtime-sdk`、`installer-sdk`、`electron-main`
- `electron-main` 测试会先构建再运行 `node --test dist/**/*.test.js`

## 发布与打包

发布前准备：

```bash
pnpm run release:prepare
```

常用打包命令：

```bash
pnpm run package:dir
pnpm run package:win
pnpm run package:win:x64
pnpm run package:win:portable
pnpm run package:win:ci
```

说明：

- `release:prepare` = `clean + assets:icons + release:verify + build + assets:hermes-dashboard`
- `assets:icons`：生成品牌图标、NSIS 安装器图片和 `manifest.json`
- `assets:hermes-dashboard`：强制重建 `../hermes-agent/web` 并刷新 `hermes_cli/web_dist`
- `package:dir`：生成未安装目录，适合检查包内容
- `package:win`：按当前 `electron-builder.yml` 产出 Windows 目标
- `package:win:x64`：仅生成 NSIS x64 安装包
- `package:win:portable`：仅生成 portable x64 包
- `package:win:ci`：CI 场景打包，禁用发布
- 默认产物输出目录为 `release/`

## 打包内容策略

`electron-builder.yml` 当前策略如下：

- 主应用文件包含 `apps/electron-main/dist`、`apps/renderer/dist`、`packages/*/dist`
- 运行时 `node_modules` 中显式包含 `@ufren/*` 与 `zod`
- `resources/powershell` 与 `resources/wsl` 作为 `extraResources` 进入安装包
- `../hermes-agent` 作为 `extraResources/hermes-agent` 进入安装包
- 会排除 `../hermes-agent/web`、`node_modules`、测试目录、缓存目录和常见开发期文件

## 安装器行为

安装器主流程：

1. 检查 WSL 可用性
2. 确定目标发行版
3. 校验或安装发行版
4. 必要时将发行版升级到 WSL2
5. 在 WSL 中 bootstrap runtime

关键特性：

- 并发保护：同一时间只允许一个安装流程
- 错误分类：返回结构化 issue，包含是否可重试、是否需要管理员权限、是否需要重启
- 实时状态：主进程通过 IPC 推送 `installer/context-changed`
- 执行追踪：记录命令、参数、退出码、耗时与输出摘要
- 失败重试：支持 `installer/retry`
- Python 隔离：在 `$RUNTIME_DIR/.venv` 中安装 hermes-agent 与依赖

## Hermes Agent 同步机制

- 打包阶段：先强制重建 `../hermes-agent/web`，再把 `../hermes-agent` 作为只读资源打入安装包
- 安装阶段：`bootstrap-runtime.ps1` 将包内 `hermes-agent` 同步到 WSL 的 `$RUNTIME_DIR/hermes-agent`
- 依赖准备：在 WSL 中创建 `$RUNTIME_DIR/.venv`，并执行 `pip install "$RUNTIME_DIR/hermes-agent[web]"`
- 启动阶段：`start-hermes.sh` 强制使用 `$RUNTIME_DIR/.venv/bin/hermes`

## 图标资产

执行 `pnpm run assets:icons` 后会生成：

- `resources/icons/icon.ico`
- `resources/icons/icon.png`
- `resources/icons/source/icon-dark.svg`
- `resources/icons/source/icon-light.svg`
- `resources/icons/variants/icon-<theme>-<size>.png`
- `resources/icons/installer/installer-header.bmp`
- `resources/icons/installer/installer-sidebar.bmp`
- `resources/icons/installer/uninstaller-sidebar.bmp`
- `resources/icons/manifest.json`

## 常见问题

- 权限不足：请以管理员权限启动应用后重试
- 需要重启：按提示重启 Windows 后再次执行安装流程
- bootstrap 脚本找不到：检查 `resources/powershell/bootstrap-runtime.ps1` 是否已入包，或通过 `UFREN_BOOTSTRAP_SCRIPT` 覆盖
- 安装后白板：请确认使用的是最新安装包，旧版本曾存在生产资源路径错误
