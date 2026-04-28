import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import type { InstallerContextDto, InstallerIssue, InstallerTraceEntryDto } from "@ufren/shared";
import { ufrenBrand } from "@ufren/shared";
import { getBooleanLabel, getEmptyLabel, getInstallerCopy, getStatusLabel, type AppLocale } from "../app/i18n/index.js";

type ActionState = "idle" | "loading" | "error";

export interface InstallerPanelSnapshot {
  context: InstallerContextDto;
  issue: InstallerIssue | null;
  traceEntries: InstallerTraceEntryDto[];
  actionState: ActionState;
}

export interface InstallerPanelProps {
  locale: AppLocale;
  onSnapshotChange?: (snapshot: InstallerPanelSnapshot) => void;
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

const defaultContext: InstallerContextDto = {
  state: "idle"
};

export function InstallerPanel({ locale, onSnapshotChange }: InstallerPanelProps): JSX.Element {
  const [context, setContext] = useState<InstallerContextDto>(defaultContext);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [issue, setIssue] = useState<InstallerIssue | null>(null);
  const [traceEntries, setTraceEntries] = useState<InstallerTraceEntryDto[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  const isBusy = useMemo(() => actionState === "loading", [actionState]);
  const canInstall = useMemo(
    () => !isBusy && (context.state === "idle" || context.state === "error"),
    [context.state, isBusy]
  );
  const canRetry = useMemo(() => !isBusy && (context.state === "error" || issue?.retryable === true), [context.state, isBusy, issue?.retryable]);
  const copy = useMemo(() => getInstallerCopy(locale), [locale]);
  const emptyLabel = useMemo(() => getEmptyLabel(locale), [locale]);
  const timelineEntries = useMemo(() => {
    return traceEntries.slice(-8).reverse();
  }, [traceEntries]);
  const surfaceCopy = copy.surface;
  const installerStatusLabel = useMemo(() => getStatusLabel(context.state, locale), [context.state, locale]);
  const retryableLabel = useMemo(() => getBooleanLabel(issue?.retryable, locale), [issue?.retryable, locale]);
  const adminLabel = useMemo(() => getBooleanLabel(issue?.requiresAdmin, locale), [issue?.requiresAdmin, locale]);
  const rebootLabel = useMemo(() => getBooleanLabel(issue?.requiresReboot, locale), [issue?.requiresReboot, locale]);

  const refresh = useCallback(async () => {
    try {
      setActionState("loading");
      setIssue(null);
      setMessage("");
      const api = requireDesktopApi();
      const nextContext = await api.installerStatus();
      setContext(nextContext);
      const trace = await api.installerTrace();
      setTraceEntries(trace.entries);
      setActionState("idle");
    } catch (error) {
      setActionState("error");
      setMessageTone("error");
      setMessage(
        error instanceof Error ? error.message : copy.fallbackError(ufrenBrand.productName)
      );
    } finally {
      setHasLoaded(true);
    }
  }, [copy]);

  const handleInstall = useCallback(async () => {
    try {
      setActionState("loading");
      setMessage("");
      setIssue(null);
      const api = requireDesktopApi();
      const result = await api.installerStart();
      setContext(result.context);
      setMessage(result.message);
      setMessageTone(result.ok ? "success" : "error");
      setIssue(result.issue ?? null);
      const trace = await api.installerTrace();
      setTraceEntries(trace.entries);
      setActionState(result.ok ? "idle" : "error");
    } catch (error) {
      setActionState("error");
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : copy.runFailed(ufrenBrand.productName));
    }
  }, [copy]);

  const handleRetry = useCallback(async () => {
    try {
      setActionState("loading");
      setMessage("");
      const api = requireDesktopApi();
      const result = await api.installerRetry();
      setContext(result.context);
      setMessage(result.message);
      setMessageTone(result.ok ? "success" : "error");
      setIssue(result.issue ?? null);
      const trace = await api.installerTrace();
      setTraceEntries(trace.entries);
      setActionState(result.ok ? "idle" : "error");
    } catch (error) {
      setActionState("error");
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : copy.retryFailed(ufrenBrand.productName));
    }
  }, [copy]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const api = readDesktopApi();
    if (!api) {
      setActionState("error");
      setMessageTone("error");
      setMessage(copy.bridgeError);
      setHasLoaded(true);
      return;
    }
    const unsubscribe = api.onInstallerContextChanged((nextContext) => {
      setContext(nextContext);
    });
    return () => {
      unsubscribe();
    };
  }, [copy.bridgeError]);

  useEffect(() => {
    onSnapshotChange?.({
      context,
      issue,
      traceEntries,
      actionState
    });
  }, [actionState, context, issue, onSnapshotChange, traceEntries]);

  if (!hasLoaded && actionState === "loading") {
    return (
      <section className="panel-card">
        <header className="panel-header">
          <div>
            <h3 className="panel-title">{copy.title}</h3>
            <p className="panel-subtitle">{copy.loadingSubtitle}</p>
          </div>
          <span className="status-pill status-installing">{getStatusLabel("loading", locale)}</span>
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
    <section className="installer-surface">
      <section className={`panel-card page-header-card installer-page-header${context.state === "ready" ? " page-header-card-ready" : ""}`}>
        <div className="page-header-shell">
          <div className="page-header-copy">
            <span className="console-section-kicker">{surfaceCopy.overviewKicker}</span>
            <span className="page-header-eyebrow">{surfaceCopy.overviewEyebrow}</span>
            <h3 className="panel-title">{copy.title}</h3>
            <p className="panel-subtitle">{copy.subtitle}</p>
          </div>

          <div className="page-header-actions panel-actions action-ribbon">
            <button type="button" disabled={!canInstall} onClick={() => void handleInstall()} className="btn btn-primary">
              {copy.buttons.install}
            </button>
            <button type="button" disabled={!canRetry} onClick={() => void handleRetry()} className="btn btn-secondary">
              {copy.buttons.retry}
            </button>
            <button type="button" disabled={isBusy} onClick={() => void refresh()} className="btn btn-ghost">
              {copy.buttons.refresh}
            </button>
          </div>
        </div>

        {message ? (
          <div className={`feedback ${messageTone === "error" ? "feedback-error" : "feedback-success"}`}>{message}</div>
        ) : (
          <div className={`summary-note ${issue ? "summary-note-error" : "summary-note-neutral"} page-header-summary`}>
            <span className="summary-note-label">{copy.snapshotTitle}</span>
            <div className="summary-note-message">{issue?.suggestion ?? context.lastError ?? copy.snapshotCaption}</div>
          </div>
        )}

        <div className="page-header-meta">
          <div className="page-header-metric">
            <span className="page-header-metric-label">{copy.metrics.state}</span>
            <strong className="page-header-metric-value">{installerStatusLabel}</strong>
          </div>
          <div className="page-header-metric">
            <span className="page-header-metric-label">{copy.metrics.retryable}</span>
            <strong className="page-header-metric-value">{retryableLabel}</strong>
          </div>
          <div className="page-header-metric">
            <span className="page-header-metric-label">{surfaceCopy.traceLabel}</span>
            <strong className="page-header-metric-value">{traceEntries.length}</strong>
          </div>
        </div>

        <div className="page-header-support-grid">
          <div className="page-header-support-card">
            <div className="page-header-support-copy">
              <span className="page-header-support-label">{surfaceCopy.issueTitle}</span>
              <p className="page-header-support-text">{surfaceCopy.issueSubtitle}</p>
            </div>
            <section className="kv-grid installer-inline-kv-grid">
              <div className="kv-item">
                <span className="kv-label">{copy.fields.issueCode}</span>
                <span className="kv-value">{issue?.code ?? emptyLabel}</span>
              </div>
              <div className="kv-item">
                <span className="kv-label">{copy.metrics.admin}</span>
                <span className="kv-value">{adminLabel}</span>
              </div>
              <div className="kv-item kv-item-wide">
                <span className="kv-label">{copy.fields.suggestion}</span>
                <span className="kv-value">{issue?.suggestion ?? emptyLabel}</span>
              </div>
            </section>
          </div>

          <section className="kv-grid page-header-kv-grid">
            <div className="kv-item">
              <span className="kv-label">{copy.fields.lastError}</span>
              <span className="kv-value">{context.lastError ?? emptyLabel}</span>
            </div>
            <div className="kv-item">
              <span className="kv-label">{copy.fields.requiresReboot}</span>
              <span className="kv-value">{rebootLabel}</span>
            </div>
            <div className="kv-item">
              <span className="kv-label">{copy.fields.requiresAdmin}</span>
              <span className="kv-value">{adminLabel}</span>
            </div>
          </section>
        </div>
      </section>

      <section className="installer-detail-grid">
        <section className="content-frame installer-snapshot-card">
          <div className="content-frame-header">
            <div className="content-frame-title">{copy.snapshotTitle}</div>
            <div className="content-frame-caption">{copy.snapshotCaption}</div>
          </div>
          <section className="kv-grid">
            <div className="kv-item">
              <span className="kv-label">{copy.fields.lastError}</span>
              <span className="kv-value">{context.lastError ?? emptyLabel}</span>
            </div>
            <div className="kv-item">
              <span className="kv-label">{copy.fields.issueCode}</span>
              <span className="kv-value">{issue?.code ?? emptyLabel}</span>
            </div>
            <div className="kv-item">
              <span className="kv-label">{copy.fields.retryable}</span>
              <span className="kv-value">{getBooleanLabel(issue?.retryable, locale)}</span>
            </div>
            <div className="kv-item">
              <span className="kv-label">{copy.fields.requiresAdmin}</span>
              <span className="kv-value">{getBooleanLabel(issue?.requiresAdmin, locale)}</span>
            </div>
            <div className="kv-item">
              <span className="kv-label">{copy.fields.requiresReboot}</span>
              <span className="kv-value">{getBooleanLabel(issue?.requiresReboot, locale)}</span>
            </div>
            <div className="kv-item kv-item-wide">
              <span className="kv-label">{copy.fields.suggestion}</span>
              <span className="kv-value">{issue?.suggestion ?? emptyLabel}</span>
            </div>
          </section>
        </section>

        <section className="timeline-card content-frame">
          <h4 className="timeline-title">{copy.timelineTitle}</h4>
          {timelineEntries.length === 0 ? (
            <div className="state-muted">{copy.timelineEmpty}</div>
          ) : (
            <ol className="timeline-list">
              {timelineEntries.map((entry) => (
                <li key={`${entry.at}-${entry.stage}-${entry.command}`} className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-head">
                      <span className="timeline-stage">{entry.stage}</span>
                      <span className={entry.exitCode === 0 ? "timeline-exit-ok" : "timeline-exit-error"}>
                        {copy.exit} {entry.exitCode}
                      </span>
                    </div>
                    <div className="timeline-command">{entry.command} {entry.args.join(" ")}</div>
                    <div className="timeline-time">{entry.at}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </section>

      <details className="trace-details content-frame content-frame-muted">
        <summary>{copy.traceTitle(traceEntries.length, ufrenBrand.productName)}</summary>
        {traceEntries.length === 0 ? (
          <div className="empty-state">
            <strong className="state-title">{copy.traceEmptyTitle}</strong>
            <span className="state-muted">{copy.traceEmptyHint(ufrenBrand.productName)}</span>
          </div>
        ) : (
          <pre className="trace-block">
            {traceEntries
              .map(
                (entry) =>
                  `${entry.at} [${entry.stage}] ${entry.command} ${entry.args.join(" ")} => ${entry.exitCode}\nstdout: ${entry.stdoutSnippet}\nstderr: ${entry.stderrSnippet}`
              )
              .join("\n\n")}
          </pre>
        )}
      </details>

      {actionState === "error" ? (
        <div className="error-state">
          <strong className="state-title">{copy.failedTitle(ufrenBrand.productName)}</strong>
          <span className="state-muted">{copy.failedHint}</span>
        </div>
      ) : null}
    </section>
  );
}
