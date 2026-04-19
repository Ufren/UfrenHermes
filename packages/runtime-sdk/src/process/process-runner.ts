import { spawn } from "node:child_process";

import { UfrenError, errorCodes } from "@ufren/shared";

export interface ProcessRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ProcessRunOptions {
  cwd?: string;
  timeoutMs?: number;
}

export async function runProcess(
  command: string,
  args: string[],
  options: ProcessRunOptions = {}
): Promise<ProcessRunResult> {
  const timeoutMs = options.timeoutMs;
  return await new Promise<ProcessRunResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      shell: false
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      reject(
        new UfrenError(errorCodes.COMMAND_EXECUTION_FAILED, error.message, {
          command
        })
      );
    });

    const timeout = timeoutMs
      ? setTimeout(() => {
          child.kill();
          reject(
            new UfrenError(errorCodes.COMMAND_EXECUTION_FAILED, "Process timeout", {
              command,
              timeoutMs
            })
          );
        }, timeoutMs)
      : null;

    child.on("close", (exitCode) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve({
        exitCode: exitCode ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}
