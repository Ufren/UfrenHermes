import { createCopyGetter, defineLocaleBundle } from "./shared.js";

export const installerMessages = defineLocaleBundle({
    title: "环境准备",
    loadingSubtitle: "正在准备安装器工作区",
    subtitle: "准备依赖、修复安装问题，并确认运行前置条件已经齐备。",
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
    surface: {
      overviewKicker: "Environment Setup",
      overviewEyebrow: "把安装前置条件、错误线索、时间线和命令轨迹收在同一个更易理解的准备页里。",
      issueTitle: "问题摘要",
      issueSubtitle: "优先暴露影响安装继续推进的错误线索。",
      traceLabel: "轨迹数量"
    },
    exit: "退出"
  } as const, {
    title: "Environment Setup",
    loadingSubtitle: "Preparing installer workspace",
    subtitle: "Prepare dependencies, recover installation issues, and confirm runtime prerequisites are ready.",
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
    surface: {
      overviewKicker: "Environment Setup",
      overviewEyebrow: "Keep prerequisites, issue guidance, timeline, and command traces in one setup page that is easier to scan.",
      issueTitle: "Issue Summary",
      issueSubtitle: "Expose the signals that most affect installation progress first.",
      traceLabel: "Trace Count"
    },
    exit: "exit"
  });

export const getInstallerCopy = createCopyGetter(installerMessages);
