import assert from "node:assert/strict";
import test from "node:test";

import type { ProcessRunOptions, ProcessRunResult } from "../process/process-runner.js";
import { WslExecutor } from "./wsl-executor.js";

type ProcessRunner = (
  command: string,
  args: string[],
  options?: ProcessRunOptions
) => Promise<ProcessRunResult>;

void test("listDistributions normalizes WSL null-byte output", async () => {
  const runner: ProcessRunner = () => Promise.resolve({
    exitCode: 0,
    stdout: "U\0b\0u\0n\0t\0u\0\r\0\n\0D\0e\0b\0i\0a\0n\0",
    stderr: ""
  });

  const executor = new WslExecutor(runner);
  const distributions = await executor.listDistributions();

  assert.deepEqual(distributions, ["Ubuntu", "Debian"]);
});

void test("ensureWslAvailable falls back when --status is unsupported", async () => {
  const calls: string[] = [];
  const runner: ProcessRunner = (_command, args) => {
    calls.push(args.join(" "));
    if (args[0] === "--status") {
      return Promise.resolve({
        exitCode: 1,
        stdout: "",
        stderr: "Invalid command line option: --status"
      });
    }
    if (args[0] === "-l" && args[1] === "-q") {
      return Promise.resolve({
        exitCode: 0,
        stdout: "Ubuntu",
        stderr: ""
      });
    }
    return Promise.resolve({
      exitCode: 1,
      stdout: "",
      stderr: `unexpected args: ${args.join(" ")}`
    });
  };

  const executor = new WslExecutor(runner);
  await executor.ensureWslAvailable();

  assert.deepEqual(calls, ["--status", "-l -q"]);
});
