import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import type { DashboardHealthDto, RuntimeHealthDto, RuntimeStatus } from "@ufren/shared";
import { ufrenBrand } from "@ufren/shared";

import {
  getAppCopy,
  getEmptyLabel,
  getPreferredLocale,
  getStatusLabel,
  getWorkspaceCopy,
  persistLocale,
  type AppLocale
} from "./i18n/index.js";
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
  const progressValue = `${completedSteps}/3`;

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
      title: workspaceCopy.steps.prepareTitle,
      status: installerReady,
      hint: workspaceCopy.steps.prepareHint,
      actionLabel: workspaceCopy.openInstaller,
      action: () => navigate("installer")
    },
    {
      title: workspaceCopy.steps.runtimeTitle,
      status: runtimeHealthy,
      hint: workspaceCopy.steps.runtimeHint,
      actionLabel: workspaceCopy.openRuntime,
      action: () => navigate("runtime")
    },
    {
      title: workspaceCopy.steps.dashboardTitle,
      status: dashboardReady,
      hint: workspaceCopy.steps.dashboardHint,
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

  const workspaceQuickCards = [
    {
      kicker: workspaceCopy.chat,
      title: copy.nav.chat.label,
      description: copy.nav.chat.description,
      value: runtimeHealthy ? runtimeEndpoint : runtimeStatusText,
      action: () => navigate("chat")
    },
    {
      kicker: workspaceCopy.dashboard,
      title: copy.nav.dashboard.label,
      description: copy.nav.dashboard.description,
      value: dashboardUrl,
      action: () => navigate("dashboard")
    },
    {
      kicker: copy.nav.installer.label,
      title: installerStatusText,
      description: copy.nav.installer.description,
      value: installerReady ? workspaceCopy.stageDone : workspaceCopy.stagePending,
      action: () => navigate("installer")
    },
    {
      kicker: copy.nav.runtime.label,
      title: runtimeStatusText,
      description: copy.nav.runtime.description,
      value: runtimeEndpoint,
      action: () => navigate("runtime")
    }
  ] as const;

  const homeMetrics = [
    {
      label: workspaceCopy.progressLabel,
      value: progressValue
    },
    {
      label: workspaceCopy.endpointLabel,
      value: runtimeEndpoint
    },
    {
      label: workspaceCopy.dashboard,
      value: dashboardUrl
    }
  ] as const;

  const sidebarSummaryItems = [
    {
      label: workspaceCopy.bridgeLabel,
      value: desktopApiReady ? workspaceCopy.bridgeReady : workspaceCopy.bridgeMissing
    },
    {
      label: copy.statusCards.runtime,
      value: runtimeStatusText
    },
    {
      label: workspaceCopy.dashboard,
      value: dashboardStatusText
    }
  ] as const;

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
            lastDetail || workspaceCopy.oneClick.healthTimeout
          );
        }
        await wait(1000);
      }

      setOneClickMessage(workspaceCopy.oneClick.dashboardStarting);
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
      <section className="workspace-home-grid">
        <article className="panel-card workspace-home-card">
          <div className="workspace-home-copy">
            <span className="console-section-kicker">{workspaceCopy.showcaseLabel}</span>
            <span className="workspace-home-eyebrow">{workspaceCopy.showcaseEyebrow}</span>
            <h1 className="workspace-home-title">{workspaceCopy.title}</h1>
            <p className="workspace-home-subtitle">{workspaceCopy.subtitle}</p>
          </div>

          <div className="workspace-home-actions">
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
            <button type="button" className="btn btn-ghost" onClick={() => navigate("dashboard")}>
              {workspaceCopy.openDashboard}
            </button>
          </div>

          <div className="workspace-home-metrics">
            {homeMetrics.map((metric) => (
              <div key={metric.label} className="workspace-home-metric">
                <span className="workspace-home-metric-label">{metric.label}</span>
                <strong className="workspace-home-metric-value">{metric.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <aside className="panel-card workspace-next-card">
          <header className="panel-header">
            <div>
              <span className="console-section-kicker">{workspaceCopy.nextTitle}</span>
              <h3 className="panel-title">{readinessLabel}</h3>
              <p className="panel-subtitle">{workspaceCopy.spotlightSubtitle}</p>
            </div>
            <span className={`status-pill status-${summaryStatus}`}>{workspaceCopy.stageLabel}</span>
          </header>

          <div className={`summary-note summary-note-${oneClickTone}`}>
            <span className="summary-note-label">{workspaceCopy.nextTitle}</span>
            <div className="summary-note-message">{oneClickMessage || nextActionMessage}</div>
          </div>

          <div className="workspace-health-list">
            {statusCards.map((card) => (
              <div key={card.label} className="workspace-health-item">
                <span className="workspace-health-label">{card.label}</span>
                <strong className={`workspace-health-value workspace-health-value-${card.tone}`}>{card.value}</strong>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="workspace-home-grid workspace-home-grid-secondary">
        <article className="panel-card workspace-story-card">
          <header className="panel-header">
            <div>
              <h3 className="panel-title">{workspaceCopy.storyTitle}</h3>
              <p className="panel-subtitle">{workspaceCopy.storySubtitle}</p>
            </div>
            <span className={`status-pill status-${summaryStatus}`}>{readinessLabel}</span>
          </header>

          <ol className="workspace-stage-list">
            {workflowSteps.map((step, index) => (
              <li
                key={step.title}
                className={`workspace-stage-item workspace-stage-item-${step.status ? "completed" : "pending"}`}
              >
                <div className="workspace-stage-index">{index + 1}</div>
                <div className="workspace-stage-copy">
                  <div className="workspace-stage-title-row">
                    <div className="workspace-stage-title">{step.title}</div>
                    <span className={`status-pill status-${step.status ? "ready" : "starting"}`}>
                      {step.status ? workspaceCopy.stageDone : workspaceCopy.stagePending}
                    </span>
                  </div>
                  <div className="workspace-stage-hint">{step.hint}</div>
                </div>
                <button type="button" className="btn btn-ghost" onClick={step.action}>
                  {step.actionLabel}
                </button>
              </li>
            ))}
          </ol>
        </article>

        <article className="panel-card workspace-surfaces-card">
          <header className="panel-header">
            <div>
              <h3 className="panel-title">{workspaceCopy.surfacesTitle}</h3>
              <p className="panel-subtitle">{workspaceCopy.surfacesSubtitle}</p>
            </div>
          </header>

          <div className="workspace-surface-grid">
            {workspaceQuickCards.map((card) => (
              <button key={card.kicker} type="button" className="quick-card" onClick={card.action}>
                <span className="quick-card-kicker">{card.kicker}</span>
                <strong className="quick-card-title">{card.title}</strong>
                <span className="quick-card-description">{card.description}</span>
                <span className="quick-card-value">{card.value}</span>
              </button>
            ))}
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
                  <div className={`summary-note summary-note-${oneClickTone} sidebar-status-note`}>
                    <span className="summary-note-label">{workspaceCopy.nextTitle}</span>
                    <div className="summary-note-message">{oneClickMessage || nextActionMessage}</div>
                  </div>
                  <div className="sidebar-status-list">
                    {sidebarSummaryItems.map((item) => (
                      <div key={item.label} className="sidebar-status-item">
                        <span className="sidebar-status-label">{item.label}</span>
                        <strong className="sidebar-status-value">{item.value}</strong>
                      </div>
                    ))}
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
                  {readinessLabel}
                </span>
                <span className="console-frame-meta">
                  {desktopApiReady ? workspaceCopy.bridgeReady : workspaceCopy.bridgeMissing}
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
