import { useCallback, useEffect, useMemo, useState, type CSSProperties, type JSX } from "react";

import type { RuntimeHealthDto, RuntimeProbeResponseDto, RuntimeStatus } from "@ufren/shared";
import { ufrenBrand } from "@ufren/shared";
import { getEmptyLabel, getRuntimeCopy, getStatusLabel, type AppLocale } from "../app/ui-copy.js";

type ActionState = "idle" | "loading" | "error";

export interface RuntimePanelSnapshot {
  status: RuntimeStatus;
  health: RuntimeHealthDto | null;
  logs: string;
  actionState: ActionState;
  errorText: string;
}

export interface RuntimeControlPanelProps {
  locale: AppLocale;
  onSnapshotChange?: (snapshot: RuntimePanelSnapshot) => void;
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

export function RuntimeControlPanel({ locale, onSnapshotChange }: RuntimeControlPanelProps): JSX.Element {
  const [status, setStatus] = useState<RuntimeStatus>("not_installed");
  const [health, setHealth] = useState<RuntimeHealthDto | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [errorText, setErrorText] = useState("");
  const [message, setMessage] = useState("");
  const [probePath, setProbePath] = useState("/health");
  const [probeResult, setProbeResult] = useState<RuntimeProbeResponseDto | null>(null);
  const [probeState, setProbeState] = useState<ActionState>("idle");
  const [probeError, setProbeError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  const copy = useMemo(() => getRuntimeCopy(locale), [locale]);
  const isBusy = useMemo(() => actionState === "loading", [actionState]);
  const canStart = useMemo(() => !isBusy && status !== "running" && status !== "starting", [isBusy, status]);
  const canStop = useMemo(() => !isBusy && status === "running", [isBusy, status]);
  const runtimeSignalTone = health?.status === "running" ? "online" : status === "running" ? "warming" : "offline";
  const logLineCount = useMemo(() => logs.split(/\r?\n/).filter(Boolean).length, [logs]);
  const runtimeSignalBars = [
    {
      label: copy.probeLabels.lifecycle,
      value: status === "running" ? 90 : status === "starting" ? 60 : 22,
      tone: status === "running" ? "success" : status === "starting" ? "warning" : "neutral"
    },
    {
      label: copy.probeLabels.health,
      value: health?.status === "running" ? 96 : health ? 48 : 20,
      tone: health?.status === "running" ? "success" : health ? "warning" : "neutral"
    },
    {
      label: copy.probeLabels.probe,
      value: probeResult?.ok ? 88 : probeResult ? 38 : 18,
      tone: probeResult?.ok ? "accent" : probeResult ? "warning" : "neutral"
    },
    {
      label: copy.probeLabels.logs,
      value: Math.min(96, Math.max(logLineCount > 0 ? 28 : 14, logLineCount * 2)),
      tone: logLineCount > 0 ? "accent" : "neutral"
    }
  ] as const;

  const refresh = useCallback(async (preserveMessage = false) => {
    try {
      setActionState("loading");
      setErrorText("");
      if (!preserveMessage) {
        setMessage("");
      }
      const api = requireDesktopApi();
      const nextHealth = await api.runtimeHealth();
      const nextLogs = await api.runtimeLogs({ lines: 200 });

      setStatus(nextHealth.status);
      setHealth(nextHealth);
      setLogs(nextLogs);
      setActionState("idle");
    } catch (error) {
      setActionState("error");
      setErrorText(error instanceof Error ? error.message : copy.fallbackError(ufrenBrand.productName));
    } finally {
      setHasLoaded(true);
    }
  }, [copy]);

  const handleOpenEndpoint = useCallback(async () => {
    if (!health?.endpoint) return;
    try {
      const api = requireDesktopApi();
      await api.openExternal(health.endpoint);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to open runtime endpoint");
    }
  }, [health?.endpoint]);

  const handleStart = useCallback(async () => {
    try {
      setActionState("loading");
      setErrorText("");
      setMessage("");
      const result = await requireDesktopApi().runtimeStart();
      setMessage(result.message);
      if (!result.ok) {
        throw new Error(result.message);
      }
      await refresh(true);
    } catch (error) {
      setActionState("error");
      setMessage("");
      setErrorText(error instanceof Error ? error.message : copy.startFailed(ufrenBrand.productName));
    }
  }, [copy, refresh]);

  const handleStop = useCallback(async () => {
    try {
      setActionState("loading");
      setErrorText("");
      setMessage("");
      const result = await requireDesktopApi().runtimeStop();
      setMessage(result.message);
      if (!result.ok) {
        throw new Error(result.message);
      }
      await refresh(true);
    } catch (error) {
      setActionState("error");
      setMessage("");
      setErrorText(error instanceof Error ? error.message : copy.stopFailed(ufrenBrand.productName));
    }
  }, [copy, refresh]);

  const handleProbe = useCallback(async () => {
    try {
      setProbeState("loading");
      setProbeError("");
      const result = await requireDesktopApi().runtimeProbe({
        path: probePath,
        timeoutMs: 5000
      });
      setProbeResult(result);
      setProbeState(result.ok ? "idle" : "error");
      if (!result.ok && result.error) {
        setProbeError(result.error);
      }
    } catch (error) {
      setProbeState("error");
      setProbeError(error instanceof Error ? error.message : copy.probeFailed);
    }
  }, [copy, probePath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    onSnapshotChange?.({
      status,
      health,
      logs,
      actionState,
      errorText
    });
  }, [actionState, errorText, health, logs, onSnapshotChange, status]);

  if (!hasLoaded && actionState === "loading") {
    return (
      <section className="panel-card">
        <header className="panel-header">
          <div>
            <h3 className="panel-title">{copy.title}</h3>
            <p className="panel-subtitle">{copy.loadingSubtitle}</p>
          </div>
          <span className="status-pill status-starting">{getStatusLabel("loading", locale)}</span>
        </header>
        <div className="state-shell">
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line-medium" />
          <div className="skeleton-line skeleton-line-short" />
        </div>
      </section>
    );
  }

  return (
    <section className="panel-card">
      <header className="panel-header">
        <div>
            <h3 className="panel-title">{copy.title}</h3>
            <p className="panel-subtitle">{copy.subtitle}</p>
        </div>
        <span className={`status-pill status-${status}`}>{getStatusLabel(status, locale)}</span>
      </header>

      <section className="panel-banner panel-banner-runtime">
        <div className="panel-banner-copy">
          <span className="panel-banner-kicker">{copy.bannerKicker}</span>
          <strong className="panel-banner-title">{copy.bannerTitle}</strong>
        </div>
        <div className="panel-banner-metrics">
          <div className="panel-banner-metric">
            <span className="panel-banner-metric-label">{copy.metrics.status}</span>
            <strong className="panel-banner-metric-value">{getStatusLabel(status, locale)}</strong>
          </div>
          <div className="panel-banner-metric">
            <span className="panel-banner-metric-label">{copy.metrics.health}</span>
            <strong className="panel-banner-metric-value">
              {health?.status ? getStatusLabel(health.status, locale) : getEmptyLabel(locale)}
            </strong>
          </div>
          <div className="panel-banner-metric">
            <span className="panel-banner-metric-label">{copy.metrics.probePath}</span>
            <strong className="panel-banner-metric-value">{probePath}</strong>
          </div>
        </div>
      </section>

      <section className="content-frame">
        <div className="content-frame-header">
          <div className="content-frame-title">{copy.snapshotTitle}</div>
          <div className="content-frame-caption">{copy.snapshotCaption}</div>
        </div>
        <section className="kv-grid">
          <div className="kv-item">
            <span className="kv-label">{copy.fields.endpoint}</span>
            <span className="kv-value">{health?.endpoint ?? getEmptyLabel(locale)}</span>
          </div>
          <div className="kv-item">
            <span className="kv-label">{copy.fields.lastCheck}</span>
            <span className="kv-value">{health?.lastCheckedAt ?? getEmptyLabel(locale)}</span>
          </div>
          <div className="kv-item kv-item-wide">
            <span className="kv-label">{copy.fields.healthDetail}</span>
            <span className="kv-value">{health?.detail ?? getEmptyLabel(locale)}</span>
          </div>
        </section>
      </section>

      <section className="content-frame content-frame-muted">
        <div className="content-frame-header">
          <div className="content-frame-title">{copy.telemetryTitle}</div>
          <div className="content-frame-caption">{copy.telemetryCaption}</div>
        </div>
        <div className="runtime-telemetry-grid">
          <div className={`runtime-pulse-card runtime-pulse-card-${runtimeSignalTone}`}>
            <div className="runtime-pulse-head">
              <span className={`status-beacon status-beacon-${runtimeSignalTone}`} />
              <strong className="runtime-pulse-title">{copy.telemetrySignal}</strong>
            </div>
            <div className="runtime-pulse-value">{health?.status ? getStatusLabel(health.status, locale) : getStatusLabel(status, locale)}</div>
            <div className="runtime-pulse-caption">
              {health?.detail ?? copy.pulseFallback(getStatusLabel(status, locale))}
            </div>
          </div>
          <div className="runtime-monitor-card">
            <div className="runtime-monitor-head">
              <span className="runtime-monitor-label">{copy.telemetryActivity}</span>
              <span className="runtime-monitor-value">
                {probeResult ? `${probeResult.durationMs}ms` : copy.logLines(logLineCount)}
              </span>
            </div>
            <div className="runtime-monitor-bars" aria-hidden="true">
              {runtimeSignalBars.map((bar) => (
                <span
                  key={bar.label}
                  className={`runtime-monitor-bar runtime-monitor-bar-${bar.tone}`}
                  style={{ "--bar-height": `${bar.value}%` } as CSSProperties}
                />
              ))}
            </div>
            <div className="runtime-monitor-legend">
              {runtimeSignalBars.map((bar) => (
                <div key={bar.label} className="runtime-monitor-legend-item">
                  <span className={`hero-wave-dot hero-wave-dot-${bar.tone}`} />
                  <span>{bar.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="panel-actions action-ribbon">
        <button type="button" disabled={!canStart} onClick={() => void handleStart()} className="btn btn-primary">
          {copy.buttons.start}
        </button>
        <button type="button" disabled={!canStop} onClick={() => void handleStop()} className="btn btn-secondary">
          {copy.buttons.stop}
        </button>
        {health?.status === "running" && health?.endpoint && (
          <button type="button" onClick={() => void handleOpenEndpoint()} className="btn btn-secondary">
            {locale === "zh" ? "打开健康地址" : "Open Health Endpoint"}
          </button>
        )}
        <button type="button" disabled={isBusy} onClick={() => void refresh()} className="btn btn-ghost">
          {copy.buttons.refresh}
        </button>
      </div>

      <section className="probe-card content-frame content-frame-accent">
        <div className="probe-header">
          <strong className="state-title">{copy.probeTitle}</strong>
          <span className="state-muted">{copy.probeHint}</span>
        </div>
        <div className="probe-row">
          <input
            className="inline-input"
            value={probePath}
            onChange={(event) => setProbePath(event.target.value)}
            placeholder="/health"
          />
          <button
            type="button"
            disabled={isBusy || probeState === "loading"}
            onClick={() => void handleProbe()}
            className="btn btn-ghost"
          >
            {probeState === "loading" ? copy.buttons.probing : copy.buttons.probe}
          </button>
        </div>
        {probeResult ? (
          <div className={`probe-result ${probeResult.ok ? "probe-result-ok" : "probe-result-error"}`}>
            <span>HTTP {probeResult.statusCode}</span>
            <span>{probeResult.durationMs}ms</span>
            <span>{probeResult.endpoint}</span>
          </div>
        ) : null}
        {probeResult?.bodySnippet ? <pre className="trace-block trace-block-runtime">{probeResult.bodySnippet}</pre> : null}
        {probeError ? (
          <div className="error-state">
            <strong className="state-title">{copy.probeFailedTitle}</strong>
            <span className="state-muted">{probeError}</span>
          </div>
        ) : null}
      </section>

      {errorText ? (
        <div className="error-state">
          <strong className="state-title">{copy.runtimeFailedTitle}</strong>
          <span className="state-muted">{errorText}</span>
        </div>
      ) : null}

      {message ? <div className="feedback feedback-success">{message}</div> : null}

      <section className="content-frame content-frame-muted">
        <div className="content-frame-header">
          <div className="content-frame-title">{copy.outputTitle}</div>
          <div className="content-frame-caption">{copy.outputCaption}</div>
        </div>
        {logs ? (
          <pre className="trace-block trace-block-runtime">{logs}</pre>
        ) : (
          <div className="empty-state">
            <strong className="state-title">{copy.outputEmptyTitle}</strong>
            <span className="state-muted">{copy.outputEmptyHint(ufrenBrand.productName)}</span>
          </div>
        )}
      </section>
    </section>
  );
}
