import { createCopyGetter, defineLocaleBundle } from "./shared.js";

export const runtimeMessages = defineLocaleBundle({
    title: "本地服务",
    loadingSubtitle: "正在检查运行时状态与健康端点",
    subtitle: "启动或停止 Hermes 服务，确认健康状态，并查看最新输出。",
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
      probing: "探测中...",
      openHealth: "打开健康地址"
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
    surface: {
      overviewKicker: "Local Service",
      overviewEyebrow: "把服务状态、健康确认、端点探测和输出日志收在同一个更聚焦的辅助页面里。",
      telemetryTitle: "运行信号",
      telemetrySubtitle: "在同一个区域快速确认服务地址、最近检查和输出活跃度。"
    },
    logLines: (count: number) => `${count} 行`,
    pulseFallback: (status: string) => `运行时当前状态为 ${status}，可以继续刷新或探测来确认服务情况。`,
    openEndpointFailed: "打开运行时地址失败"
  } as const, {
    title: "Local Service",
    loadingSubtitle: "Checking runtime status and health endpoint",
    subtitle: "Start or stop Hermes service, confirm health, and inspect recent output.",
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
      probing: "Probing...",
      openHealth: "Open Health Endpoint"
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
    surface: {
      overviewKicker: "Local Service",
      overviewEyebrow: "Keep service status, health checks, endpoint probes, and logs in one focused support page.",
      telemetryTitle: "Service Summary",
      telemetrySubtitle: "Quickly confirm endpoint, last check, and output activity from the same area."
    },
    logLines: (count: number) => `${count} lines`,
    pulseFallback: (status: string) => `Runtime is currently ${status}. Refresh or probe to verify readiness.`,
    openEndpointFailed: "Failed to open runtime endpoint"
  });

export const getRuntimeCopy = createCopyGetter(runtimeMessages);
