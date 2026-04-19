import { existsSync } from "node:fs";
import { EventEmitter } from "node:events";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { InstallerOrchestrator } from "@ufren/installer-sdk";
import {
  runProcess,
  type ProcessRunOptions,
  type ProcessRunResult
} from "@ufren/runtime-sdk";
import type {
  InstallerActionResultDto,
  InstallerContextDto,
  InstallerIssue,
  InstallerState,
  InstallerTraceEntryDto
} from "@ufren/shared";
import { ufrenBrand } from "@ufren/shared";

import { createLogger } from "../logging/logger.js";

type InstallStage = "checking_prerequisites" | "installing_ubuntu" | "bootstrapping_runtime";
type ProcessRunner = (
  command: string,
  args: string[],
  options?: ProcessRunOptions
) => Promise<ProcessRunResult>;
const maxTraceEntries = 200;
const traceSnippetMaxLength = 800;
const installerLogger = createLogger("installer-service");

export class InstallerService extends EventEmitter {
  private readonly orchestrator = new InstallerOrchestrator();
  private readonly configuredDistribution = process.env.UFREN_WSL_DISTRO;
  private readonly runtimeRoot = process.env.UFREN_RUNTIME_ROOT ?? "~/.local/share/ufren-hermes/runtime";
  private readonly processRunner: ProcessRunner;
  private inProgress = false;
  private executionTrace: InstallerTraceEntryDto[] = [];

  public constructor(processRunner: ProcessRunner = runProcess) {
    super();
    this.processRunner = processRunner;
    installerLogger.info("Installer service initialized", {
      configuredDistribution: this.configuredDistribution ?? "default",
      runtimeRoot: this.runtimeRoot
    });
  }

  public getContext(): InstallerContextDto {
    return this.orchestrator.getContext();
  }

  public getExecutionTrace(): InstallerTraceEntryDto[] {
    return this.executionTrace.map((entry) => ({ ...entry, args: [...entry.args] }));
  }

  public async retry(): Promise<InstallerActionResultDto> {
    const context = this.orchestrator.getContext();
    if (context.state !== "error" && context.state !== "idle") {
      return {
        ok: false,
        message: `${ufrenBrand.productName} installer retry is only allowed from error or idle state, current: ${context.state}`,
        context,
        issue: {
          code: "ALREADY_RUNNING",
          retryable: true,
          requiresAdmin: false,
          requiresReboot: false,
          suggestion: `Wait for the current ${ufrenBrand.productName} installer run to finish before retrying.`
        }
      };
    }
    return await this.start();
  }

  public async start(): Promise<InstallerActionResultDto> {
    if (this.inProgress) {
      installerLogger.warn("Installer start ignored because another run is in progress");
      return {
        ok: false,
        message: `${ufrenBrand.productName} installer is already running`,
        context: this.orchestrator.getContext(),
        issue: {
          code: "ALREADY_RUNNING",
          retryable: true,
          requiresAdmin: false,
          requiresReboot: false,
          suggestion: `Wait for the current ${ufrenBrand.productName} installer run to finish before retrying.`
        }
      };
    }
    this.inProgress = true;
    this.executionTrace = [];
    this.orchestrator.reset();
    this.emitContextChanged();
    this.orchestrator.start();
    this.emitContextChanged();
    let stage: InstallStage = "checking_prerequisites";
    installerLogger.info("Installer run started");
    try {
      await this.ensureWslAvailable();
      this.orchestrator.markStepCompleted();
      this.emitContextChanged();

      const distribution = await this.resolveTargetDistribution();
      installerLogger.info("Installer selected target distribution", { distribution });
      stage = "installing_ubuntu";
      await this.ensureDistroAvailable(distribution);
      this.orchestrator.markStepCompleted();
      this.emitContextChanged();

      stage = "bootstrapping_runtime";
      await this.bootstrapRuntime(distribution);
      this.orchestrator.markStepCompleted();
      this.emitContextChanged();
      this.orchestrator.markStepCompleted();
      this.emitContextChanged();
      this.orchestrator.markStepCompleted();
      this.emitContextChanged();

      return {
        ok: true,
        message: `${ufrenBrand.productName} installer completed successfully on distribution ${distribution}`,
        context: this.orchestrator.getContext()
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `${ufrenBrand.productName} installer failed due to an unknown execution error`;
      const issue = this.classifyIssue(stage, message);
      installerLogger.error(
        "Installer run failed",
        {
          stage,
          issueCode: issue.code,
          retryable: issue.retryable,
          requiresAdmin: issue.requiresAdmin,
          requiresReboot: issue.requiresReboot
        },
        error
      );
      const context = this.orchestrator.fail(message);
      this.emitContextChanged();
      return {
        ok: false,
        message,
        context,
        issue
      };
    } finally {
      this.inProgress = false;
      installerLogger.info("Installer run finished", { stage, inProgress: this.inProgress });
    }
  }

  private async ensureWslAvailable(): Promise<void> {
    const status = await this.executeCommand("checking_prerequisites", "wsl", ["--status"], {
      timeoutMs: 20_000
    });
    if (status.exitCode === 0) {
      return;
    }

    const legacyList = await this.executeCommand("checking_prerequisites", "wsl", ["-l", "-q"], {
      timeoutMs: 20_000
    });
    if (legacyList.exitCode === 0) {
      return;
    }

    const enableResult = await this.executeCommand("checking_prerequisites", "wsl", ["--install"], {
      timeoutMs: 900_000
    });
    if (enableResult.exitCode !== 0) {
      const detail = [enableResult.stderr, enableResult.stdout, status.stderr, status.stdout]
        .filter((value) => value.trim().length > 0)
        .join("\n");
      const lowerDetail = detail.toLowerCase();
      if (
        lowerDetail.includes("invalid command line option: --install") ||
        lowerDetail.includes("unknown option: --install") ||
        lowerDetail.includes("unrecognized option '--install'") ||
        lowerDetail.includes("invalid command line option: --status") ||
        lowerDetail.includes("unknown option: --status") ||
        lowerDetail.includes("unrecognized option '--status'")
      ) {
        throw new Error(
          "This Windows version does not support modern `wsl --status` / `wsl --install` commands. Enable WSL manually or upgrade Windows, then retry."
        );
      }
      throw new Error(detail || "Failed to install WSL");
    }
  }

  private async resolveTargetDistribution(): Promise<string> {
    if (this.configuredDistribution) {
      return this.configuredDistribution;
    }
    const listVerbose = await this.executeCommand("installing_ubuntu", "wsl", ["-l", "-v"], {
      timeoutMs: 30_000
    });
    if (listVerbose.exitCode !== 0) {
      return "Ubuntu";
    }
    const parsed = this.parseDistroDetails(listVerbose.stdout);
    const validDistros = parsed.filter(
      (value) => value.name !== "docker-desktop" && value.name !== "docker-desktop-data"
    );

    const preferred = validDistros.find((value) => value.isDefault);
    if (preferred) {
      return preferred.name;
    }

    const ubuntu = validDistros.find((value) => value.name.toLowerCase().includes("ubuntu"));
    if (ubuntu) {
      return ubuntu.name;
    }

    const fallback = validDistros.at(0);
    if (fallback) {
      return fallback.name;
    }
    return "Ubuntu";
  }

  private async ensureDistroAvailable(distribution: string): Promise<void> {
    const listed = await this.executeCommand("installing_ubuntu", "wsl", ["-l", "-q"], {
      timeoutMs: 30_000
    });
    if (listed.exitCode !== 0) {
      throw new Error(listed.stderr || "Failed to list WSL distributions");
    }
    const hasDistro = listed.stdout
      .split(/\r?\n/g)
      .map((value) => value.trim())
      .some((value) => value === distribution);
    if (!hasDistro) {
      const install = await this.executeCommand("installing_ubuntu", "wsl", ["--install", "-d", distribution], {
        timeoutMs: 900_000
      });
      if (install.exitCode !== 0) {
        throw new Error(install.stderr || `Failed to install distribution ${distribution}`);
      }
    }
    await this.ensureDistroVersion2(distribution);
  }

  private async ensureDistroVersion2(distribution: string): Promise<void> {
    const listVerbose = await this.executeCommand("installing_ubuntu", "wsl", ["-l", "-v"], {
      timeoutMs: 30_000
    });
    if (listVerbose.exitCode !== 0) {
      return;
    }
    const parsed = this.parseDistroDetails(listVerbose.stdout);
    const current = parsed.find((value) => value.name === distribution);
    if (!current || current.version === 2) {
      return;
    }
    const convert = await this.executeCommand(
      "installing_ubuntu",
      "wsl",
      ["--set-version", distribution, "2"],
      { timeoutMs: 900_000 }
    );
    if (convert.exitCode !== 0) {
      throw new Error(convert.stderr || `Failed to convert distribution ${distribution} to WSL2`);
    }
  }

  private async bootstrapRuntime(distribution: string): Promise<void> {
    const bootstrapScript = this.resolveBootstrapScriptPath();
    const hermesAgentSource = this.resolveHermesAgentSourcePath();
    const result = await this.executeCommand(
      "bootstrapping_runtime",
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        bootstrapScript,
        "-Distribution",
        distribution,
        "-RuntimeRoot",
        this.runtimeRoot,
        "-AgentSourceWindowsPath",
        hermesAgentSource
      ],
      {
        timeoutMs: 600_000
      }
    );
    if (result.exitCode !== 0) {
      const detail = [result.stderr, result.stdout]
        .filter((value) => value.trim().length > 0)
        .join("\n");
      throw new Error(detail || "Runtime bootstrap script failed");
    }
  }

  private async executeCommand(
    stage: InstallerState,
    command: string,
    args: string[],
    options?: ProcessRunOptions
  ): Promise<ProcessRunResult> {
    const startedAt = Date.now();
    const result = await this.processRunner(command, args, options);
    
    // Normalize WSL UTF-16LE output read as UTF-8 by stripping null bytes
    result.stdout = result.stdout.replace(/\0/g, "");
    result.stderr = result.stderr.replace(/\0/g, "");

    const finishedAt = Date.now();
    const entry: InstallerTraceEntryDto = {
      at: new Date(finishedAt).toISOString(),
      stage,
      command,
      args: [...args],
      exitCode: result.exitCode,
      durationMs: finishedAt - startedAt,
      stdoutSnippet: this.makeSnippet(result.stdout),
      stderrSnippet: this.makeSnippet(result.stderr)
    };
    this.executionTrace.push(entry);
    installerLogger.debug("Installer command executed", {
      stage,
      command,
      args,
      exitCode: result.exitCode,
      durationMs: entry.durationMs,
      stdoutSnippet: entry.stdoutSnippet,
      stderrSnippet: entry.stderrSnippet
    });
    if (this.executionTrace.length > maxTraceEntries) {
      this.executionTrace = this.executionTrace.slice(-maxTraceEntries);
    }
    return result;
  }

  private makeSnippet(content: string): string {
    if (content.length <= traceSnippetMaxLength) {
      return content;
    }
    return `${content.slice(0, traceSnippetMaxLength)}...<truncated>`;
  }

  private emitContextChanged(): void {
    this.emit("contextChanged", this.orchestrator.getContext());
  }

  private parseDistroDetails(output: string): { name: string; version: number; isDefault: boolean }[] {
    const lines = output.split(/\r?\n/g).map((line) => line.trimEnd());
    const rows = lines.filter((line) => line.trim().length > 0);
    const details: { name: string; version: number; isDefault: boolean }[] = [];
    for (const row of rows) {
      const isHeader = row.toLowerCase().includes("name") && row.toLowerCase().includes("version");
      if (isHeader) {
        continue;
      }
      const normalized = row.trimStart();
      const isDefault = normalized.startsWith("*");
      const content = isDefault ? normalized.slice(1).trim() : normalized;
      const tokens = content.split(/\s+/g);
      if (tokens.length < 2) {
        continue;
      }
      const versionToken = tokens.at(-1);
      if (!versionToken || !/^\d+$/.test(versionToken)) {
        continue;
      }
      const nameTokens = tokens.slice(0, -2);
      const name = nameTokens.length > 0 ? nameTokens.join(" ") : tokens[0];
      details.push({
        name,
        version: Number.parseInt(versionToken, 10),
        isDefault
      });
    }
    return details;
  }

  private resolveBootstrapScriptPath(): string {
    const envPath = process.env.UFREN_BOOTSTRAP_SCRIPT;
    if (envPath && existsSync(envPath)) {
      return envPath;
    }
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      resolve(currentDir, "..", "..", "..", "resources", "powershell", "bootstrap-runtime.ps1"),
      resolve(process.cwd(), "resources", "powershell", "bootstrap-runtime.ps1"),
      resolve(process.cwd(), "..", "..", "resources", "powershell", "bootstrap-runtime.ps1"),
      resolve(process.cwd(), "..", "resources", "powershell", "bootstrap-runtime.ps1"),
      join(process.resourcesPath, "powershell", "bootstrap-runtime.ps1")
    ];
    const matched = candidates.find((value) => existsSync(value));
    if (!matched) {
      throw new Error("Bootstrap script not found");
    }
    return matched;
  }

  private resolveHermesAgentSourcePath(): string {
    const envPath = process.env.UFREN_HERMES_AGENT_PATH;
    if (envPath && existsSync(envPath)) {
      return envPath;
    }
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      resolve(currentDir, "..", "..", "..", "..", "..", "hermes-agent"),
      resolve(process.cwd(), "..", "..", "hermes-agent"),
      resolve(process.cwd(), "..", "hermes-agent"),
      resolve(process.cwd(), "hermes-agent"),
      join(process.resourcesPath, "hermes-agent")
    ];
    const matched = candidates.find((value) => existsSync(value));
    if (!matched) {
      throw new Error("Hermes agent source not found");
    }
    return matched;
  }

  private classifyIssue(stage: InstallStage, message: string): InstallerIssue {
    const lower = message.toLowerCase();
    if (lower.includes("bootstrap script not found")) {
      return {
        code: "BOOTSTRAP_SCRIPT_NOT_FOUND",
        retryable: false,
        requiresAdmin: false,
        requiresReboot: false,
        suggestion: "Verify packaged resources include bootstrap-runtime.ps1.",
        detail: message
      };
    }
    if (lower.includes("hermes agent source not found")) {
      return {
        code: "BOOTSTRAP_FAILED",
        retryable: false,
        requiresAdmin: false,
        requiresReboot: false,
        suggestion: "Verify packaged resources include hermes-agent.",
        detail: message
      };
    }
    if (lower.includes("python3 not found in target distro")) {
      return {
        code: "BOOTSTRAP_FAILED",
        retryable: false,
        requiresAdmin: false,
        requiresReboot: false,
        suggestion: "Install python3 and python3-venv in the target distro, then retry.",
        detail: message
      };
    }
    if (lower.includes("python3-venv not found in target distro")) {
      return {
        code: "BOOTSTRAP_FAILED",
        retryable: false,
        requiresAdmin: false,
        requiresReboot: false,
        suggestion: "Install python3-venv in the target distro, then retry.",
        detail: message
      };
    }
    if (
      lower.includes("python3-venv or ensurepip not available in target distro") ||
      lower.includes("ensurepip is not available") ||
      lower.includes("no module named ensurepip")
    ) {
      return {
        code: "BOOTSTRAP_FAILED",
        retryable: false,
        requiresAdmin: false,
        requiresReboot: false,
        suggestion: "Install python3-venv (and, if needed, python3-full) in the target distro, then retry.",
        detail: message
      };
    }
    if (
      lower.includes("failed to install required ubuntu packages") ||
      lower.includes("automatic dependency installation completed, but python3 -m venv is still unavailable") ||
      lower.includes("python3 and python3-venv could not be provisioned automatically in target distro")
    ) {
      return {
        code: "BOOTSTRAP_FAILED",
        retryable: true,
        requiresAdmin: false,
        requiresReboot: false,
        suggestion: "Check Ubuntu package sources and network connectivity, then retry. The installer already attempted to provision Python runtime dependencies automatically.",
        detail: message
      };
    }
    if (
      lower.includes("does not support modern `wsl --status` / `wsl --install` commands") ||
      lower.includes("invalid command line option: --install") ||
      lower.includes("unknown option: --install") ||
      lower.includes("unrecognized option '--install'")
    ) {
      return {
        code: "WSL_INSTALL_FAILED",
        retryable: false,
        requiresAdmin: true,
        requiresReboot: false,
        suggestion: "Use a newer Windows build with modern WSL commands, or enable WSL manually via Windows Features / DISM and retry.",
        detail: message
      };
    }
    if (lower.includes("access is denied") || lower.includes("permission denied")) {
      return {
        code: "PERMISSION_DENIED",
        retryable: true,
        requiresAdmin: true,
        requiresReboot: false,
        suggestion: `Run ${ufrenBrand.productName} installer with administrator privileges.`,
        detail: message
      };
    }
    if (
      lower.includes("restart required") ||
      lower.includes("reboot required") ||
      lower.includes("restart the computer")
    ) {
      return {
        code: "REBOOT_REQUIRED",
        retryable: true,
        requiresAdmin: false,
        requiresReboot: true,
        suggestion: `Restart Windows, then run ${ufrenBrand.productName} installer again.`,
        detail: message
      };
    }
    if (stage === "checking_prerequisites") {
      return {
        code: "WSL_INSTALL_FAILED",
        retryable: true,
        requiresAdmin: true,
        requiresReboot: false,
        suggestion: "Check WSL feature state and network connectivity before retrying.",
        detail: message
      };
    }
    if (stage === "installing_ubuntu") {
      const code = lower.includes("list") ? "DISTRO_LIST_FAILED" : "DISTRO_INSTALL_FAILED";
      return {
        code,
        retryable: true,
        requiresAdmin: false,
        requiresReboot: false,
        suggestion: "Verify distribution availability with `wsl -l -o` and retry.",
        detail: message
      };
    }
    if (stage === "bootstrapping_runtime") {
      return {
        code: "BOOTSTRAP_FAILED",
        retryable: true,
        requiresAdmin: false,
        requiresReboot: false,
        suggestion: "Check bootstrap script output and runtime directory permissions.",
        detail: message
      };
    }
    return {
      code: "UNKNOWN",
      retryable: true,
      requiresAdmin: false,
      requiresReboot: false,
      suggestion: "Collect logs and retry installation.",
      detail: message
    };
  }
}
