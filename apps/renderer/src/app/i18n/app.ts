import { createCopyGetter, defineLocaleBundle } from "./shared.js";

export const appMessages = defineLocaleBundle({
    windowSubtitle: "桌面客户端",
    preloadWarning: "桌面桥接尚未就绪。请等待 Electron preload 构建完成后再重新打开客户端。",
    desktopConsole: "Hermes Desktop",
    controlPlane: "本地服务",
    environment: "环境状态",
    nav: {
      workspace: { label: "首页", description: "最近状态、下一步与快捷入口" },
      chat: { label: "聊天", description: "会话、提示词与对话记录" },
      dashboard: { label: "管理", description: "官方 dashboard 与管理入口" },
      installer: { label: "环境", description: "安装依赖并修复初始化问题" },
      runtime: { label: "服务", description: "启动 API、检查健康并查看日志" }
    },
    topbar: {
      kicker: "Hermes Agent 桌面端",
      title: "桌面客户端",
      subtitle: "把聊天、服务状态和环境维护收敛到同一应用里"
    },
    stats: {
      completion: "完成度",
      visiblePanels: "可见面板",
      bridgeOnline: "桥接在线",
      recoveryMode: "恢复模式"
    },
    actions: {
      collapseSidebar: "收起侧栏",
      expandSidebar: "展开侧栏",
      dark: "深色",
      light: "浅色",
      chinese: "中文",
      english: "English",
      openRuntime: "打开运行时",
      oneClickReady: "一键就绪",
      oneClickBusy: "正在准备",
      collapse: "收起",
      expand: "展开",
      viewInstaller: "前往安装器",
      viewRuntime: "前往运行时",
      viewHealth: "查看健康"
    },
    hero: {
      kicker: "系统总览",
      title: "用一条清晰路径让 `hermes-agent` 从未就绪到可服务。",
      subtitle: "把环境准备、运行时状态、健康检查和日志集中到同一工作流里，减少来回切换。",
      readiness: "当前就绪度",
      readinessCaption: "基于安装、运行和健康三项核心状态自动计算。",
      endpointTitle: "当前接入端点",
      endpointHint: "一键流程会自动完成安装、启动和健康校验。"
    },
    workflow: {
      kicker: "推荐流程",
      title: "操作步骤",
      subtitle: "按人类操作逻辑组织，先准备环境，再启动服务，最后确认健康。",
      done: "已完成"
    },
    workspace: {
      kicker: "工作区",
      title: "核心操作面板",
      subtitle: "根据导航选择聚焦视图，也可以在总览模式下同时查看全部面板。",
      order: "面板顺序",
      bridge: "桌面桥接",
      connected: "已连接",
      collapsedTip: "当前已收起，点击展开继续操作。",
      drag: "拖动排序"
    },
    localeLabel: "语言",
    themeLabel: "主题",
    viewMode: {
      workspace: "首页",
      installer: "环境",
      runtime: "服务"
    },
    flow: {
      ready: "已可使用",
      stepsRemaining: (count: number) => `还差 ${count} 步`,
      checkingInstaller: "正在检查安装器状态...",
      installing: "正在安装运行时依赖...",
      retrying: "检测到可重试问题，正在执行重试流程...",
      starting: "正在启动 hermes-agent 运行时...",
      checkingHealth: "正在执行健康检查...",
      success: (endpoint: string) => `hermes-agent 已就绪，当前端点：${endpoint}`,
      failed: "一键流程执行失败。"
    },
    statusCards: {
      installer: "安装器",
      runtime: "运行时",
      health: "健康",
      endpoint: "端点"
    }
  } as const, {
    windowSubtitle: "Desktop Client",
    preloadWarning: "Desktop bridge is not ready yet. Reopen the client after Electron preload finishes building.",
    desktopConsole: "Hermes Desktop",
    controlPlane: "Local Service",
    environment: "Environment",
    nav: {
      workspace: { label: "Home", description: "Recent status, next steps, and quick entry points" },
      chat: { label: "Chat", description: "Sessions, prompts, and conversation history" },
      dashboard: { label: "Admin", description: "Official dashboard and management entry points" },
      installer: { label: "Setup", description: "Install dependencies and recover setup issues" },
      runtime: { label: "Service", description: "Start API, probe health, and inspect logs" }
    },
    topbar: {
      kicker: "Hermes Agent Desktop",
      title: "Desktop Client",
      subtitle: "Keep chat, service state, and maintenance tasks in one app"
    },
    stats: {
      completion: "Completion",
      visiblePanels: "Visible Panels",
      bridgeOnline: "Bridge Online",
      recoveryMode: "Recovery Mode"
    },
    actions: {
      collapseSidebar: "Collapse Sidebar",
      expandSidebar: "Expand Sidebar",
      dark: "Dark",
      light: "Light",
      chinese: "中文",
      english: "English",
      openRuntime: "Open Runtime",
      oneClickReady: "One-Click Ready",
      oneClickBusy: "Preparing",
      collapse: "Collapse",
      expand: "Expand",
      viewInstaller: "Go Installer",
      viewRuntime: "Go Runtime",
      viewHealth: "Open Health"
    },
    hero: {
      kicker: "System Overview",
      title: "Bring `hermes-agent` from cold start to service-ready with one clear path.",
      subtitle: "Keep environment setup, runtime state, health checks, and logs in one workflow instead of bouncing between screens.",
      readiness: "Readiness",
      readinessCaption: "Calculated from installer, runtime, and health signals.",
      endpointTitle: "Current Endpoint",
      endpointHint: "The guided flow installs, starts, and verifies health automatically."
    },
    workflow: {
      kicker: "Recommended Flow",
      title: "Operator Steps",
      subtitle: "Organized to match human expectations: prepare environment, start service, then confirm health.",
      done: "Done"
    },
    workspace: {
      kicker: "Workspace",
      title: "Core Action Panels",
      subtitle: "Use navigation to focus one workspace, or stay in overview mode to see everything together.",
      order: "Panel Order",
      bridge: "Desktop Bridge",
      connected: "Connected",
      collapsedTip: "This panel is collapsed. Expand it to continue.",
      drag: "Drag to Reorder"
    },
    localeLabel: "Language",
    themeLabel: "Theme",
    viewMode: {
      workspace: "Home",
      installer: "Setup",
      runtime: "Service"
    },
    flow: {
      ready: "Ready for use",
      stepsRemaining: (count: number) => `${count} steps remaining`,
      checkingInstaller: "Checking installer state...",
      installing: "Installing runtime dependencies...",
      retrying: "Retryable issue detected, running retry flow...",
      starting: "Starting hermes-agent runtime...",
      checkingHealth: "Running health checks...",
      success: (endpoint: string) => `hermes-agent is ready at ${endpoint}`,
      failed: "One-click flow failed."
    },
    statusCards: {
      installer: "Installer",
      runtime: "Runtime",
      health: "Health",
      endpoint: "Endpoint"
    }
  });

export const getAppCopy = createCopyGetter(appMessages);
