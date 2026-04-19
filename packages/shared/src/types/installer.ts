export const installerStateValues = [
  "idle",
  "checking_prerequisites",
  "installing_wsl",
  "installing_ubuntu",
  "bootstrapping_runtime",
  "finalizing",
  "ready",
  "error"
] as const;

export type InstallerState = (typeof installerStateValues)[number];

export interface InstallerContext {
  state: InstallerState;
  lastError?: string;
}

export const installerIssueCodeValues = [
  "UNKNOWN",
  "WSL_INSTALL_FAILED",
  "DISTRO_INSTALL_FAILED",
  "DISTRO_LIST_FAILED",
  "BOOTSTRAP_SCRIPT_NOT_FOUND",
  "BOOTSTRAP_FAILED",
  "PERMISSION_DENIED",
  "REBOOT_REQUIRED",
  "ALREADY_RUNNING"
] as const;

export type InstallerIssueCode = (typeof installerIssueCodeValues)[number];

export interface InstallerIssue {
  code: InstallerIssueCode;
  retryable: boolean;
  requiresReboot: boolean;
  requiresAdmin: boolean;
  suggestion?: string;
  detail?: string;
}

export interface InstallerTraceEntry {
  at: string;
  stage: InstallerState;
  command: string;
  args: string[];
  exitCode: number;
  durationMs: number;
  stdoutSnippet: string;
  stderrSnippet: string;
}
