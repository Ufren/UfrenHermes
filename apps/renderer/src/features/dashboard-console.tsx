import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import type { DashboardHealthDto } from "@ufren/shared";

import { getStatusLabel, type AppLocale } from "../app/ui-copy.js";

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

  const copy = useMemo(
    () =>
      locale === "zh"
        ? {
            title: "Hermes Dashboard",
            subtitle: "在桌面端内嵌官方管理页，直接使用 Hermes 原生 dashboard。",
            frameTitle: "官方管理台",
            frameHint: "支持账号、模型、环境变量和 Hermes 配置管理。",
            urlLabel: "Dashboard 地址",
            detailLabel: "状态说明",
            runtimeTitle: "运行时联动",
            runtimeHint: "把 dashboard 管理能力和 Hermes runtime 健康状态放在同一视角中。",
            runtimeStatusLabel: "Runtime 状态",
            runtimeEndpointLabel: "Runtime 地址",
            runtimeAction: "前往 Runtime",
            refresh: "刷新状态",
            start: "启动 Dashboard",
            stop: "停止 Dashboard",
            open: "浏览器打开",
            loading: "正在获取 dashboard 状态...",
            emptyTitle: "Dashboard 尚未运行",
            emptyHint: "先启动 dashboard，再在桌面端内打开官方管理页。"
          }
        : {
            title: "Hermes Dashboard",
            subtitle: "Embed the official management UI directly inside the desktop client.",
            frameTitle: "Official Console",
            frameHint: "Manage accounts, models, environment variables, and Hermes settings.",
            urlLabel: "Dashboard URL",
            detailLabel: "Status Detail",
            runtimeTitle: "Runtime Linkage",
            runtimeHint: "Keep dashboard controls and Hermes runtime health in the same operational view.",
            runtimeStatusLabel: "Runtime Status",
            runtimeEndpointLabel: "Runtime Endpoint",
            runtimeAction: "Open Runtime",
            refresh: "Refresh Status",
            start: "Start Dashboard",
            stop: "Stop Dashboard",
            open: "Open In Browser",
            loading: "Loading dashboard status...",
            emptyTitle: "Dashboard is not running",
            emptyHint: "Start the dashboard first, then open the official UI inside the desktop app."
          },
    [locale]
  );

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
      setErrorText(error instanceof Error ? error.message : "Failed to load dashboard status");
    }
  }, [onHealthChange]);

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
      setErrorText(error instanceof Error ? error.message : "Failed to start dashboard");
    }
  }, [refresh]);

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
      setErrorText(error instanceof Error ? error.message : "Failed to stop dashboard");
    }
  }, [refresh]);

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
    <section className="panel-card dashboard-console-shell">
      <header className="panel-header">
        <div>
          <h3 className="panel-title">{copy.title}</h3>
          <p className="panel-subtitle">{copy.subtitle}</p>
        </div>
        <span className={`status-pill status-${health?.status ?? "starting"}`}>
          {getStatusLabel(health?.status ?? "loading", locale)}
        </span>
      </header>

      <section className="content-frame">
        <div className="content-frame-header">
          <div className="content-frame-title">{copy.frameTitle}</div>
          <div className="content-frame-caption">{copy.frameHint}</div>
        </div>
        <section className="kv-grid">
          <div className="kv-item">
            <span className="kv-label">{copy.urlLabel}</span>
            <span className="kv-value">{health?.url ?? copy.loading}</span>
          </div>
          <div className="kv-item kv-item-wide">
            <span className="kv-label">{copy.detailLabel}</span>
            <span className="kv-value">{health?.detail ?? copy.loading}</span>
          </div>
        </section>
      </section>

      <section className="content-frame content-frame-muted">
        <div className="content-frame-header">
          <div className="content-frame-title">{copy.runtimeTitle}</div>
          <div className="content-frame-caption">{copy.runtimeHint}</div>
        </div>
        <section className="kv-grid">
          <div className="kv-item">
            <span className="kv-label">{copy.runtimeStatusLabel}</span>
            <span className="kv-value">{runtimeStatus ? getStatusLabel(runtimeStatus, locale) : copy.loading}</span>
          </div>
          <div className="kv-item kv-item-wide">
            <span className="kv-label">{copy.runtimeEndpointLabel}</span>
            <span className="kv-value">{runtimeEndpoint ?? copy.loading}</span>
          </div>
        </section>
        <div className="panel-actions action-ribbon">
          <button type="button" className="btn btn-ghost" onClick={onOpenRuntime}>
            {copy.runtimeAction}
          </button>
        </div>
      </section>

      <div className="panel-actions action-ribbon">
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

      {message ? <div className="feedback feedback-success">{message}</div> : null}
      {errorText ? <div className="feedback feedback-error">{errorText}</div> : null}

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
  );
}
