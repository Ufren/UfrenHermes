# Ufren Hermes Desktop

[中文](./README.md) | [English](./README.en.md) | [日本語](./README.ja.md)

Windows desktop client for installing, starting, managing, and using Hermes Agent running inside WSL2 through an Electron UI.

## Current Scope

`ufren-hermes-desktop` currently covers these flows:

- Unified desktop entry for Installer, Runtime, Dashboard, and Chat
- WSL2-hosted runtime to reduce host-machine drift
- One-click installation flow for WSL checks, distro setup, runtime bootstrap, and resource sync
- Observable installation lifecycle with status updates, issue classification, execution trace, and retry
- Windows packaging that ships the required runtime resources inside the app

## Packaging Guarantees

This README reflects the current packaging behavior:

- The `hermes-agent` dashboard frontend is force-rebuilt before every package build, so stale `web_dist` assets do not leak into new installers
- Electron main-process runtime packages `@ufren/shared`, `@ufren/runtime-sdk`, and `@ufren/installer-sdk` are shipped with the app to avoid `ERR_MODULE_NOT_FOUND` after installation
- The renderer production build uses relative asset paths so `file://` loading works correctly in packaged Electron builds
- `bootstrap-runtime.ps1` now sends Bash scripts into WSL as literal templates, preventing PowerShell from pre-evaluating Bash expressions such as `$(mktemp -d)`
- Packaged output keeps `hermes_cli/web_dist` while excluding `../hermes-agent/web`, `package-lock.json`, and other development-only files

> Design principle: `../hermes-agent` stays an upstream dependency source. This repository integrates it, but does not become its development home.

## Repository Layout

```text
ufren-hermes-desktop/
  apps/
    electron-main/   # Electron main process, preload, IPC handlers
    renderer/        # React frontend
  packages/
    shared/          # IPC channels, DTOs, Zod schemas, shared types
    runtime-sdk/     # Process execution, WSL/runtime helpers
    installer-sdk/   # Installer state machine and orchestration
  resources/
    powershell/      # Windows-side bootstrap/sync scripts
    wsl/             # Runtime scripts executed inside WSL
```

## Requirements

- Windows 10/11, Windows 11 recommended
- Node.js `>= 20.11.0`
- `pnpm`
- `npm`, used to rebuild `hermes-agent/web`
- PowerShell 5+
- BIOS virtualization enabled is recommended

Optional environment variables:

- `UFREN_WSL_DISTRO`: target distro override, auto-detected by default, fallback `Ubuntu`
- `UFREN_RUNTIME_ROOT`: install directory inside WSL
- `UFREN_BOOTSTRAP_SCRIPT`: override bootstrap script path
- `UFREN_HERMES_AGENT_PATH`: override the Windows source path for `hermes-agent`

## Install Dependencies

```bash
pnpm install
```

## Development

Start the full development chain:

```bash
pnpm run dev
```

This launches:

- `pnpm run dev:renderer`
- `pnpm run dev:electron`

The development build loads the renderer from the Vite dev server. Packaged builds load the local production bundle.

## Build

Full build:

```bash
pnpm run build
```

Step-by-step build:

```bash
pnpm run build:packages
pnpm run build:apps
```

Quality checks:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
```

Notes:

- `test` currently covers `runtime-sdk`, `installer-sdk`, and `electron-main`
- `electron-main` tests build first, then run `node --test dist/**/*.test.js`

## Release And Packaging

Prepare a release build:

```bash
pnpm run release:prepare
```

Common packaging commands:

```bash
pnpm run package:dir
pnpm run package:win
pnpm run package:win:x64
pnpm run package:win:portable
pnpm run package:win:ci
```

Notes:

- `release:prepare` = `clean + assets:icons + release:verify + build + assets:hermes-dashboard`
- `assets:icons` generates app icons, NSIS artwork, and `manifest.json`
- `assets:hermes-dashboard` force-rebuilds `../hermes-agent/web` and refreshes `hermes_cli/web_dist`
- `package:dir` creates an unpacked app directory for inspection
- `package:win` builds the Windows targets defined in `electron-builder.yml`
- `package:win:x64` builds only the NSIS x64 installer
- `package:win:portable` builds only the x64 portable package
- `package:win:ci` is the CI-friendly packaging path with publishing disabled
- Default output directory is `release/`

## Package Content Strategy

Current `electron-builder.yml` behavior:

- Includes `apps/electron-main/dist`, `apps/renderer/dist`, and `packages/*/dist`
- Explicitly includes runtime `node_modules` entries for `@ufren/*` and `zod`
- Ships `resources/powershell` and `resources/wsl` as `extraResources`
- Ships `../hermes-agent` as `extraResources/hermes-agent`
- Excludes `../hermes-agent/web`, test folders, caches, nested `node_modules`, and common development-only files

## Installer Flow

Main installer flow:

1. Check WSL availability
2. Resolve the target distro
3. Verify or install the distro
4. Upgrade the distro to WSL2 when needed
5. Bootstrap the runtime inside WSL

Key behaviors:

- Concurrency guard: only one installer run at a time
- Structured issues: retryability, admin requirement, reboot requirement
- Live state updates through `installer/context-changed`
- Execution trace with command, args, exit code, duration, and output snippets
- Retry support through `installer/retry`
- Python isolation inside `$RUNTIME_DIR/.venv`

## Hermes Agent Sync Model

- Packaging phase: force-rebuild `../hermes-agent/web`, then ship `../hermes-agent` as a read-only packaged resource
- Install phase: `bootstrap-runtime.ps1` syncs that packaged resource into `$RUNTIME_DIR/hermes-agent` inside WSL
- Dependency phase: create `$RUNTIME_DIR/.venv` and run `pip install "$RUNTIME_DIR/hermes-agent[web]"`
- Start phase: `start-hermes.sh` always uses `$RUNTIME_DIR/.venv/bin/hermes`

## Icon Assets

Running `pnpm run assets:icons` generates:

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

- Permission denied: restart the app with administrator privileges and retry
- Reboot required: restart Windows and run the installer again
- Missing bootstrap script: verify `resources/powershell/bootstrap-runtime.ps1` is packaged, or override it with `UFREN_BOOTSTRAP_SCRIPT`
- Blank window after install: use the latest installer, older builds had a production asset path issue
