# Ufren Hermes Desktop

Windows 桌面容器，用于在 Electron UI 中管理并运行 Hermes Agent（运行时落在 WSL2 环境）。

## 产品简介

`ufren-hermes-desktop` 提供以下能力：

- 在 Windows 桌面上提供 Hermes 的统一控制面板（Electron + React）。
- 通过 WSL2 承载运行时，减少宿主机环境差异带来的问题。
- 提供安装器流程：检查 WSL、检查/安装发行版、bootstrap runtime。
- 提供安装过程可观测能力：状态变更、错误分类、执行 trace、失败后重试。

> 设计原则：`hermes-agent` 目录保持为上游依赖，不在本项目内直接改动。

## 项目结构

```text
ufren-hermes-desktop/
  apps/
    electron-main/   # Electron 主进程 + preload + IPC handlers
    renderer/        # React 前端
  packages/
    shared/          # IPC 通道、DTO、Zod schema、共享类型
    runtime-sdk/     # 进程调用、WSL/运行时相关封装
    installer-sdk/   # 安装状态机与编排器
```

## 环境要求

- Windows 10/11（推荐 Windows 11）
- Node.js >= 20.11.0
- npm >= 10
- PowerShell 5+（系统默认）
- 建议开启虚拟化能力（BIOS）

可选环境变量：

- `UFREN_WSL_DISTRO`：指定目标发行版（默认自动选择，兜底 `Ubuntu`）
- `UFREN_RUNTIME_ROOT`：指定 runtime 在 WSL 中的安装目录
- `UFREN_BOOTSTRAP_SCRIPT`：自定义 bootstrap 脚本路径
- `UFREN_HERMES_AGENT_PATH`：覆盖 hermes-agent Windows 源目录（默认自动解析）

## 安装依赖

在项目根目录执行：

```bash
npm install
```

## 开发模式

启动完整开发链路（Renderer + Electron）：

```bash
npm run dev
```

该命令会并行启动：

- `npm run dev:renderer`
- `npm run dev:electron`

## 构建方式

全量构建：

```bash
npm run build
```

分步构建：

```bash
npm run build:packages
npm run build:apps
```

## 发布构建

当前仓库已具备发布前强校验 + 打包链路，可直接使用以下命令：

```bash
npm run release:prepare
npm run package:win
```

说明：

- `assets:icons`：生成并更新品牌图标资源（深浅两套、多尺寸 PNG、默认 `icon.ico` / `icon.png`、NSIS 安装器 BMP、`manifest.json`）。
- `assets:icons:brand`：`assets:icons` 的别名命令，便于在 CI/CD 或设计协作流程中使用。
- `release:prepare` = `clean + lint + typecheck + test + build`。
- `package:dir`：生成未安装目录（用于验证包内容）。
- `package:win`：生成 NSIS 安装包 + portable 包（x64）。
- `package:win:x64`：仅生成 NSIS x64 安装包。
- `package:win:portable`：仅生成 portable x64 包。
- `package:win:ci`：CI 场景打包（禁用发布，仅生成 NSIS x64 产物）。
- `apps/electron-main` 的主进程产物位于 `apps/electron-main/dist`。
- `apps/renderer` 的前端产物位于 `apps/renderer/dist`。
- 发布产物输出目录为 `release/`。

建议的发布前检查清单：

1. 在干净工作区执行完整校验（lint/typecheck/test/build）。
2. 确认安装器关键路径可用（WSL 检查、发行版检查、bootstrap、retry、trace）。
3. 验证至少两类宿主机场景：全新机器、已有 WSL2 机器。
4. 确认 `resources/powershell/bootstrap-runtime.ps1` 已包含在发布包策略中。

> 备注：若后续接入 `electron-builder` 或其他打包器，可在此基础上新增 `package`/`release` 脚本并固化产物目录规范。

## 图标资产说明

执行 `npm run assets:icons` 后，图标资产输出如下：

- `resources/icons/icon.ico`：Windows 安装包与应用主图标（默认）。
- `resources/icons/icon.png`：默认 256x256 PNG 图标（从 dark 主题导出）。
- `resources/icons/source/icon-dark.svg`：可编辑 dark 主题源文件。
- `resources/icons/source/icon-light.svg`：可编辑 light 主题源文件。
- `resources/icons/variants/icon-<theme>-<size>.png`：导出的多尺寸 PNG（`16/24/32/48/64/128/256/512`）。
- `resources/icons/installer/installer-header.bmp`：NSIS 安装器顶部品牌图。
- `resources/icons/installer/installer-sidebar.bmp`：NSIS 安装器侧边品牌图。
- `resources/icons/installer/uninstaller-sidebar.bmp`：NSIS 卸载器侧边品牌图。
- `resources/icons/manifest.json`：图标导出清单，便于资产追踪与自动化流程消费。

## 品牌化覆盖范围

当前版本已覆盖以下品牌触点：

- 应用品牌元数据：`appId/productName/executableName/publisherName`。
- 安装器品牌化：NSIS 安装/卸载图标、header 图、sidebar 图。
- 桌面端界面：统一品牌色板、品牌头图文案、Installer/Runtime 面板样式。
- 日志可观测性：主进程日志带 `scope=ufren-hermes-desktop` 便于过滤与聚合。

## 质量校验

```bash
npm run lint
npm run typecheck
npm run test
```

说明：

- `test` 当前覆盖 `runtime-sdk`、`installer-sdk`、`electron-main`。
- `electron-main` 测试会先 `build` 再运行 `node --test dist/**/*.test.js`。

## 安装器行为说明

安装器主流程：

1. 检查 WSL 可用性
2. 确定目标发行版（优先默认发行版）
3. 校验/安装发行版
4. 必要时将发行版升级到 WSL2
5. 执行 runtime bootstrap

关键特性：

- 并发保护：同一时间仅允许一个安装流程。
- 错误分类：返回结构化 issue（是否可重试、是否需要管理员权限、是否需要重启）。
- 实时状态：主进程推送 `installer/context-changed`。
- 执行追踪：可读取每条命令的耗时、退出码与输出摘要。
- 失败重试：支持 `installer/retry`。
- hermes-agent 打包：安装包内置只读 `hermes-agent` 资源并在安装时同步到 WSL runtime。
- Python 隔离：安装阶段创建 `runtime/.venv`，并在该 venv 内安装 `hermes-agent`。

## 宿主机已有 WSL/WSL2 场景

如果宿主机已存在 WSL 环境：

- 已可用的 WSL 不会重复安装。
- 已存在目标发行版时不会重复安装发行版。
- 若目标发行版为 WSL1，会自动尝试升级到 WSL2。
- 最终仍会执行 bootstrap，以确保 runtime 一致性。

## Hermes Agent 运行机制

- 打包阶段：先强制重建 `../hermes-agent/web` 的 Dashboard 前端产物，再由 `electron-builder` 将上级目录 `../hermes-agent` 作为 `extraResources/hermes-agent` 打入安装包。
- 安装阶段：`bootstrap-runtime.ps1` 将该只读资源同步到 WSL 的 `$RUNTIME_DIR/hermes-agent`。
- 依赖准备：在 WSL 中创建 `$RUNTIME_DIR/.venv`，并执行 `pip install $RUNTIME_DIR/hermes-agent`。
- 启动阶段：`start-hermes.sh` 强制使用 `$RUNTIME_DIR/.venv/bin/hermes` 启动，避免依赖系统全局 Python 环境。

## 常见问题

- 权限不足：请使用管理员权限启动应用后重试。
- 提示需要重启：重启 Windows 后再次执行安装流程。
- bootstrap 脚本不存在：检查 `resources/powershell/bootstrap-runtime.ps1` 是否被正确打包，或通过 `UFREN_BOOTSTRAP_SCRIPT` 指定路径。
