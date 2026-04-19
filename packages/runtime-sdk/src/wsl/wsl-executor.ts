import { UfrenError, errorCodes } from "@ufren/shared";

import {
  runProcess,
  type ProcessRunOptions,
  type ProcessRunResult
} from "../process/process-runner.js";

export interface WslCommandOptions {
  distribution: string;
  timeoutMs?: number;
}

type ProcessRunner = (
  command: string,
  args: string[],
  options?: ProcessRunOptions
) => Promise<ProcessRunResult>;

export class WslExecutor {
  public constructor(private readonly processRunner: ProcessRunner = runProcess) {}

  public async ensureWslAvailable(): Promise<void> {
    const status = this.normalizeResult(
      await this.processRunner("wsl", ["--status"], { timeoutMs: 8000 })
    );
    if (status.exitCode === 0) {
      return;
    }

    const legacyList = this.normalizeResult(
      await this.processRunner("wsl", ["-l", "-q"], { timeoutMs: 8000 })
    );
    if (legacyList.exitCode === 0) {
      return;
    }

    throw new UfrenError(errorCodes.WSL_NOT_FOUND, "WSL is unavailable", {
      stderr: status.stderr || legacyList.stderr
    });
  }

  public async listDistributions(): Promise<string[]> {
    const result = this.normalizeResult(
      await this.processRunner("wsl", ["-l", "-q"], { timeoutMs: 8000 })
    );
    if (result.exitCode !== 0) {
      throw new UfrenError(errorCodes.WSL_NOT_FOUND, "Failed to list WSL distributions", {
        stderr: result.stderr
      });
    }
    return result.stdout
      .split(/\r?\n/g)
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  public async runBash(command: string, options: WslCommandOptions): Promise<string> {
    const result = this.normalizeResult(
      await this.processRunner(
        "wsl",
        ["-d", options.distribution, "--", "bash", "-c", command],
        { timeoutMs: options.timeoutMs ?? 30_000 }
      )
    );
    if (result.exitCode !== 0) {
      throw new UfrenError(errorCodes.COMMAND_EXECUTION_FAILED, "WSL command failed", {
        command,
        stderr: result.stderr,
        distribution: options.distribution
      });
    }
    return result.stdout;
  }

  private normalizeResult(result: ProcessRunResult): ProcessRunResult {
    return {
      ...result,
      stdout: result.stdout.replace(/\0/g, ""),
      stderr: result.stderr.replace(/\0/g, "")
    };
  }
}
