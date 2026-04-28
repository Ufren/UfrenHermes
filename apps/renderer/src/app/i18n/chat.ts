import { createCopyGetter, defineLocaleBundle } from "./shared.js";

export const chatConsoleMessages = defineLocaleBundle({
    title: "Chat Workspace",
    subtitle: "用桌面端对话界面直接调用 Hermes API 服务。",
    historyTitle: "会话历史",
    historySubtitle: "自动保存最近对话，支持快速切换不同任务上下文。",
    newSession: "新建会话",
    deleteSession: "删除会话",
    searchSessions: "搜索会话",
    presetsTitle: "提示词预设",
    presetsSubtitle: "为常见场景快速加载角色、规则和模型配置。",
    renameSession: "重命名会话",
    opsTitle: "服务状态",
    opsHealthy: "当前服务链路可用，可以直接对话。",
    opsAttention: "服务尚未完全就绪，建议先处理服务或管理页。",
    opsRuntime: "运行时",
    opsDashboard: "管理台",
    openRuntime: "前往 Runtime",
    openDashboard: "前往 Dashboard",
    sessionUntitled: "未命名会话",
    sessionTitleDefault: "新的会话",
    systemPrompt: "系统提示词",
    systemPromptPlaceholder: "定义助手角色、约束、语气或输出格式",
    model: "模型",
    modelPlaceholder: "留空则使用桌面端默认模型",
    composer: "消息输入",
    composerPlaceholder: "输入你的问题，按 Ctrl/Cmd + Enter 发送",
    send: "发送消息",
    sending: "正在生成",
    clear: "清空会话",
    welcomeTitle: "开始一段新的对话",
    welcomeHint: "这里直接连接 Hermes API，管理相关配置仍放在独立管理页中。",
    assistant: "助手",
    user: "你",
    sessionMessages: "条消息",
    usage: "令牌统计",
    enterHint: "Ctrl/Cmd + Enter 发送",
    errorPrefix: "请求失败",
    saveState: "自动保存",
    savedNow: "刚刚保存",
    emptySearch: "没有匹配的会话",
    presets: [
      {
        id: "engineering",
        label: "工程助手",
        model: "",
        systemPrompt: "你是资深全栈工程助手。优先给出可落地方案、边界条件、风险与验证步骤。"
      },
      {
        id: "product",
        label: "产品梳理",
        model: "",
        systemPrompt: "你是高级产品经理。请把需求拆成目标、用户流程、异常场景、验收标准和里程碑。"
      },
      {
        id: "ops",
        label: "运维排障",
        model: "",
        systemPrompt: "你是 SRE 顾问。排查问题时先给症状判断，再给验证命令、根因假设和修复顺序。"
      }
    ],
    surface: {
      overviewKicker: "Chat Workspace",
      overviewEyebrow: "把会话、模型、系统提示词与实时对话收敛到同一块桌面工作区里。",
      serviceTitle: "当前服务",
      serviceSubtitle: "在聊天页直接确认服务与管理页是否可用。",
      settingsTitle: "会话设置",
      settingsSubtitle: "发送前集中调整标题、预设、系统提示词和模型。",
      sessionCount: "会话数",
      messageCount: "消息数",
      draftState: "草稿状态",
      draftReady: "可发送",
      draftEmpty: "待输入"
    }
  } as const, {
    title: "Chat Workspace",
    subtitle: "Use the desktop conversation UI to talk directly to the Hermes API service.",
    historyTitle: "Sessions",
    historySubtitle: "Recent conversations stay persisted so you can jump between tasks.",
    newSession: "New Session",
    deleteSession: "Delete Session",
    searchSessions: "Search Sessions",
    presetsTitle: "Prompt Presets",
    presetsSubtitle: "Quick-load common roles, rules, and model defaults.",
    renameSession: "Rename Session",
    opsTitle: "Service Status",
    opsHealthy: "The service chain is ready. You can chat right away.",
    opsAttention: "The service is not fully ready yet. Check service or admin first.",
    opsRuntime: "Runtime",
    opsDashboard: "Dashboard",
    openRuntime: "Open Runtime",
    openDashboard: "Open Dashboard",
    sessionUntitled: "Untitled Session",
    sessionTitleDefault: "New Session",
    systemPrompt: "System Prompt",
    systemPromptPlaceholder: "Define assistant role, constraints, tone, or output format",
    model: "Model",
    modelPlaceholder: "Leave empty to use the desktop default model",
    composer: "Message",
    composerPlaceholder: "Type your prompt and press Ctrl/Cmd + Enter to send",
    send: "Send Message",
    sending: "Generating",
    clear: "Clear Session",
    welcomeTitle: "Start a new conversation",
    welcomeHint: "This connects directly to the Hermes API while management controls stay in the separate admin page.",
    assistant: "Assistant",
    user: "You",
    sessionMessages: "messages",
    usage: "Token Usage",
    enterHint: "Ctrl/Cmd + Enter to send",
    errorPrefix: "Request failed",
    saveState: "Auto-save",
    savedNow: "Saved just now",
    emptySearch: "No matching sessions",
    presets: [
      {
        id: "engineering",
        label: "Engineering",
        model: "",
        systemPrompt:
          "You are a senior full-stack engineering assistant. Prioritize implementable solutions, edge cases, risks, and validation steps."
      },
      {
        id: "product",
        label: "Product",
        model: "",
        systemPrompt:
          "You are a senior product manager. Break requests into goals, user flows, edge cases, acceptance criteria, and milestones."
      },
      {
        id: "ops",
        label: "Operations",
        model: "",
        systemPrompt:
          "You are an SRE advisor. Start with symptom analysis, then provide validation steps, root-cause hypotheses, and recovery order."
      }
    ],
    surface: {
      overviewKicker: "Chat Workspace",
      overviewEyebrow: "Bring sessions, model setup, system prompts, and live conversation into one desktop workflow.",
      serviceTitle: "Current Service",
      serviceSubtitle: "Confirm service and admin availability without leaving chat.",
      settingsTitle: "Session Settings",
      settingsSubtitle: "Adjust title, presets, system prompt, and model before sending.",
      sessionCount: "Sessions",
      messageCount: "Messages",
      draftState: "Draft State",
      draftReady: "Ready",
      draftEmpty: "Waiting"
    }
  });

export const getChatConsoleCopy = createCopyGetter(chatConsoleMessages);
