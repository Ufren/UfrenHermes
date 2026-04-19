export type AppLocale = "zh" | "en";

const localeStorageKey = "ufren.desktop.locale";

export function getPreferredLocale(): AppLocale {
  const stored = localStorage.getItem(localeStorageKey);
  if (stored === "zh" || stored === "en") {
    return stored;
  }

  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function persistLocale(locale: AppLocale): void {
  localStorage.setItem(localeStorageKey, locale);
}

export function getStatusLabel(status: string, locale: AppLocale): string {
  const map = {
    idle: { zh: "空闲", en: "Idle" },
    loading: { zh: "加载中", en: "Loading" },
    ready: { zh: "就绪", en: "Ready" },
    running: { zh: "运行中", en: "Running" },
    stopped: { zh: "已停止", en: "Stopped" },
    starting: { zh: "启动中", en: "Starting" },
    installing: { zh: "安装中", en: "Installing" },
    error: { zh: "异常", en: "Error" },
    degraded: { zh: "降级", en: "Degraded" },
    not_installed: { zh: "未安装", en: "Not Installed" }
  } as const;

  const item = map[status as keyof typeof map];
  return item ? item[locale] : status;
}

export function getBooleanLabel(value: boolean | null | undefined, locale: AppLocale): string {
  if (typeof value !== "boolean") {
    return locale === "zh" ? "未知" : "Unknown";
  }

  return locale === "zh" ? (value ? "是" : "否") : value ? "Yes" : "No";
}

export function getEmptyLabel(locale: AppLocale): string {
  return locale === "zh" ? "暂无" : "-";
}

export function getAppCopy(locale: AppLocale) {
  if (locale === "zh") {
    return {
      windowSubtitle: "桌面客户端",
      preloadWarning: "桌面桥接尚未就绪。请等待 Electron preload 构建完成后再重新打开客户端。",
      desktopConsole: "桌面控制台",
      controlPlane: "WSL2 控制平面",
      environment: "环境状态",
      nav: {
        workspace: { label: "总览", description: "状态、流程与关键操作" },
        chat: { label: "聊天", description: "对话与 API 调用" },
        dashboard: { label: "管理台", description: "官方 dashboard 内嵌管理" },
        installer: { label: "安装器", description: "准备依赖、修复环境并完成初始化" },
        runtime: { label: "运行时", description: "启动服务、探测接口并查看日志" }
      },
      topbar: {
        kicker: "Hermes Agent 桌面端",
        title: "运维控制台",
        subtitle: "更清晰的信息结构，更顺手的安装与运行体验"
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
        workspace: "全局总览",
        installer: "聚焦安装器",
        runtime: "聚焦运行时"
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
    } as const;
  }

  return {
    windowSubtitle: "Desktop Client",
    preloadWarning: "Desktop bridge is not ready yet. Reopen the client after Electron preload finishes building.",
    desktopConsole: "Desktop Console",
    controlPlane: "WSL2 Control Plane",
    environment: "Environment",
    nav: {
      workspace: { label: "Overview", description: "Status, workflow, and primary actions" },
      chat: { label: "Chat", description: "Conversation & API calls" },
      dashboard: { label: "Dashboard", description: "Embedded official console" },
      installer: { label: "Installer", description: "Prepare dependencies and recover setup issues" },
      runtime: { label: "Runtime", description: "Start service, probe endpoint, and inspect logs" }
    },
    topbar: {
      kicker: "Hermes Agent Desktop",
      title: "Operations Console",
      subtitle: "Cleaner information hierarchy and a smoother setup-to-runtime experience"
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
      workspace: "Overview Mode",
      installer: "Installer Focus",
      runtime: "Runtime Focus"
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
  } as const;
}

export function getInstallerCopy(locale: AppLocale) {
  if (locale === "zh") {
    return {
      title: "安装器编排",
      loadingSubtitle: "正在准备安装器工作区",
      subtitle: "负责环境准备、依赖修复和运行时初始化",
      bannerKicker: "安装控制台",
      bannerTitle: "把安装、重试和故障提示集中在同一个操作面板中。",
      metrics: {
        state: "当前状态",
        retryable: "可重试",
        admin: "管理员权限"
      },
      snapshotTitle: "诊断快照",
      snapshotCaption: "展示安装状态、错误线索和下一步建议",
      fields: {
        lastError: "最近错误",
        issueCode: "问题代码",
        retryable: "可重试",
        requiresAdmin: "需要管理员",
        requiresReboot: "需要重启",
        suggestion: "建议处理"
      },
      buttons: {
        install: "开始安装",
        retry: "重试",
        refresh: "刷新"
      },
      traceTitle: (count: number, productName: string) => `${productName} 执行轨迹 (${count})`,
      traceEmptyTitle: "还没有执行轨迹",
      traceEmptyHint: (productName: string) => `执行安装或重试后，这里会显示 ${productName} 的命令轨迹。`,
      timelineTitle: "安装时间线",
      timelineEmpty: "安装命令运行后，这里会显示关键步骤。",
      failedTitle: (productName: string) => `${productName} 安装失败`,
      failedHint: "请先查看上方问题代码和建议，再执行重试。",
      fallbackError: (productName: string) => `获取 ${productName} 安装器状态失败`,
      runFailed: (productName: string) => `${productName} 安装执行失败`,
      retryFailed: (productName: string) => `${productName} 安装重试失败`,
      bridgeError: "桌面桥接不可用，请重启 Electron 客户端。",
      exit: "退出"
    } as const;
  }

  return {
    title: "Installer Orchestration",
    loadingSubtitle: "Preparing installer workspace",
    subtitle: "Prepare environment, recover dependencies, and initialize runtime setup",
    bannerKicker: "Setup Console",
    bannerTitle: "Keep installation, retry, and recovery guidance on a single action surface.",
    metrics: {
      state: "State",
      retryable: "Retryable",
      admin: "Admin"
    },
    snapshotTitle: "Diagnostic Snapshot",
    snapshotCaption: "Installer state, issue signals, and recommended next steps",
    fields: {
      lastError: "Last Error",
      issueCode: "Issue Code",
      retryable: "Retryable",
      requiresAdmin: "Requires Admin",
      requiresReboot: "Requires Reboot",
      suggestion: "Suggestion"
    },
    buttons: {
      install: "Start Install",
      retry: "Retry",
      refresh: "Refresh"
    },
    traceTitle: (count: number, productName: string) => `${productName} Execution Trace (${count})`,
    traceEmptyTitle: "No execution trace yet",
    traceEmptyHint: (productName: string) => `Trace appears after install or retry runs for ${productName}.`,
    timelineTitle: "Install Timeline",
    timelineEmpty: "Timeline remains empty until installer commands run.",
    failedTitle: (productName: string) => `${productName} installer failed`,
    failedHint: "Review the issue code and suggestion above, then retry.",
    fallbackError: (productName: string) => `Failed to fetch ${productName} installer status`,
    runFailed: (productName: string) => `${productName} installer execution failed`,
    retryFailed: (productName: string) => `${productName} installer retry failed`,
    bridgeError: "Desktop bridge unavailable. Please restart the Electron client.",
    exit: "exit"
  } as const;
}

export function getRuntimeCopy(locale: AppLocale) {
  if (locale === "zh") {
    return {
      title: "运行时控制",
      loadingSubtitle: "正在检查运行时状态与健康端点",
      subtitle: "负责服务启停、健康确认和日志查看",
      bannerKicker: "运行控制台",
      bannerTitle: "把服务生命周期、端点探测和实时输出放进同一个工作流。",
      metrics: {
        status: "服务状态",
        health: "健康状态",
        probePath: "探测路径"
      },
      snapshotTitle: "运行快照",
      snapshotCaption: "聚合端点、最近检查时间和健康详情",
      telemetryTitle: "运行遥测",
      telemetryCaption: "用更轻量的方式查看当前信号、探测结果和日志活跃度。",
      telemetrySignal: "服务信号",
      telemetryActivity: "活动监测",
      fields: {
        endpoint: "端点地址",
        lastCheck: "最近检查",
        healthDetail: "健康详情"
      },
      buttons: {
        start: "启动",
        stop: "停止",
        refresh: "刷新",
        probe: "探测端点",
        probing: "探测中..."
      },
      probeTitle: "Agent 端点探测",
      probeHint: "发送一次请求，确认 hermes-agent 端点是否可访问。",
      probeFailedTitle: "探测失败",
      runtimeFailedTitle: "运行时操作失败",
      outputTitle: "运行输出",
      outputCaption: "展示当前运行会话的最新服务日志",
      outputEmptyTitle: "暂时没有运行日志",
      outputEmptyHint: (productName: string) => `启动运行时后，这里会显示 ${productName} 服务日志。`,
      fallbackError: (productName: string) => `${productName} 运行时返回未知错误`,
      startFailed: (productName: string) => `启动 ${productName} 运行时失败`,
      stopFailed: (productName: string) => `停止 ${productName} 运行时失败`,
      probeFailed: "运行时探测失败",
      probeLabels: {
        lifecycle: "生命周期",
        health: "健康",
        probe: "探测",
        logs: "日志"
      },
      logLines: (count: number) => `${count} 行`,
      pulseFallback: (status: string) => `运行时当前状态为 ${status}，可以继续刷新或探测来确认服务情况。`
    } as const;
  }

  return {
    title: "Runtime Control",
    loadingSubtitle: "Checking runtime status and health endpoint",
    subtitle: "Operate service lifecycle, confirm health, and inspect logs",
    bannerKicker: "Runtime Console",
    bannerTitle: "Keep service lifecycle, endpoint probing, and live output in one workflow.",
    metrics: {
      status: "Status",
      health: "Health",
      probePath: "Probe Path"
    },
    snapshotTitle: "Runtime Snapshot",
    snapshotCaption: "Aggregate endpoint, last check time, and health detail",
    telemetryTitle: "Runtime Telemetry",
    telemetryCaption: "A lighter view of current service signal, probe results, and log activity.",
    telemetrySignal: "Service Signal",
    telemetryActivity: "Activity Monitor",
    fields: {
      endpoint: "Endpoint",
      lastCheck: "Last Check",
      healthDetail: "Health Detail"
    },
    buttons: {
      start: "Start",
      stop: "Stop",
      refresh: "Refresh",
      probe: "Probe Endpoint",
      probing: "Probing..."
    },
    probeTitle: "Agent Endpoint Probe",
    probeHint: "Send one request to verify that the hermes-agent endpoint is reachable.",
    probeFailedTitle: "Probe failed",
    runtimeFailedTitle: "Runtime action failed",
    outputTitle: "Runtime Output",
    outputCaption: "Recent service logs from the active runtime session",
    outputEmptyTitle: "No runtime logs yet",
    outputEmptyHint: (productName: string) => `Start runtime to stream logs from ${productName} service.`,
    fallbackError: (productName: string) => `${productName} runtime reported an unknown error`,
    startFailed: (productName: string) => `Failed to start ${productName} runtime`,
    stopFailed: (productName: string) => `Failed to stop ${productName} runtime`,
    probeFailed: "Runtime probe failed",
    probeLabels: {
      lifecycle: "Lifecycle",
      health: "Health",
      probe: "Probe",
      logs: "Logs"
    },
    logLines: (count: number) => `${count} lines`,
    pulseFallback: (status: string) => `Runtime is currently ${status}. Refresh or probe to verify readiness.`
  } as const;
}
