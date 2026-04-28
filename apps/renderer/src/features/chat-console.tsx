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

import { getChatConsoleCopy, type AppLocale } from "../app/i18n/index.js";

type ChatState = "idle" | "sending" | "error";

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

type ChatPreset = ReturnType<typeof getChatConsoleCopy>["presets"][number];

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

function createSession(locale: AppLocale): ChatSession {
  const now = new Date().toISOString();
  const title = getChatConsoleCopy(locale).sessionTitleDefault;
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
    return getChatConsoleCopy(locale).sessionTitleDefault;
  }
  return normalized.slice(0, 36);
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
  const copy = useMemo(() => getChatConsoleCopy(locale), [locale]);
  const presets = copy.presets;
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
  const surfaceCopy = copy.surface;

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
        session.messages.length === 0 && session.title === copy.sessionTitleDefault
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
  }, [copy.errorPrefix, copy.sessionTitleDefault, draft, locale, messages, model, systemPrompt, updateActiveSession]);

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
    <section className="chat-surface">
      <section className={`panel-card page-header-card chat-page-header${serviceHealthy ? " page-header-card-ready" : ""}`}>
        <div className="page-header-shell">
          <div className="page-header-copy">
            <span className="console-section-kicker">{surfaceCopy.overviewKicker}</span>
            <span className="page-header-eyebrow">{surfaceCopy.overviewEyebrow}</span>
            <h3 className="panel-title">{copy.title}</h3>
            <p className="panel-subtitle">{copy.subtitle}</p>
          </div>

          <div className="page-header-actions panel-actions action-ribbon">
            <button type="button" className="btn btn-primary" onClick={handleCreateSession}>
              {copy.newSession}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleDeleteSession}>
              {copy.deleteSession}
            </button>
          </div>
        </div>

        <div className="page-header-meta">
          <div className="page-header-metric">
            <span className="page-header-metric-label">{surfaceCopy.sessionCount}</span>
            <strong className="page-header-metric-value">{sessions.length}</strong>
          </div>
          <div className="page-header-metric">
            <span className="page-header-metric-label">{surfaceCopy.messageCount}</span>
            <strong className="page-header-metric-value">{messages.length}</strong>
          </div>
          <div className="page-header-metric">
            <span className="page-header-metric-label">{surfaceCopy.draftState}</span>
            <strong className="page-header-metric-value">
              {draft.trim() ? surfaceCopy.draftReady : surfaceCopy.draftEmpty}
            </strong>
          </div>
        </div>

        <div className="page-header-support-grid">
          <div className="page-header-support-card">
            <div className="page-header-support-copy">
              <span className="page-header-support-label">{surfaceCopy.serviceTitle}</span>
              <p className="page-header-support-text">{surfaceCopy.serviceSubtitle}</p>
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
          </div>

          <div className={`summary-note ${serviceHealthy ? "summary-note-success" : "summary-note-neutral"} page-header-summary`}>
            <span className="summary-note-label">{copy.opsTitle}</span>
            <div className="summary-note-message">{serviceHealthy ? copy.opsHealthy : copy.opsAttention}</div>
          </div>
        </div>

        <div className="page-header-footer">
          <div className="panel-actions action-ribbon">
            <button type="button" className="btn btn-ghost" onClick={onOpenRuntime}>
              {copy.openRuntime}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onOpenDashboard}>
              {copy.openDashboard}
            </button>
          </div>

          {runtimeEndpoint ? <div className="chat-runtime-endpoint">{runtimeEndpoint}</div> : null}
        </div>
      </section>

      <section className="chat-console-shell">
        <div className="chat-sidebar-stack">
          <section className="panel-card chat-sidebar-card chat-history-card">
            <header className="panel-header">
              <div>
                <h3 className="panel-title">{copy.historyTitle}</h3>
                <p className="panel-subtitle">{copy.historySubtitle}</p>
              </div>
            </header>

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
                <h3 className="panel-title">{surfaceCopy.settingsTitle}</h3>
                <p className="panel-subtitle">{surfaceCopy.settingsSubtitle}</p>
              </div>
            </header>

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
        </div>

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
    </section>
  );
}
