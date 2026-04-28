import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import type { DashboardHealthDto } from "@ufren/shared";

import { getDashboardCopy, getStatusLabel, type AppLocale } from "../app/i18n/index.js";

type ActionState = "idle" | "loading" | "error";

export interface DashboardConsoleProps {
  locale: AppLocale;
  initialHealth?: DashboardHealthDto | null;
  onHealthChange?: (health: DashboardHealthDto) => void;
  runtimeStatus?: string;
  runtimeEndpoint?: string;
  onOpenRuntime?: () => void;
}

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

export function DashboardConsole({
  locale,
  initialHealth = null,
  onHealthChange,
  runtimeStatus,
  runtimeEndpoint,
  onOpenRuntime
}: DashboardConsoleProps): JSX.Element {
  const [health, setHealth] = useState<DashboardHealthDto | null>(initialHealth);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [message, setMessage] = useState("");
  const [errorText, setErrorText] = useState("");
  const isBusy = actionState === "loading";

  const copy = useMemo(() => getDashboardCopy(locale), [locale]);
  const surfaceCopy = copy.surface;
  const dashboardStatusLabel = getStatusLabel(health?.status ?? "loading", locale);
  const runtimeStatusLabel = runtimeStatus ? getStatusLabel(runtimeStatus, locale) : copy.loading;

  const refresh = useCallback(async () => {
    try {
      setActionState("loading");
      setErrorText("");
      const nextHealth = await requireDesktopApi().dashboardHealth();
      setHealth(nextHealth);
      onHealthChange?.(nextHealth);
      setActionState("idle");
    } catch (error) {
      setActionState("error");
      setErrorText(error instanceof Error ? error.message : copy.fallbackError);
    }
  }, [copy.fallbackError, onHealthChange]);

  const handleStart = useCallback(async () => {
    try {
      setActionState("loading");
      setErrorText("");
      setMessage("");
      const result = await requireDesktopApi().dashboardStart();
      setMessage(result.message);
      await refresh();
    } catch (error) {
      setActionState("error");
      setErrorText(error instanceof Error ? error.message : copy.startFailed);
    }
  }, [copy.startFailed, refresh]);

  const handleStop = useCallback(async () => {
    try {
      setActionState("loading");
      setErrorText("");
      setMessage("");
      const result = await requireDesktopApi().dashboardStop();
      setMessage(result.message);
      await refresh();
    } catch (error) {
      setActionState("error");
      setErrorText(error instanceof Error ? error.message : copy.stopFailed);
    }
  }, [copy.stopFailed, refresh]);

  const handleOpenExternal = useCallback(async () => {
    if (!health?.url) {
      return;
    }
    await requireDesktopApi().openExternal(health.url);
  }, [health?.url]);

  useEffect(() => {
    if (!health) {
      void refresh();
    }
  }, [health, refresh]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh();
    }, 8000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return (
    <section className="dashboard-surface">
      <section className="panel-card page-header-card dashboard-page-header">
        <div className="page-header-shell">
          <div className="page-header-copy">
            <span className="console-section-kicker">{surfaceCopy.overviewKicker}</span>
            <span className="page-header-eyebrow">{surfaceCopy.overviewEyebrow}</span>
            <h3 className="panel-title">{copy.title}</h3>
            <p className="panel-subtitle">{copy.subtitle}</p>
          </div>

          <div className="page-header-actions panel-actions action-ribbon">
            <button type="button" className="btn btn-primary" disabled={isBusy} onClick={() => void handleStart()}>
              {copy.start}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isBusy || !health || health.status === "stopped"}
              onClick={() => void handleStop()}
            >
              {copy.stop}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isBusy || !health?.url}
              onClick={() => void handleOpenExternal()}
            >
              {copy.open}
            </button>
            <button type="button" className="btn btn-ghost" disabled={isBusy} onClick={() => void refresh()}>
              {copy.refresh}
            </button>
          </div>
        </div>

        {message ? (
          <div className="feedback feedback-success">{message}</div>
        ) : errorText ? (
          <div className="feedback feedback-error">{errorText}</div>
        ) : (
          <div className="summary-note summary-note-neutral page-header-summary">
            <span className="summary-note-label">{surfaceCopy.liveStatus}</span>
            <div className="summary-note-message">{health?.detail ?? copy.emptyHint}</div>
          </div>
        )}

        <div className="page-header-meta">
          <div className="page-header-metric">
            <span className="page-header-metric-label">{surfaceCopy.liveStatus}</span>
            <strong className="page-header-metric-value">{dashboardStatusLabel}</strong>
          </div>
          <div className="page-header-metric">
            <span className="page-header-metric-label">{surfaceCopy.destination}</span>
            <strong className="page-header-metric-value">{health?.url ?? copy.loading}</strong>
          </div>
          <div className="page-header-metric">
            <span className="page-header-metric-label">{copy.detailLabel}</span>
            <strong className="page-header-metric-value">{health?.detail ?? copy.loading}</strong>
          </div>
        </div>

        <div className="page-header-support-grid">
          <div className="page-header-support-card">
            <div className="page-header-support-copy">
              <span className="page-header-support-label">{surfaceCopy.runtimeOverviewTitle}</span>
              <p className="page-header-support-text">{surfaceCopy.runtimeOverviewSubtitle}</p>
            </div>

            <div className="panel-actions action-ribbon">
              <button type="button" className="btn btn-ghost" onClick={onOpenRuntime}>
                {copy.runtimeAction}
              </button>
            </div>
          </div>

          <section className="kv-grid page-header-kv-grid">
            <div className="kv-item">
              <span className="kv-label">{copy.runtimeStatusLabel}</span>
              <span className="kv-value">{runtimeStatusLabel}</span>
            </div>
            <div className="kv-item kv-item-wide">
              <span className="kv-label">{copy.runtimeEndpointLabel}</span>
              <span className="kv-value">{runtimeEndpoint ?? copy.loading}</span>
            </div>
          </section>
        </div>
      </section>

      <section className="panel-card dashboard-frame-card">
        <header className="panel-header">
          <div>
            <h3 className="panel-title">{copy.frameTitle}</h3>
            <p className="panel-subtitle">{copy.frameHint}</p>
          </div>
          <span className={`status-pill status-${health?.status ?? "starting"}`}>{dashboardStatusLabel}</span>
        </header>

        {health?.status === "running" ? (
          <div className="dashboard-frame-wrap">
            <iframe
              className="dashboard-frame"
              src={health.url}
              title="Hermes Dashboard"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="empty-state dashboard-empty-state">
            <strong className="state-title">{copy.emptyTitle}</strong>
            <span className="state-muted">{copy.emptyHint}</span>
          </div>
        )}
      </section>
    </section>
  );
}
