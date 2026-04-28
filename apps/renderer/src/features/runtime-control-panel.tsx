import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import type { RuntimeHealthDto, RuntimeProbeResponseDto, RuntimeStatus } from "@ufren/shared";
import { ufrenBrand } from "@ufren/shared";
import { getEmptyLabel, getRuntimeCopy, getStatusLabel, type AppLocale } from "../app/i18n/index.js";

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
  const emptyLabel = useMemo(() => getEmptyLabel(locale), [locale]);
  const isBusy = useMemo(() => actionState === "loading", [actionState]);
  const canStart = useMemo(() => !isBusy && status !== "running" && status !== "starting", [isBusy, status]);
  const canStop = useMemo(() => !isBusy && status === "running", [isBusy, status]);
  const logLineCount = useMemo(() => logs.split(/\r?\n/).filter(Boolean).length, [logs]);
  const surfaceCopy = copy.surface;
  const statusLabel = useMemo(() => getStatusLabel(status, locale), [locale, status]);
  const healthStatusLabel = useMemo(
    () => (health?.status ? getStatusLabel(health.status, locale) : emptyLabel),
    [emptyLabel, health?.status, locale]
  );
  const probeStatusValue = useMemo(() => {
    if (!probeResult) {
      return emptyLabel;
    }
    return `${probeResult.statusCode} / ${probeResult.durationMs}ms`;
  }, [emptyLabel, probeResult]);

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
      setErrorText(error instanceof Error ? error.message : copy.openEndpointFailed);
    }
  }, [copy.openEndpointFailed, health?.endpoint]);

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
    <section className="runtime-surface">
      <section className={`panel-card page-header-card runtime-page-header${health?.status === "running" ? " page-header-card-ready" : ""}`}>
        <div className="page-header-shell">
          <div className="page-header-copy">
            <span className="console-section-kicker">{surfaceCopy.overviewKicker}</span>
            <span className="page-header-eyebrow">{surfaceCopy.overviewEyebrow}</span>
            <h3 className="panel-title">{copy.title}</h3>
            <p className="panel-subtitle">{copy.subtitle}</p>
          </div>

          <div className="page-header-actions panel-actions action-ribbon">
            <button type="button" disabled={!canStart} onClick={() => void handleStart()} className="btn btn-primary">
              {copy.buttons.start}
            </button>
            <button type="button" disabled={!canStop} onClick={() => void handleStop()} className="btn btn-secondary">
              {copy.buttons.stop}
            </button>
            {health?.status === "running" && health?.endpoint ? (
              <button type="button" onClick={() => void handleOpenEndpoint()} className="btn btn-secondary">
                {copy.buttons.openHealth}
              </button>
            ) : null}
            <button type="button" disabled={isBusy} onClick={() => void refresh()} className="btn btn-ghost">
              {copy.buttons.refresh}
            </button>
          </div>
        </div>

        {errorText ? (
          <div className="feedback feedback-error">{errorText}</div>
        ) : message ? (
          <div className="feedback feedback-success">{message}</div>
        ) : (
          <div className="summary-note summary-note-neutral page-header-summary">
            <span className="summary-note-label">{copy.telemetrySignal}</span>
            <div className="summary-note-message">{health?.detail ?? copy.pulseFallback(statusLabel)}</div>
          </div>
        )}

        <div className="page-header-meta">
          <div className="page-header-metric">
            <span className="page-header-metric-label">{copy.metrics.status}</span>
            <strong className="page-header-metric-value">{statusLabel}</strong>
          </div>
          <div className="page-header-metric">
            <span className="page-header-metric-label">{copy.metrics.health}</span>
            <strong className="page-header-metric-value">{healthStatusLabel}</strong>
          </div>
          <div className="page-header-metric">
            <span className="page-header-metric-label">{copy.metrics.probePath}</span>
            <strong className="page-header-metric-value">{probePath}</strong>
          </div>
        </div>

        <div className="page-header-support-grid">
          <div className="page-header-support-card">
            <div className="page-header-support-copy">
              <span className="page-header-support-label">{surfaceCopy.telemetryTitle}</span>
              <p className="page-header-support-text">{surfaceCopy.telemetrySubtitle}</p>
            </div>

            <section className="kv-grid runtime-inline-kv-grid">
              <div className="kv-item">
                <span className="kv-label">{copy.fields.endpoint}</span>
                <span className="kv-value">{health?.endpoint ?? emptyLabel}</span>
              </div>
              <div className="kv-item">
                <span className="kv-label">{copy.telemetryActivity}</span>
                <span className="kv-value">{copy.logLines(logLineCount)}</span>
              </div>
              <div className="kv-item kv-item-wide">
                <span className="kv-label">{copy.fields.healthDetail}</span>
                <span className="kv-value">{health?.detail ?? copy.pulseFallback(statusLabel)}</span>
              </div>
            </section>
          </div>

          <section className="kv-grid page-header-kv-grid">
            <div className="kv-item">
              <span className="kv-label">{copy.fields.lastCheck}</span>
              <span className="kv-value">{health?.lastCheckedAt ?? emptyLabel}</span>
            </div>
            <div className="kv-item">
              <span className="kv-label">{copy.probeLabels.probe}</span>
              <span className="kv-value">{probeStatusValue}</span>
            </div>
            <div className="kv-item">
              <span className="kv-label">{copy.probeLabels.logs}</span>
              <span className="kv-value">{copy.logLines(logLineCount)}</span>
            </div>
          </section>
        </div>
      </section>

      <section className="runtime-detail-grid">
        <section className="content-frame">
          <div className="content-frame-header">
            <div className="content-frame-title">{copy.snapshotTitle}</div>
            <div className="content-frame-caption">{copy.snapshotCaption}</div>
          </div>
          <section className="kv-grid">
            <div className="kv-item">
              <span className="kv-label">{copy.fields.endpoint}</span>
              <span className="kv-value">{health?.endpoint ?? emptyLabel}</span>
            </div>
            <div className="kv-item">
              <span className="kv-label">{copy.fields.lastCheck}</span>
              <span className="kv-value">{health?.lastCheckedAt ?? emptyLabel}</span>
            </div>
            <div className="kv-item kv-item-wide">
              <span className="kv-label">{copy.fields.healthDetail}</span>
              <span className="kv-value">{health?.detail ?? emptyLabel}</span>
            </div>
          </section>
        </section>

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
      </section>

      <section className="content-frame content-frame-muted runtime-logs-card">
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
