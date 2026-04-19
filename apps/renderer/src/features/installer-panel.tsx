import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import type { InstallerContextDto, InstallerIssue, InstallerTraceEntryDto } from "@ufren/shared";
import { ufrenBrand } from "@ufren/shared";
import { getBooleanLabel, getEmptyLabel, getInstallerCopy, getStatusLabel, type AppLocale } from "../app/ui-copy.js";

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
    <section className="panel-card">
      <header className="panel-header">
        <div>
            <h3 className="panel-title">{copy.title}</h3>
            <p className="panel-subtitle">{copy.subtitle}</p>
        </div>
        <span className={`status-pill status-${context.state}`}>{getStatusLabel(context.state, locale)}</span>
      </header>

      <section className="panel-banner panel-banner-installer">
        <div className="panel-banner-copy">
          <span className="panel-banner-kicker">{copy.bannerKicker}</span>
          <strong className="panel-banner-title">{copy.bannerTitle}</strong>
        </div>
        <div className="panel-banner-metrics">
          <div className="panel-banner-metric">
            <span className="panel-banner-metric-label">{copy.metrics.state}</span>
            <strong className="panel-banner-metric-value">{getStatusLabel(context.state, locale)}</strong>
          </div>
          <div className="panel-banner-metric">
            <span className="panel-banner-metric-label">{copy.metrics.retryable}</span>
            <strong className="panel-banner-metric-value">{getBooleanLabel(issue?.retryable, locale)}</strong>
          </div>
          <div className="panel-banner-metric">
            <span className="panel-banner-metric-label">{copy.metrics.admin}</span>
            <strong className="panel-banner-metric-value">{getBooleanLabel(issue?.requiresAdmin, locale)}</strong>
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

      <div className="panel-actions action-ribbon">
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

      {message ? <div className={`feedback ${messageTone === "error" ? "feedback-error" : "feedback-success"}`}>{message}</div> : null}
      {actionState === "error" ? (
        <div className="error-state">
          <strong className="state-title">{copy.failedTitle(ufrenBrand.productName)}</strong>
          <span className="state-muted">{copy.failedHint}</span>
        </div>
      ) : null}
    </section>
  );
}
