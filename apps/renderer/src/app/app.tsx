import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import type { DashboardHealthDto, RuntimeHealthDto, RuntimeStatus } from "@ufren/shared";
import { ufrenBrand } from "@ufren/shared";

import {
  getAppCopy,
  getEmptyLabel,
  getPreferredLocale,
  getStatusLabel,
  persistLocale,
  type AppLocale
} from "./ui-copy.js";
import { ChatConsole } from "../features/chat-console.js";
import { DashboardConsole } from "../features/dashboard-console.js";
import { InstallerPanel, type InstallerPanelSnapshot } from "../features/installer-panel.js";
import { RuntimeControlPanel, type RuntimePanelSnapshot } from "../features/runtime-control-panel.js";

type AppTheme = "dark" | "light";
type AppView = "workspace" | "chat" | "dashboard" | "installer" | "runtime";
type OneClickState = "idle" | "running" | "success" | "error";

const themeStorageKey = "ufren.desktop.theme";

function getPreferredTheme(): AppTheme {
  const stored = localStorage.getItem(themeStorageKey);
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function readDesktopApi(): Window["ufrenDesktopApi"] | null {
  return typeof window.ufrenDesktopApi === "undefined" ? null : window.ufrenDesktopApi;
}

function requireDesktopApi(): Window["ufrenDesktopApi"] {
  const api = readDesktopApi();
  if (!api) {
    throw new Error("Desktop bridge unavailable. Please restart the Electron client after preload finishes building.");
  }
  return api;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getWorkspaceCopy(locale: AppLocale) {
  return locale === "zh"
    ? {
        title: "把安装、运行、管理台与 Chat 收敛到同一个成熟客户端里。",
        subtitle: "总览负责判断当前阶段，Dashboard 负责官方管理，Chat 负责日常对话，Installer / Runtime 负责底层运维。",
        nextTitle: "建议下一步",
        readyMessage: "运行时、健康探测与官方 dashboard 都已就绪，可以开始通过 Chat 或浏览器内管理台使用 Hermes。",
        installMessage: "先完成安装器工作流，确保 WSL、运行时文件和 Python 环境已经准备好。",
        runtimeMessage: "安装已经就绪，下一步建议启动 Hermes runtime 并等待健康检查通过。",
        dashboardMessage: "建议把官方 dashboard 一并拉起，方便管理账户、模型和环境配置。",
        headingQuick: "快捷入口",
        headingProgress: "系统阶段",
        openDashboard: "打开 Dashboard",
        openChat: "进入 Chat",
        openInstaller: "查看安装器",
        openRuntime: "查看运行时",
        bridgeReady: "桌面桥接已连接",
        bridgeMissing: "桌面桥接未连接",
        stageDone: "已完成",
        stagePending: "待处理",
        dashboard: "管理台",
        chat: "聊天",
        summary: "服务概览"
      }
    : {
        title: "Bring setup, runtime, dashboard, and chat into one mature desktop client.",
        subtitle: "Overview decides what needs attention, Dashboard handles official management, Chat handles daily conversation, and Installer / Runtime stay available for low-level operations.",
        nextTitle: "Recommended Next Step",
        readyMessage: "Runtime, health checks, and the official dashboard are ready. You can now use Hermes through Chat or the embedded admin console.",
        installMessage: "Complete the installer workflow first so WSL, runtime files, and the Python environment are ready.",
        runtimeMessage: "Installation is ready. The next move is to start Hermes runtime and wait for health checks to pass.",
        dashboardMessage: "Start the official dashboard too so account, model, and environment management stay available.",
        headingQuick: "Quick Access",
        headingProgress: "System Stages",
        openDashboard: "Open Dashboard",
        openChat: "Open Chat",
        openInstaller: "Open Installer",
        openRuntime: "Open Runtime",
        bridgeReady: "Desktop bridge connected",
        bridgeMissing: "Desktop bridge unavailable",
        stageDone: "Done",
        stagePending: "Pending",
        dashboard: "Dashboard",
        chat: "Chat",
        summary: "Service Summary"
      };
}

export function App(): JSX.Element {
  const [theme, setTheme] = useState<AppTheme>(() => getPreferredTheme());
  const [locale, setLocale] = useState<AppLocale>(() => getPreferredLocale());
  const [activeView, setActiveView] = useState<AppView>("workspace");
  const [installerSnapshot, setInstallerSnapshot] = useState<InstallerPanelSnapshot | null>(null);
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<RuntimePanelSnapshot | null>(null);
  const [overviewRuntimeStatus, setOverviewRuntimeStatus] = useState<RuntimeStatus>("not_installed");
  const [overviewRuntimeHealth, setOverviewRuntimeHealth] = useState<RuntimeHealthDto | null>(null);
  const [dashboardHealth, setDashboardHealth] = useState<DashboardHealthDto | null>(null);
  const [oneClickState, setOneClickState] = useState<OneClickState>("idle");
  const [oneClickMessage, setOneClickMessage] = useState("");

  const copy = useMemo(() => getAppCopy(locale), [locale]);
  const workspaceCopy = useMemo(() => getWorkspaceCopy(locale), [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  const toggleTheme = (): void => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  const toggleLocale = (): void => {
    setLocale((current) => {
      const next = current === "zh" ? "en" : "zh";
      persistLocale(next);
      return next;
    });
  };

  const navigate = (view: AppView): void => {
    setActiveView(view);
  };

  const desktopApiReady = readDesktopApi() !== null;
  const runtimeStatusSignal = runtimeSnapshot?.status ?? overviewRuntimeStatus;
  const runtimeHealthSignal = runtimeSnapshot?.health ?? overviewRuntimeHealth;
  const installerReady = installerSnapshot?.context.state === "ready";
  const runtimeRunning = runtimeStatusSignal === "running";
  const runtimeHealthy = runtimeHealthSignal?.status === "running";
  const dashboardReady = dashboardHealth?.status === "running";
  const runtimeEndpoint = runtimeHealthSignal?.endpoint ?? getEmptyLabel(locale);
  const dashboardUrl = dashboardHealth?.url ?? getEmptyLabel(locale);
  const completedSteps = [installerReady, runtimeHealthy, dashboardReady].filter(Boolean).length;
  const oneClickBusy = oneClickState === "running";
  const readinessLabel =
    completedSteps === 3 ? copy.flow.ready : copy.flow.stepsRemaining(3 - completedSteps);
  const oneClickTone =
    oneClickState === "error" ? "error" : oneClickState === "success" ? "success" : "neutral";
  const installerStatusText = getStatusLabel(installerSnapshot?.context.state ?? "loading", locale);
  const runtimeStatusText = getStatusLabel(runtimeStatusSignal ?? "loading", locale);
  const healthStatusText = getStatusLabel(runtimeHealthSignal?.status ?? "loading", locale);
  const dashboardStatusText = getStatusLabel(dashboardHealth?.status ?? "loading", locale);
  const summaryStatus = runtimeHealthy
    ? "running"
    : runtimeRunning
      ? "starting"
      : installerReady
        ? "ready"
        : "stopped";

  const navItems: { view: AppView; label: string; description: string; icon: string }[] = [
    { view: "workspace", label: copy.nav.workspace.label, description: copy.nav.workspace.description, icon: "OV" },
    { view: "chat", label: copy.nav.chat.label, description: copy.nav.chat.description, icon: "CH" },
    { view: "dashboard", label: copy.nav.dashboard.label, description: copy.nav.dashboard.description, icon: "DB" },
    { view: "installer", label: copy.nav.installer.label, description: copy.nav.installer.description, icon: "IN" },
    { view: "runtime", label: copy.nav.runtime.label, description: copy.nav.runtime.description, icon: "RT" }
  ];
  const activeNavItem = navItems.find((item) => item.view === activeView) ?? navItems[0];

  const statusCards = [
    {
      label: copy.statusCards.installer,
      value: installerStatusText,
      tone: installerReady ? "success" : installerSnapshot ? "warning" : "loading"
    },
    {
      label: copy.statusCards.runtime,
      value: runtimeStatusText,
      tone: runtimeRunning ? "success" : runtimeStatusSignal ? "warning" : "loading"
    },
    {
      label: copy.statusCards.health,
      value: healthStatusText,
      tone: runtimeHealthy ? "success" : runtimeHealthSignal ? "warning" : "loading"
    },
    {
      label: workspaceCopy.dashboard,
      value: dashboardStatusText,
      tone: dashboardReady ? "success" : dashboardHealth ? "warning" : "loading"
    },
    {
      label: copy.statusCards.endpoint,
      value: runtimeEndpoint,
      tone: runtimeHealthSignal?.endpoint ? "accent" : "neutral"
    }
  ] as const;

  const refreshSignals = useCallback(async () => {
    if (!desktopApiReady) {
      return;
    }
    try {
      const api = requireDesktopApi();
      const [runtimeStatus, runtimeHealth, nextDashboardHealth] = await Promise.all([
        api.runtimeStatus(),
        api.runtimeHealth(),
        api.dashboardHealth()
      ]);
      setOverviewRuntimeStatus(runtimeStatus);
      setOverviewRuntimeHealth(runtimeHealth);
      setDashboardHealth(nextDashboardHealth);
    } catch {
      // Keep the current UI snapshot if background refresh fails.
    }
  }, [desktopApiReady]);

  const workflowSteps = [
    {
      title: locale === "zh" ? "准备运行环境" : "Prepare Runtime Environment",
      status: installerReady,
      hint:
        locale === "zh"
          ? "确保 WSL、运行时脚本、虚拟环境和 Hermes 包都已准备完成。"
          : "Ensure WSL, runtime scripts, virtual environment, and Hermes packages are ready.",
      actionLabel: workspaceCopy.openInstaller,
      action: () => navigate("installer")
    },
    {
      title: locale === "zh" ? "启动 Hermes 服务" : "Start Hermes Service",
      status: runtimeHealthy,
      hint:
        locale === "zh"
          ? "启动 runtime，并用健康探测确认 API server 已可用。"
          : "Start runtime and use health checks to confirm the API server is available.",
      actionLabel: workspaceCopy.openRuntime,
      action: () => navigate("runtime")
    },
    {
      title: locale === "zh" ? "加载官方管理台" : "Load Official Dashboard",
      status: dashboardReady,
      hint:
        locale === "zh"
          ? "在桌面端内嵌 dashboard，统一管理模型、账号和环境配置。"
          : "Embed the official dashboard to manage models, accounts, and environment settings.",
      actionLabel: workspaceCopy.openDashboard,
      action: () => navigate("dashboard")
    }
  ] as const;

  const nextActionMessage = !desktopApiReady
    ? copy.preloadWarning
    : !installerReady
      ? workspaceCopy.installMessage
      : !runtimeHealthy
        ? workspaceCopy.runtimeMessage
        : !dashboardReady
          ? workspaceCopy.dashboardMessage
          : workspaceCopy.readyMessage;

  const runOneClickReadyFlow = async (): Promise<void> => {
    try {
      setOneClickState("running");
      setOneClickMessage(copy.flow.checkingInstaller);

      const api = requireDesktopApi();
      const installerStatus = await api.installerStatus();

      if (installerStatus.state !== "ready") {
        setOneClickMessage(copy.flow.installing);
        const installResult = await api.installerStart();
        if (!installResult.ok) {
          if (installResult.issue?.retryable) {
            setOneClickMessage(copy.flow.retrying);
            const retryResult = await api.installerRetry();
            if (!retryResult.ok) {
              throw new Error(retryResult.message);
            }
          } else {
            throw new Error(installResult.message);
          }
        }
      }

      setOneClickMessage(copy.flow.starting);
      const runtimeStatus = await api.runtimeStatus();
      if (runtimeStatus !== "running") {
        const startResult = await api.runtimeStart();
        if (!startResult.ok) {
          throw new Error(startResult.message);
        }
      }

      setOneClickMessage(copy.flow.checkingHealth);
      let endpoint = "";
      let lastDetail = "";
      for (let attempt = 0; attempt < 15; attempt += 1) {
        const health = await api.runtimeHealth();
        endpoint = health.endpoint;
        lastDetail = health.detail ?? "";
        if (health.status === "running") {
          break;
        }
        if (attempt === 14) {
          throw new Error(
            lastDetail ||
              (locale === "zh"
                ? "健康检查在重试窗口内未通过。"
                : "Health check did not pass within the retry window.")
          );
        }
        await wait(1000);
      }

      setOneClickMessage(
        locale === "zh" ? "正在启动官方 dashboard..." : "Starting official dashboard..."
      );
      const dashboardResult = await api.dashboardStart();
      if (!dashboardResult.ok) {
        throw new Error(dashboardResult.message);
      }

      const latestDashboardHealth = await api.dashboardHealth();
      setDashboardHealth(latestDashboardHealth);
      setOverviewRuntimeStatus("running");

      setOneClickState("success");
      setOneClickMessage(copy.flow.success(endpoint || runtimeEndpoint));
      navigate("workspace");
    } catch (error) {
      setOneClickState("error");
      setOneClickMessage(error instanceof Error ? error.message : copy.flow.failed);
    }
  };

  const handleWindowMinimize = async (): Promise<void> => {
    await requireDesktopApi().windowMinimize();
  };

  const handleWindowMaximizeToggle = async (): Promise<void> => {
    await requireDesktopApi().windowMaximizeToggle();
  };

  const handleWindowClose = async (): Promise<void> => {
    await requireDesktopApi().windowClose();
  };

  useEffect(() => {
    void refreshSignals();
  }, [refreshSignals]);

  useEffect(() => {
    if (!desktopApiReady) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void refreshSignals();
    }, 10000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [desktopApiReady, refreshSignals]);

  const renderWorkspace = (): JSX.Element => (
    <section className="workspace-dashboard">
      <section className="workspace-hero-card">
        <div className="workspace-hero-copy">
          <span className="console-section-kicker">{copy.desktopConsole}</span>
          <h1 className="workspace-hero-title">{workspaceCopy.title}</h1>
          <p className="workspace-hero-subtitle">{workspaceCopy.subtitle}</p>
        </div>

        <div className="workspace-hero-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!desktopApiReady || oneClickBusy}
            onClick={() => void runOneClickReadyFlow()}
          >
            {oneClickBusy ? copy.actions.oneClickBusy : copy.actions.oneClickReady}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate("chat")}>
            {workspaceCopy.openChat}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate("dashboard")}>
            {workspaceCopy.openDashboard}
          </button>
        </div>

        <div className={`summary-note summary-note-${oneClickTone}`}>
          <span className="summary-note-label">{workspaceCopy.nextTitle}</span>
          <div className="summary-note-message">{oneClickMessage || nextActionMessage}</div>
        </div>
      </section>

      <section className="status-card-grid status-card-grid-five">
        {statusCards.map((card) => (
          <div key={card.label} className={`status-card status-card-${card.tone}`}>
            <span className="status-card-label">{card.label}</span>
            <strong className="status-card-value">{card.value}</strong>
          </div>
        ))}
      </section>

      <section className="workspace-overview-grid">
        <article className="panel-card">
          <header className="panel-header">
            <div>
              <h3 className="panel-title">{workspaceCopy.headingProgress}</h3>
              <p className="panel-subtitle">{workspaceCopy.summary}</p>
            </div>
            <span className={`status-pill status-${summaryStatus}`}>{readinessLabel}</span>
          </header>

          <ol className="console-checklist">
            {workflowSteps.map((step, index) => (
              <li
                key={step.title}
                className={`console-checklist-item console-checklist-item-${step.status ? "completed" : "pending"}`}
              >
                <div className="console-checklist-index">{index + 1}</div>
                <div className="console-checklist-copy">
                  <div className="console-checklist-item-title">{step.title}</div>
                  <div className="console-checklist-item-hint">{step.hint}</div>
                </div>
                <button type="button" className="btn btn-ghost" onClick={step.action}>
                  {step.actionLabel}
                </button>
              </li>
            ))}
          </ol>
        </article>

        <article className="panel-card">
          <header className="panel-header">
            <div>
              <h3 className="panel-title">{workspaceCopy.headingQuick}</h3>
              <p className="panel-subtitle">
                {desktopApiReady ? workspaceCopy.bridgeReady : workspaceCopy.bridgeMissing}
              </p>
            </div>
          </header>

          <div className="quick-grid">
            <button type="button" className="quick-card" onClick={() => navigate("chat")}>
              <span className="quick-card-kicker">{workspaceCopy.chat}</span>
              <strong className="quick-card-title">{copy.nav.chat.description}</strong>
            </button>
            <button type="button" className="quick-card" onClick={() => navigate("dashboard")}>
              <span className="quick-card-kicker">{workspaceCopy.dashboard}</span>
              <strong className="quick-card-title">{dashboardUrl}</strong>
            </button>
            <button type="button" className="quick-card" onClick={() => navigate("installer")}>
              <span className="quick-card-kicker">{copy.nav.installer.label}</span>
              <strong className="quick-card-title">{installerStatusText}</strong>
            </button>
            <button type="button" className="quick-card" onClick={() => navigate("runtime")}>
              <span className="quick-card-kicker">{copy.nav.runtime.label}</span>
              <strong className="quick-card-title">{runtimeEndpoint}</strong>
            </button>
          </div>
        </article>
      </section>
    </section>
  );

  const renderActiveView = (): JSX.Element => {
    switch (activeView) {
      case "chat":
        return (
          <ChatConsole
            locale={locale}
            runtimeStatus={runtimeStatusSignal}
            runtimeEndpoint={runtimeHealthSignal?.endpoint}
            dashboardStatus={dashboardHealth?.status}
            onOpenRuntime={() => navigate("runtime")}
            onOpenDashboard={() => navigate("dashboard")}
          />
        );
      case "dashboard":
        return (
          <DashboardConsole
            locale={locale}
            initialHealth={dashboardHealth}
            onHealthChange={setDashboardHealth}
            runtimeStatus={runtimeStatusSignal}
            runtimeEndpoint={runtimeHealthSignal?.endpoint}
            onOpenRuntime={() => navigate("runtime")}
          />
        );
      case "installer":
        return <InstallerPanel locale={locale} onSnapshotChange={setInstallerSnapshot} />;
      case "runtime":
        return <RuntimeControlPanel locale={locale} onSnapshotChange={setRuntimeSnapshot} />;
      case "workspace":
      default:
        return renderWorkspace();
    }
  };

  return (
    <div className="desktop-stage">
      <section className="app-window app-window-shell">
        <header className="window-caption">
          <div className="window-caption-brand">
            <div className="window-caption-icon">H</div>
            <span className="window-caption-title">{ufrenBrand.productName}</span>
            <span className="window-caption-subtitle">{copy.windowSubtitle}</span>
          </div>
          <div className="window-controls">
            <button
              type="button"
              className="window-control"
              onClick={() => void handleWindowMinimize()}
              title="Minimize"
              aria-label="Minimize window"
            >
              <svg width="12" height="12" viewBox="0 0 12 12">
                <rect x="2" y="5.5" width="8" height="1" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className="window-control"
              onClick={() => void handleWindowMaximizeToggle()}
              title="Maximize or restore"
              aria-label="Maximize or restore window"
            >
              <svg width="12" height="12" viewBox="0 0 12 12">
                <rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
            <button
              type="button"
              className="window-control window-control-close"
              onClick={() => void handleWindowClose()}
              title="Close"
              aria-label="Close window"
            >
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <main className="desktop-layout">
          <aside className="desktop-sidebar">
            <div className="sidebar-shell">
              <div className="sidebar-panel">
                <div className="brand-block brand-block-card">
                  <div className="brand-logo">H</div>
                  <div className="nav-item-copy">
                    <h1 className="brand-title">{ufrenBrand.productName}</h1>
                    <p className="brand-subtitle">{copy.windowSubtitle}</p>
                  </div>
                </div>

                <div className="sidebar-section">
                  <div className="sidebar-section-head">
                    <span className="sidebar-section-kicker">{copy.desktopConsole}</span>
                    <strong className="sidebar-section-title">{activeNavItem.label}</strong>
                    <span className="sidebar-section-caption">{activeNavItem.description}</span>
                  </div>

                  <nav className="desktop-nav">
                    {navItems.map((item) => (
                      <button
                        key={item.view}
                        type="button"
                        className={`nav-item${activeView === item.view ? " nav-item-active" : ""}`}
                        onClick={() => navigate(item.view)}
                      >
                        <span className="nav-item-icon">{item.icon}</span>
                        <div className="nav-item-copy">
                          <span className="nav-item-label">{item.label}</span>
                          <span className="nav-item-description">{item.description}</span>
                        </div>
                      </button>
                    ))}
                  </nav>
                </div>

                <div className="sidebar-status-card">
                  <div className="sidebar-status-head">
                    <span className="sidebar-status-kicker">{workspaceCopy.summary}</span>
                    <strong className="sidebar-status-title">{readinessLabel}</strong>
                  </div>
                  <div className="sidebar-status-list">
                    <div className="sidebar-status-item">
                      <span className="sidebar-status-label">{copy.statusCards.runtime}</span>
                      <strong className="sidebar-status-value">{runtimeStatusText}</strong>
                    </div>
                    <div className="sidebar-status-item">
                      <span className="sidebar-status-label">{workspaceCopy.dashboard}</span>
                      <strong className="sidebar-status-value">{dashboardStatusText}</strong>
                    </div>
                    <div className="sidebar-status-item">
                      <span className="sidebar-status-label">{copy.statusCards.installer}</span>
                      <strong className="sidebar-status-value">{installerStatusText}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sidebar-preferences">
                <div className="sidebar-preference-row">
                  <span className="sidebar-preference-label">{copy.localeLabel}</span>
                  <button type="button" className="sidebar-toggle" onClick={toggleLocale}>
                    {locale === "zh" ? copy.actions.english : copy.actions.chinese}
                  </button>
                </div>
                <div className="sidebar-preference-row">
                  <span className="sidebar-preference-label">{copy.themeLabel}</span>
                  <button type="button" className="sidebar-toggle" onClick={toggleTheme}>
                    {theme === "dark" ? copy.actions.light : copy.actions.dark}
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <section className="console-shell">
            <header className="console-frame-header">
              <div className="console-frame-copy">
                <span className="console-frame-kicker">{copy.desktopConsole}</span>
                <h2 className="console-frame-title">{activeNavItem.label}</h2>
                <p className="console-frame-subtitle">{activeNavItem.description}</p>
              </div>
              <div className="console-frame-status">
                <span className={`topbar-chip topbar-chip-${runtimeHealthy ? "online" : runtimeRunning ? "warming" : "offline"}`}>
                  <span className={`status-beacon status-beacon-${runtimeHealthy ? "online" : runtimeRunning ? "warming" : "offline"}`} />
                  {copy.statusCards.runtime}: {runtimeStatusText}
                </span>
                <span className={`topbar-chip topbar-chip-${dashboardReady ? "online" : "standby"}`}>
                  <span className={`status-beacon status-beacon-${dashboardReady ? "online" : "standby"}`} />
                  {workspaceCopy.dashboard}: {dashboardStatusText}
                </span>
              </div>
            </header>

            <div className="console-scroll-region">
              {!desktopApiReady ? (
                <div className="feedback feedback-error app-warning-banner">{copy.preloadWarning}</div>
              ) : null}
              {renderActiveView()}
            </div>
          </section>
        </main>
      </section>
    </div>
  );
}
