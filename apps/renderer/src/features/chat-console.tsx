import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type JSX,
  type KeyboardEvent
} from "react";

import type { ChatMessageDto } from "@ufren/shared";

import type { AppLocale } from "../app/ui-copy.js";

type ChatState = "idle" | "sending" | "error";

interface ChatPreset {
  id: string;
  label: string;
  model?: string;
  systemPrompt: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  systemPrompt: string;
  messages: ChatMessageDto[];
  usageText: string;
}

interface ChatConsoleCopy {
  title: string;
  subtitle: string;
  historyTitle: string;
  historySubtitle: string;
  newSession: string;
  deleteSession: string;
  searchSessions: string;
  presetsTitle: string;
  presetsSubtitle: string;
  renameSession: string;
  opsTitle: string;
  opsHealthy: string;
  opsAttention: string;
  opsRuntime: string;
  opsDashboard: string;
  openRuntime: string;
  openDashboard: string;
  sessionUntitled: string;
  systemPrompt: string;
  systemPromptPlaceholder: string;
  model: string;
  modelPlaceholder: string;
  composer: string;
  composerPlaceholder: string;
  send: string;
  sending: string;
  clear: string;
  welcomeTitle: string;
  welcomeHint: string;
  assistant: string;
  user: string;
  sessionMessages: string;
  usage: string;
  enterHint: string;
  errorPrefix: string;
  saveState: string;
  savedNow: string;
  emptySearch: string;
}

const chatSessionsStorageKey = "ufren.desktop.chat.sessions.v1";
const chatActiveSessionStorageKey = "ufren.desktop.chat.active-session.v1";

function readDesktopApi(): Window["ufrenDesktopApi"] | null {
  return typeof window.ufrenDesktopApi === "undefined" ? null : window.ufrenDesktopApi;
}

function requireDesktopApi(): Window["ufrenDesktopApi"] {
  const api = readDesktopApi();
  if (!api) {
    throw new Error("Desktop bridge unavailable. Ensure Electron preload is loaded before rendering the UI.");
  }
  return api;
}

function getCopy(locale: AppLocale): ChatConsoleCopy {
  return locale === "zh"
    ? {
        title: "Chat Workspace",
        subtitle: "使用我们自己的对话界面直接调用 Hermes API server。",
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
        opsAttention: "服务尚未完全就绪，建议先处理运行时或 dashboard。",
        opsRuntime: "运行时",
        opsDashboard: "管理台",
        openRuntime: "前往 Runtime",
        openDashboard: "前往 Dashboard",
        sessionUntitled: "未命名会话",
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
        welcomeHint: "这里走 Hermes API server，与官方 dashboard 的管理能力分离。",
        assistant: "助手",
        user: "你",
        sessionMessages: "条消息",
        usage: "令牌统计",
        enterHint: "Ctrl/Cmd + Enter 发送",
        errorPrefix: "请求失败",
        saveState: "自动保存",
        savedNow: "刚刚保存",
        emptySearch: "没有匹配的会话"
      }
    : {
        title: "Chat Workspace",
        subtitle: "Use a native chat interface that talks directly to the Hermes API server.",
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
        opsAttention: "The service is not fully ready yet. Check runtime or dashboard first.",
        opsRuntime: "Runtime",
        opsDashboard: "Dashboard",
        openRuntime: "Open Runtime",
        openDashboard: "Open Dashboard",
        sessionUntitled: "Untitled Session",
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
        welcomeHint: "This uses the Hermes API server and stays separate from the official dashboard controls.",
        assistant: "Assistant",
        user: "You",
        sessionMessages: "messages",
        usage: "Token Usage",
        enterHint: "Ctrl/Cmd + Enter to send",
        errorPrefix: "Request failed",
        saveState: "Auto-save",
        savedNow: "Saved just now",
        emptySearch: "No matching sessions"
      };
}

function createSession(locale: AppLocale): ChatSession {
  const now = new Date().toISOString();
  const title = locale === "zh" ? "新的会话" : "New Session";
  return {
    id: `session-${crypto.randomUUID()}`,
    title,
    createdAt: now,
    updatedAt: now,
    model: "",
    systemPrompt: "",
    messages: [],
    usageText: ""
  };
}

function safelyReadSessions(locale: AppLocale): ChatSession[] {
  try {
    const raw = localStorage.getItem(chatSessionsStorageKey);
    if (!raw) {
      return [createSession(locale)];
    }
    const parsed = JSON.parse(raw) as ChatSession[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createSession(locale)];
    }
    return parsed.map((session) => ({
      ...session,
      model: session.model ?? "",
      systemPrompt: session.systemPrompt ?? "",
      messages: Array.isArray(session.messages) ? session.messages : [],
      usageText: session.usageText ?? ""
    }));
  } catch {
    return [createSession(locale)];
  }
}

function truncateTitle(content: string, locale: AppLocale): string {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return locale === "zh" ? "新的会话" : "New Session";
  }
  return normalized.slice(0, 36);
}

function buildPresets(locale: AppLocale): ChatPreset[] {
  return locale === "zh"
    ? [
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
      ]
    : [
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
      ];
}

export function ChatConsole({
  locale,
  runtimeStatus,
  runtimeEndpoint,
  dashboardStatus,
  onOpenRuntime,
  onOpenDashboard
}: {
  locale: AppLocale;
  runtimeStatus?: string;
  runtimeEndpoint?: string;
  dashboardStatus?: string;
  onOpenRuntime?: () => void;
  onOpenDashboard?: () => void;
}): JSX.Element {
  const copy = useMemo(() => getCopy(locale), [locale]);
  const presets = useMemo(() => buildPresets(locale), [locale]);
  const [sessions, setSessions] = useState<ChatSession[]>(() => safelyReadSessions(locale));
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const stored = localStorage.getItem(chatActiveSessionStorageKey);
    return stored ?? safelyReadSessions(locale)[0]?.id ?? createSession(locale).id;
  });
  const [sessionQuery, setSessionQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<ChatState>("idle");
  const [errorText, setErrorText] = useState("");
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ??
    sessions[0] ??
    createSession(locale);
  const messages = activeSession.messages;
  const usageText = activeSession.usageText;
  const systemPrompt = activeSession.systemPrompt;
  const model = activeSession.model;
  const canSend = draft.trim().length > 0 && state !== "sending";
  const serviceHealthy = runtimeStatus === "running";
  const filteredSessions = sessions.filter((session) => {
    const query = sessionQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return (
      session.title.toLowerCase().includes(query) ||
      session.messages.some((message) => message.content.toLowerCase().includes(query))
    );
  });

  const scrollToBottom = useCallback(() => {
    const node = transcriptRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    localStorage.setItem(chatSessionsStorageKey, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (!sessions.some((session) => session.id === activeSessionId) && sessions[0]) {
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  useEffect(() => {
    localStorage.setItem(chatActiveSessionStorageKey, activeSessionId);
  }, [activeSessionId]);

  const updateActiveSession = useCallback(
    (updater: (session: ChatSession) => ChatSession) => {
      setSessions((current) =>
        current.map((session) =>
          session.id === activeSessionId ? updater(session) : session
        )
      );
    },
    [activeSessionId]
  );

  const handleCreateSession = useCallback(() => {
    const next = createSession(locale);
    setSessions((current) => [next, ...current]);
    setActiveSessionId(next.id);
    setDraft("");
    setErrorText("");
    setState("idle");
  }, [locale]);

  const handleDeleteSession = useCallback(() => {
    if (sessions.length === 1) {
      const next = createSession(locale);
      setSessions([next]);
      setActiveSessionId(next.id);
      setDraft("");
      return;
    }

    const remaining = sessions.filter((session) => session.id !== activeSessionId);
    setSessions(remaining);
    setActiveSessionId(remaining[0].id);
    setDraft("");
    setErrorText("");
    setState("idle");
  }, [activeSessionId, locale, sessions]);

  const handleRenameSession = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextTitle = event.target.value;
      updateActiveSession((session) => ({
        ...session,
        title: nextTitle,
        updatedAt: new Date().toISOString()
      }));
    },
    [updateActiveSession]
  );

  const handleApplyPreset = useCallback(
    (preset: ChatPreset) => {
      updateActiveSession((session) => ({
        ...session,
        model: preset.model ?? session.model,
        systemPrompt: preset.systemPrompt,
        updatedAt: new Date().toISOString()
      }));
    },
    [updateActiveSession]
  );

  const handleClear = useCallback(() => {
    updateActiveSession((session) => ({
      ...session,
      messages: [],
      usageText: "",
      updatedAt: new Date().toISOString()
    }));
    setDraft("");
    setErrorText("");
  }, [updateActiveSession]);

  const handleSubmit = useCallback(async () => {
    const trimmedDraft = draft.trim();
    if (!trimmedDraft) {
      return;
    }

    const nextMessages: ChatMessageDto[] = [...messages, { role: "user", content: trimmedDraft }];
    updateActiveSession((session) => ({
      ...session,
      title:
        session.messages.length === 0 && session.title === (locale === "zh" ? "新的会话" : "New Session")
          ? truncateTitle(trimmedDraft, locale)
          : session.title || truncateTitle(trimmedDraft, locale),
      messages: nextMessages,
      updatedAt: new Date().toISOString()
    }));
    setDraft("");
    setState("sending");
    setErrorText("");

    try {
      const response = await requireDesktopApi().chatComplete({
        messages: nextMessages.filter((message) => message.role !== "system"),
        systemPrompt: systemPrompt.trim() || undefined,
        model: model.trim() || undefined
      });

      updateActiveSession((session) => ({
        ...session,
        messages: [...session.messages, { role: "assistant", content: response.message }],
        usageText: response.usage
          ? [
              response.usage.promptTokens != null ? `prompt ${response.usage.promptTokens}` : "",
              response.usage.completionTokens != null ? `completion ${response.usage.completionTokens}` : "",
              response.usage.totalTokens != null ? `total ${response.usage.totalTokens}` : ""
            ]
              .filter(Boolean)
              .join(" | ")
          : "",
        updatedAt: new Date().toISOString()
      }));
      if (response.usage) {
        const usageParts = [
          response.usage.promptTokens != null ? `prompt ${response.usage.promptTokens}` : "",
          response.usage.completionTokens != null ? `completion ${response.usage.completionTokens}` : "",
          response.usage.totalTokens != null ? `total ${response.usage.totalTokens}` : ""
        ].filter(Boolean);
        updateActiveSession((session) => ({
          ...session,
          usageText: usageParts.join(" | "),
          updatedAt: new Date().toISOString()
        }));
      }
      setState("idle");
    } catch (error) {
      setState("error");
      setErrorText(error instanceof Error ? `${copy.errorPrefix}: ${error.message}` : copy.errorPrefix);
    }
  }, [copy.errorPrefix, draft, locale, messages, model, systemPrompt, updateActiveSession]);

  const handleFormSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleSubmit();
    },
    [handleSubmit]
  );

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <section className="chat-console-shell">
      <section className="panel-card chat-sidebar-card chat-history-card">
        <header className="panel-header">
          <div>
            <h3 className="panel-title">{copy.historyTitle}</h3>
            <p className="panel-subtitle">{copy.historySubtitle}</p>
          </div>
        </header>

        <div className="chat-history-toolbar">
          <button type="button" className="btn btn-primary" onClick={handleCreateSession}>
            {copy.newSession}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleDeleteSession}>
            {copy.deleteSession}
          </button>
        </div>

        <input
          className="chat-input"
          value={sessionQuery}
          onChange={(event) => setSessionQuery(event.target.value)}
          placeholder={copy.searchSessions}
        />

        <div className="chat-session-list">
          {filteredSessions.length > 0 ? (
            filteredSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className={`chat-session-item${session.id === activeSessionId ? " chat-session-item-active" : ""}`}
                onClick={() => setActiveSessionId(session.id)}
              >
                <span className="chat-session-title">{session.title || copy.sessionUntitled}</span>
                <span className="chat-session-meta">
                  {session.messages.length} {copy.sessionMessages}
                </span>
              </button>
            ))
          ) : (
            <div className="empty-state chat-session-empty">
              <span className="state-muted">{copy.emptySearch}</span>
            </div>
          )}
        </div>
      </section>

      <section className="panel-card chat-sidebar-card chat-settings-card">
        <header className="panel-header">
          <div>
            <h3 className="panel-title">{copy.title}</h3>
            <p className="panel-subtitle">{copy.subtitle}</p>
          </div>
        </header>

        <section className={`chat-ops-banner${serviceHealthy ? " chat-ops-banner-ready" : ""}`}>
          <div className="chat-ops-copy">
            <strong className="chat-ops-title">{copy.opsTitle}</strong>
            <span className="state-muted">{serviceHealthy ? copy.opsHealthy : copy.opsAttention}</span>
          </div>
          <div className="chat-ops-grid">
            <div className="chat-ops-item">
              <span className="chat-ops-label">{copy.opsRuntime}</span>
              <strong className="chat-ops-value">{runtimeStatus ?? "-"}</strong>
            </div>
            <div className="chat-ops-item">
              <span className="chat-ops-label">{copy.opsDashboard}</span>
              <strong className="chat-ops-value">{dashboardStatus ?? "-"}</strong>
            </div>
          </div>
          <div className="panel-actions action-ribbon">
            <button type="button" className="btn btn-ghost" onClick={onOpenRuntime}>
              {copy.openRuntime}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onOpenDashboard}>
              {copy.openDashboard}
            </button>
          </div>
          {runtimeEndpoint ? <div className="chat-runtime-endpoint">{runtimeEndpoint}</div> : null}
        </section>

        <div className="chat-settings-grid">
          <label className="field-stack">
            <span className="field-label">{copy.renameSession}</span>
            <input
              className="chat-input"
              value={activeSession.title}
              onChange={handleRenameSession}
              placeholder={copy.sessionUntitled}
            />
          </label>

          <section className="chat-presets-block">
            <div className="content-frame-header">
              <div className="content-frame-title">{copy.presetsTitle}</div>
              <div className="content-frame-caption">{copy.presetsSubtitle}</div>
            </div>
            <div className="chat-preset-row">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="chat-preset-chip"
                  onClick={() => handleApplyPreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>

          <label className="field-stack">
            <span className="field-label">{copy.systemPrompt}</span>
            <textarea
              className="chat-input chat-input-area"
              rows={6}
              value={systemPrompt}
              onChange={(event) =>
                updateActiveSession((session) => ({
                  ...session,
                  systemPrompt: event.target.value,
                  updatedAt: new Date().toISOString()
                }))
              }
              placeholder={copy.systemPromptPlaceholder}
            />
          </label>

          <label className="field-stack">
            <span className="field-label">{copy.model}</span>
            <input
              className="chat-input"
              value={model}
              onChange={(event) =>
                updateActiveSession((session) => ({
                  ...session,
                  model: event.target.value,
                  updatedAt: new Date().toISOString()
                }))
              }
              placeholder={copy.modelPlaceholder}
            />
          </label>
        </div>
      </section>

      <section className="panel-card chat-main-card">
        <div className="chat-transcript" ref={transcriptRef}>
          {messages.length === 0 ? (
            <div className="empty-state chat-empty-state">
              <strong className="state-title">{copy.welcomeTitle}</strong>
              <span className="state-muted">{copy.welcomeHint}</span>
            </div>
          ) : (
            messages.map((message, index) => (
              <article
                key={`${message.role}-${index}-${message.content.slice(0, 20)}`}
                className={`chat-bubble chat-bubble-${message.role}`}
              >
                <div className="chat-bubble-head">
                  <span className="chat-role">
                    {message.role === "assistant" ? copy.assistant : copy.user}
                  </span>
                </div>
                <div className="chat-bubble-body">{message.content}</div>
              </article>
            ))
          )}
        </div>

        <div className="chat-toolbar">
          <span className="chat-toolbar-hint">{copy.enterHint}</span>
          <span className="chat-toolbar-hint">
            {copy.saveState}: {copy.savedNow}
          </span>
          {usageText ? (
            <span className="chat-usage-chip">
              {copy.usage}: {usageText}
            </span>
          ) : null}
          {errorText ? <span className="chat-error-text">{errorText}</span> : null}
        </div>

        <form className="chat-composer" onSubmit={handleFormSubmit}>
          <label className="field-stack chat-composer-field">
            <span className="field-label">{copy.composer}</span>
            <textarea
              className="chat-input chat-input-area chat-composer-textarea"
              rows={5}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={copy.composerPlaceholder}
            />
          </label>

          <div className="panel-actions action-ribbon">
            <button type="submit" className="btn btn-primary" disabled={!canSend}>
              {state === "sending" ? copy.sending : copy.send}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleClear}>
              {copy.clear}
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}
