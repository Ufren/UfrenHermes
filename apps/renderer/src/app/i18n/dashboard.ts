import { createCopyGetter, defineLocaleBundle } from "./shared.js";

export const dashboardMessages = defineLocaleBundle({
    title: "Hermes Dashboard",
    subtitle: "在桌面端内打开官方管理页，集中处理配置与模型管理。",
    frameTitle: "官方管理页",
    frameHint: "支持账号、模型、环境变量和 Hermes 配置管理。",
    urlLabel: "Dashboard 地址",
    detailLabel: "状态说明",
    runtimeTitle: "运行时联动",
    runtimeHint: "把管理页入口和 Hermes 服务状态放在同一视角中。",
    runtimeStatusLabel: "Runtime 状态",
    runtimeEndpointLabel: "Runtime 地址",
    runtimeAction: "前往 Runtime",
    refresh: "刷新状态",
    start: "启动 Dashboard",
    stop: "停止 Dashboard",
    open: "浏览器打开",
    loading: "正在获取 dashboard 状态...",
    emptyTitle: "Dashboard 尚未运行",
    emptyHint: "先启动 dashboard，再在桌面端内打开官方管理页。",
    fallbackError: "获取 dashboard 状态失败",
    startFailed: "启动 dashboard 失败",
    stopFailed: "停止 dashboard 失败",
    surface: {
      overviewKicker: "Hermes Admin",
      overviewEyebrow: "把官方 dashboard 作为管理页面嵌入桌面端，同时保留本地状态与跳转能力。",
      runtimeOverviewTitle: "运行时联动",
      runtimeOverviewSubtitle: "管理台状态与 Hermes runtime 保持同一视野。",
      liveStatus: "当前状态",
      destination: "管理入口"
    }
  } as const, {
    title: "Hermes Dashboard",
    subtitle: "Open the official management UI inside the desktop client for configuration and model management.",
    frameTitle: "Official Admin",
    frameHint: "Manage accounts, models, environment variables, and Hermes settings.",
    urlLabel: "Dashboard URL",
    detailLabel: "Status Detail",
    runtimeTitle: "Runtime Linkage",
    runtimeHint: "Keep the admin entry and Hermes service health in the same view.",
    runtimeStatusLabel: "Runtime Status",
    runtimeEndpointLabel: "Runtime Endpoint",
    runtimeAction: "Open Runtime",
    refresh: "Refresh Status",
    start: "Start Dashboard",
    stop: "Stop Dashboard",
    open: "Open In Browser",
    loading: "Loading dashboard status...",
    emptyTitle: "Dashboard is not running",
    emptyHint: "Start the dashboard first, then open the official UI inside the desktop app.",
    fallbackError: "Failed to load dashboard status",
    startFailed: "Failed to start dashboard",
    stopFailed: "Failed to stop dashboard",
    surface: {
      overviewKicker: "Hermes Admin",
      overviewEyebrow: "Embed the official dashboard as the management page while keeping local status and launch actions nearby.",
      runtimeOverviewTitle: "Runtime Linkage",
      runtimeOverviewSubtitle: "Dashboard state and Hermes runtime stay visible together.",
      liveStatus: "Current Status",
      destination: "Destination"
    }
  });

export const getDashboardCopy = createCopyGetter(dashboardMessages);
