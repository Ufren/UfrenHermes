import { mkdirSync, rmSync } from "node:fs";
import { appendFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { ufrenBrand } from "@ufren/shared";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  error?: unknown;
  component?: string;
}

export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>, error?: unknown) => void;
}

interface LoggerState {
  consoleMinLevel: LogLevel;
  fileMinLevel: LogLevel;
  logFilePath?: string;
  maxFileBytes: number;
  pendingLines: string[];
  recentLines: string[];
  writeQueue: Promise<void>;
}

interface LoggerInitOptions {
  logDir: string;
  fileName?: string;
  consoleMinLevel?: LogLevel;
  fileMinLevel?: LogLevel;
  maxFileBytes?: number;
}

interface AppLogsSnapshot {
  content: string;
  filePath?: string;
}

const logPriorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const maxBufferedLines = 500;
const defaultLogFileName = "main.log";
const defaultMaxFileBytes = 2 * 1024 * 1024;

const state: LoggerState = {
  consoleMinLevel: resolveLevel(process.env.UFREN_LOG_CONSOLE_LEVEL, "info"),
  fileMinLevel: resolveLevel(process.env.UFREN_LOG_FILE_LEVEL, "debug"),
  maxFileBytes: defaultMaxFileBytes,
  pendingLines: [],
  recentLines: [],
  writeQueue: Promise.resolve()
};

export function initializeLogger(options: LoggerInitOptions): void {
  state.consoleMinLevel = options.consoleMinLevel ?? state.consoleMinLevel;
  state.fileMinLevel = options.fileMinLevel ?? state.fileMinLevel;
  state.maxFileBytes = options.maxFileBytes ?? defaultMaxFileBytes;
  state.logFilePath = join(options.logDir, options.fileName ?? defaultLogFileName);
  mkdirSync(dirname(state.logFilePath), { recursive: true });

  if (state.pendingLines.length > 0) {
    const buffered = [...state.pendingLines];
    state.pendingLines = [];
    for (const line of buffered) {
      enqueueWrite(line);
    }
  }
}

export function getLogFilePath(): string | undefined {
  return state.logFilePath;
}

export async function readAppLogs(lines = 200): Promise<AppLogsSnapshot> {
  const safeLines = Number.isInteger(lines) ? Math.max(10, Math.min(lines, 2000)) : 200;
  const logFilePath = state.logFilePath;
  if (logFilePath) {
    await state.writeQueue;
    try {
      const content = await readFile(logFilePath, "utf8");
      return {
        content: tailLines(content, safeLines),
        filePath: logFilePath
      };
    } catch {
      // Fall back to in-memory lines if the file is not ready yet.
    }
  }

  return {
    content: tailLines(state.recentLines.join("\n"), safeLines),
    filePath: logFilePath
  };
}

export function createLogger(component: string, bindings?: Record<string, unknown>): Logger {
  return {
    debug: (message, meta) => {
      log({ level: "debug", message, meta: mergeMeta(bindings, meta), component });
    },
    info: (message, meta) => {
      log({ level: "info", message, meta: mergeMeta(bindings, meta), component });
    },
    warn: (message, meta) => {
      log({ level: "warn", message, meta: mergeMeta(bindings, meta), component });
    },
    error: (message, meta, error) => {
      log({ level: "error", message, meta: mergeMeta(bindings, meta), error, component });
    }
  };
}

export function log(entry: LogEntry): void {
  const payload = JSON.stringify({
    ts: new Date().toISOString(),
    scope: ufrenBrand.logScope,
    component: entry.component ?? "main",
    level: entry.level,
    message: entry.message,
    meta: serializeUnknown(entry.meta ?? {}),
    error: entry.error === undefined ? undefined : serializeUnknown(entry.error),
    pid: process.pid
  });

  rememberLine(payload);

  if (shouldLog(entry.level, state.consoleMinLevel)) {
    writeConsole(entry.level, payload);
  }

  if (!shouldLog(entry.level, state.fileMinLevel)) {
    return;
  }

  if (!state.logFilePath) {
    state.pendingLines.push(payload);
    trimLines(state.pendingLines);
    return;
  }

  enqueueWrite(payload);
}

export async function resetLoggerForTests(): Promise<void> {
  await state.writeQueue;
  if (state.logFilePath) {
    rmSync(state.logFilePath, { force: true });
    rmSync(`${state.logFilePath}.1`, { force: true });
  }
  state.logFilePath = undefined;
  state.maxFileBytes = defaultMaxFileBytes;
  state.pendingLines = [];
  state.recentLines = [];
  state.consoleMinLevel = "error";
  state.fileMinLevel = "debug";
  state.writeQueue = Promise.resolve();
}

function enqueueWrite(line: string): void {
  const logFilePath = state.logFilePath;
  if (!logFilePath) {
    state.pendingLines.push(line);
    trimLines(state.pendingLines);
    return;
  }

  state.writeQueue = state.writeQueue
    .then(async () => {
      await mkdir(dirname(logFilePath), { recursive: true });
      await rotateIfNeeded(logFilePath, line);
      await appendFile(logFilePath, `${line}\n`, "utf8");
    })
    .catch((error: unknown) => {
      writeConsole(
        "error",
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: ufrenBrand.logScope,
          component: "logger",
          level: "error",
          message: "Failed to persist log entry",
          meta: { target: logFilePath, reason: serializeUnknown(error) },
          pid: process.pid
        })
      );
    });
}

async function rotateIfNeeded(logFilePath: string, nextLine: string): Promise<void> {
  try {
    const info = await stat(logFilePath);
    if (info.size + Buffer.byteLength(nextLine, "utf8") + 1 <= state.maxFileBytes) {
      return;
    }
  } catch {
    return;
  }

  const backupPath = `${logFilePath}.1`;
  try {
    await rename(logFilePath, backupPath);
  } catch {
    try {
      await writeFile(logFilePath, "", "utf8");
    } catch {
      // Ignore backup failures and let appendFile report the write error later.
    }
  }
}

function rememberLine(line: string): void {
  state.recentLines.push(line);
  trimLines(state.recentLines);
}

function trimLines(lines: string[]): void {
  if (lines.length > maxBufferedLines) {
    lines.splice(0, lines.length - maxBufferedLines);
  }
}

function writeConsole(level: LogLevel, payload: string): void {
  if (level === "error") {
    console.error(payload);
    return;
  }
  if (level === "warn") {
    console.warn(payload);
    return;
  }
  console.info(payload);
}

function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return logPriorities[level] >= logPriorities[minLevel];
}

function resolveLevel(input: string | undefined, fallback: LogLevel): LogLevel {
  if (input === "debug" || input === "info" || input === "warn" || input === "error") {
    return input;
  }
  return fallback;
}

function mergeMeta(
  bindings: Record<string, unknown> | undefined,
  meta: Record<string, unknown> | undefined
): Record<string, unknown> {
  return {
    ...(bindings ?? {}),
    ...(meta ?? {})
  };
}

function tailLines(content: string, lines: number): string {
  const normalized = content.trimEnd();
  if (!normalized) {
    return "";
  }
  return normalized.split(/\r?\n/g).slice(-lines).join("\n");
}

function serializeUnknown(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Error) {
    const base: Record<string, unknown> = {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
    const withCause = value as Error & { cause?: unknown };
    if (withCause.cause !== undefined) {
      base.cause = serializeUnknown(withCause.cause, seen);
    }
    return base;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeUnknown(item, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = serializeUnknown(item, seen);
    }
    seen.delete(value);
    return output;
  }
  if (typeof value === "symbol") {
    return value.description ? `Symbol(${value.description})` : "Symbol()";
  }
  return value;
}
