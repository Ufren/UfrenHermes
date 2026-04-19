import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import type { ProcessRunOptions, ProcessRunResult } from "@ufren/runtime-sdk";

import { InstallerService } from "./installer-service.js";

type ProcessRunner = (
  command: string,
  args: string[],
  options?: ProcessRunOptions
) => Promise<ProcessRunResult>;

function createBootstrapScriptPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "ufren-installer-test-"));
  const scriptPath = join(dir, "bootstrap-runtime.ps1");
  writeFileSync(scriptPath, "Write-Output 'ok'", "utf8");
  return scriptPath;
}

function createHermesAgentSourcePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "ufren-agent-source-test-"));
  mkdirSync(join(dir, "agent"), { recursive: true });
  writeFileSync(join(dir, "pyproject.toml"), "[project]\nname='hermes-agent-test'\n", "utf8");
  return dir;
}

void test("reuses existing WSL distro and skips install path", async () => {
  const scriptPath = createBootstrapScriptPath();
  const agentSourcePath = createHermesAgentSourcePath();
  const previousScriptEnv = process.env.UFREN_BOOTSTRAP_SCRIPT;
  const previousDistroEnv = process.env.UFREN_WSL_DISTRO;
  const previousAgentPathEnv = process.env.UFREN_HERMES_AGENT_PATH;
  process.env.UFREN_BOOTSTRAP_SCRIPT = scriptPath;
  process.env.UFREN_WSL_DISTRO = "";
  process.env.UFREN_HERMES_AGENT_PATH = agentSourcePath;

  const calls: string[] = [];
  const runner: ProcessRunner = (_command, args) => {
    calls.push(args.join(" "));
    if (args[0] === "--status") {
      return Promise.resolve({ exitCode: 0, stdout: "Default Distribution: Ubuntu", stderr: "" });
    }
    if (args[0] === "-l" && args[1] === "-v") {
      return Promise.resolve({
        exitCode: 0,
        stdout: "  NAME            STATE           VERSION\n* Ubuntu          Running         2",
        stderr: ""
      });
    }
    if (args[0] === "-l" && args[1] === "-q") {
      return Promise.resolve({ exitCode: 0, stdout: "Ubuntu", stderr: "" });
    }
    if (args[0] === "-NoProfile") {
      return Promise.resolve({ exitCode: 0, stdout: "bootstrap ok", stderr: "" });
    }
    return Promise.resolve({
      exitCode: 1,
      stdout: "",
      stderr: `unexpected args: ${args.join(" ")}`
    });
  };

  try {
    const service = new InstallerService(runner);
    const result = await service.start();
    assert.equal(result.ok, true);
    assert.equal(calls.some((value) => value.includes("--install")), false);
    assert.equal(
      calls.some((value) => value.includes("--set-version Ubuntu 2")),
      false
    );
    assert.equal(calls.some((value) => value.includes("-AgentSourceWindowsPath")), true);
    const trace = service.getExecutionTrace();
    assert.equal(trace.length >= 3, true);
    assert.equal(trace[0]?.stage, "checking_prerequisites");
  } finally {
    process.env.UFREN_BOOTSTRAP_SCRIPT = previousScriptEnv;
    process.env.UFREN_WSL_DISTRO = previousDistroEnv;
    process.env.UFREN_HERMES_AGENT_PATH = previousAgentPathEnv;
    rmSync(scriptPath, { force: true });
    rmSync(dirname(scriptPath), { recursive: true, force: true });
    rmSync(agentSourcePath, { recursive: true, force: true });
  }
});

void test("upgrades distro to WSL2 when current version is 1", async () => {
  const scriptPath = createBootstrapScriptPath();
  const agentSourcePath = createHermesAgentSourcePath();
  const previousScriptEnv = process.env.UFREN_BOOTSTRAP_SCRIPT;
  const previousDistroEnv = process.env.UFREN_WSL_DISTRO;
  const previousAgentPathEnv = process.env.UFREN_HERMES_AGENT_PATH;
  process.env.UFREN_BOOTSTRAP_SCRIPT = scriptPath;
  process.env.UFREN_WSL_DISTRO = "Ubuntu";
  process.env.UFREN_HERMES_AGENT_PATH = agentSourcePath;

  const calls: string[] = [];
  let listVerboseCount = 0;
  const runner: ProcessRunner = (_command, args) => {
    calls.push(args.join(" "));
    if (args[0] === "--status") {
      return Promise.resolve({ exitCode: 0, stdout: "WSL is ready", stderr: "" });
    }
    if (args[0] === "-l" && args[1] === "-q") {
      return Promise.resolve({ exitCode: 0, stdout: "Ubuntu", stderr: "" });
    }
    if (args[0] === "-l" && args[1] === "-v") {
      listVerboseCount += 1;
      return Promise.resolve({
        exitCode: 0,
        stdout: "  NAME            STATE           VERSION\n* Ubuntu          Running         1",
        stderr: ""
      });
    }
    if (args[0] === "--set-version") {
      return Promise.resolve({ exitCode: 0, stdout: "Conversion complete", stderr: "" });
    }
    if (args[0] === "-NoProfile") {
      return Promise.resolve({ exitCode: 0, stdout: "bootstrap ok", stderr: "" });
    }
    return Promise.resolve({
      exitCode: 1,
      stdout: "",
      stderr: `unexpected args: ${args.join(" ")}`
    });
  };

  try {
    const service = new InstallerService(runner);
    const result = await service.start();
    assert.equal(result.ok, true);
    assert.equal(listVerboseCount >= 1, true);
    assert.equal(
      calls.some((value) => value.includes("--set-version Ubuntu 2")),
      true
    );
    const trace = service.getExecutionTrace();
    assert.equal(trace.some((entry) => entry.args.includes("--set-version")), true);
  } finally {
    process.env.UFREN_BOOTSTRAP_SCRIPT = previousScriptEnv;
    process.env.UFREN_WSL_DISTRO = previousDistroEnv;
    process.env.UFREN_HERMES_AGENT_PATH = previousAgentPathEnv;
    rmSync(scriptPath, { force: true });
    rmSync(dirname(scriptPath), { recursive: true, force: true });
    rmSync(agentSourcePath, { recursive: true, force: true });
  }
});

void test("retry succeeds after previous failure", async () => {
  const scriptPath = createBootstrapScriptPath();
  const agentSourcePath = createHermesAgentSourcePath();
  const previousScriptEnv = process.env.UFREN_BOOTSTRAP_SCRIPT;
  const previousDistroEnv = process.env.UFREN_WSL_DISTRO;
  const previousAgentPathEnv = process.env.UFREN_HERMES_AGENT_PATH;
  process.env.UFREN_BOOTSTRAP_SCRIPT = scriptPath;
  process.env.UFREN_WSL_DISTRO = "Ubuntu";
  process.env.UFREN_HERMES_AGENT_PATH = agentSourcePath;

  let attempt = 0;
  const runner: ProcessRunner = (_command, args) => {
    if (args[0] === "--status") {
      return Promise.resolve({ exitCode: 0, stdout: "WSL is ready", stderr: "" });
    }
    if (args[0] === "-l" && args[1] === "-v") {
      return Promise.resolve({
        exitCode: 0,
        stdout: "  NAME            STATE           VERSION\n* Ubuntu          Running         2",
        stderr: ""
      });
    }
    if (args[0] === "-l" && args[1] === "-q") {
      return Promise.resolve({ exitCode: 0, stdout: "Ubuntu", stderr: "" });
    }
    if (args[0] === "-NoProfile") {
      attempt += 1;
      if (attempt === 1) {
        return Promise.resolve({ exitCode: 1, stdout: "", stderr: "bootstrap failed once" });
      }
      return Promise.resolve({ exitCode: 0, stdout: "bootstrap ok", stderr: "" });
    }
    return Promise.resolve({
      exitCode: 1,
      stdout: "",
      stderr: `unexpected args: ${args.join(" ")}`
    });
  };

  try {
    const service = new InstallerService(runner);
    const first = await service.start();
    assert.equal(first.ok, false);
    assert.equal(first.context.state, "error");
    const second = await service.retry();
    assert.equal(second.ok, true);
    assert.equal(second.context.state, "ready");
  } finally {
    process.env.UFREN_BOOTSTRAP_SCRIPT = previousScriptEnv;
    process.env.UFREN_WSL_DISTRO = previousDistroEnv;
    process.env.UFREN_HERMES_AGENT_PATH = previousAgentPathEnv;
    rmSync(scriptPath, { force: true });
    rmSync(dirname(scriptPath), { recursive: true, force: true });
    rmSync(agentSourcePath, { recursive: true, force: true });
  }
});

void test("uses legacy WSL commands when --status is unsupported", async () => {
  const scriptPath = createBootstrapScriptPath();
  const agentSourcePath = createHermesAgentSourcePath();
  const previousScriptEnv = process.env.UFREN_BOOTSTRAP_SCRIPT;
  const previousDistroEnv = process.env.UFREN_WSL_DISTRO;
  const previousAgentPathEnv = process.env.UFREN_HERMES_AGENT_PATH;
  process.env.UFREN_BOOTSTRAP_SCRIPT = scriptPath;
  process.env.UFREN_WSL_DISTRO = "Ubuntu";
  process.env.UFREN_HERMES_AGENT_PATH = agentSourcePath;

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
      return Promise.resolve({ exitCode: 0, stdout: "Ubuntu", stderr: "" });
    }
    if (args[0] === "-l" && args[1] === "-v") {
      return Promise.resolve({
        exitCode: 0,
        stdout: "  NAME            STATE           VERSION\n* Ubuntu          Running         2",
        stderr: ""
      });
    }
    if (args[0] === "-NoProfile") {
      return Promise.resolve({ exitCode: 0, stdout: "bootstrap ok", stderr: "" });
    }
    return Promise.resolve({
      exitCode: 1,
      stdout: "",
      stderr: `unexpected args: ${args.join(" ")}`
    });
  };

  try {
    const service = new InstallerService(runner);
    const result = await service.start();
    assert.equal(result.ok, true);
    assert.equal(calls.includes("--install"), false);
    assert.equal(calls.includes("--status"), true);
    assert.equal(calls.includes("-l -q"), true);
  } finally {
    process.env.UFREN_BOOTSTRAP_SCRIPT = previousScriptEnv;
    process.env.UFREN_WSL_DISTRO = previousDistroEnv;
    process.env.UFREN_HERMES_AGENT_PATH = previousAgentPathEnv;
    rmSync(scriptPath, { force: true });
    rmSync(dirname(scriptPath), { recursive: true, force: true });
    rmSync(agentSourcePath, { recursive: true, force: true });
  }
});

void test("surfaces bootstrap stdout logs when powershell exits with failure", async () => {
  const scriptPath = createBootstrapScriptPath();
  const agentSourcePath = createHermesAgentSourcePath();
  const previousScriptEnv = process.env.UFREN_BOOTSTRAP_SCRIPT;
  const previousDistroEnv = process.env.UFREN_WSL_DISTRO;
  const previousAgentPathEnv = process.env.UFREN_HERMES_AGENT_PATH;
  process.env.UFREN_BOOTSTRAP_SCRIPT = scriptPath;
  process.env.UFREN_WSL_DISTRO = "Ubuntu";
  process.env.UFREN_HERMES_AGENT_PATH = agentSourcePath;

  const runner: ProcessRunner = (_command, args) => {
    if (args[0] === "--status") {
      return Promise.resolve({ exitCode: 0, stdout: "WSL is ready", stderr: "" });
    }
    if (args[0] === "-l" && args[1] === "-q") {
      return Promise.resolve({ exitCode: 0, stdout: "Ubuntu", stderr: "" });
    }
    if (args[0] === "-l" && args[1] === "-v") {
      return Promise.resolve({
        exitCode: 0,
        stdout: "  NAME            STATE           VERSION\n* Ubuntu          Running         2",
        stderr: ""
      });
    }
    if (args[0] === "-NoProfile") {
      return Promise.resolve({
        exitCode: 1,
        stdout: "[Ufren Hermes Desktop] Starting runtime bootstrap\n[Ufren Hermes Desktop] [WSL] pip install failed",
        stderr: ""
      });
    }
    return Promise.resolve({
      exitCode: 1,
      stdout: "",
      stderr: `unexpected args: ${args.join(" ")}`
    });
  };

  try {
    const service = new InstallerService(runner);
    const result = await service.start();
    assert.equal(result.ok, false);
    assert.match(result.message, /Starting runtime bootstrap/);
    assert.match(result.message, /pip install failed/);
  } finally {
    process.env.UFREN_BOOTSTRAP_SCRIPT = previousScriptEnv;
    process.env.UFREN_WSL_DISTRO = previousDistroEnv;
    process.env.UFREN_HERMES_AGENT_PATH = previousAgentPathEnv;
    rmSync(scriptPath, { force: true });
    rmSync(dirname(scriptPath), { recursive: true, force: true });
    rmSync(agentSourcePath, { recursive: true, force: true });
  }
});

void test("classifies ensurepip bootstrap failures with actionable guidance", async () => {
  const scriptPath = createBootstrapScriptPath();
  const agentSourcePath = createHermesAgentSourcePath();
  const previousScriptEnv = process.env.UFREN_BOOTSTRAP_SCRIPT;
  const previousDistroEnv = process.env.UFREN_WSL_DISTRO;
  const previousAgentPathEnv = process.env.UFREN_HERMES_AGENT_PATH;
  process.env.UFREN_BOOTSTRAP_SCRIPT = scriptPath;
  process.env.UFREN_WSL_DISTRO = "Ubuntu";
  process.env.UFREN_HERMES_AGENT_PATH = agentSourcePath;

  const runner: ProcessRunner = (_command, args) => {
    if (args[0] === "--status") {
      return Promise.resolve({ exitCode: 0, stdout: "WSL is ready", stderr: "" });
    }
    if (args[0] === "-l" && args[1] === "-q") {
      return Promise.resolve({ exitCode: 0, stdout: "Ubuntu", stderr: "" });
    }
    if (args[0] === "-l" && args[1] === "-v") {
      return Promise.resolve({
        exitCode: 0,
        stdout: "  NAME            STATE           VERSION\n* Ubuntu          Running         2",
        stderr: ""
      });
    }
    if (args[0] === "-NoProfile") {
      return Promise.resolve({
        exitCode: 1,
        stdout:
          "[Ufren Hermes Desktop] [WSL] python3-venv or ensurepip not available in target distro\n" +
          "[Ufren Hermes Desktop] [WSL] Install it with: sudo apt update && sudo apt install -y python3-venv python3-full",
        stderr: ""
      });
    }
    return Promise.resolve({
      exitCode: 1,
      stdout: "",
      stderr: `unexpected args: ${args.join(" ")}`
    });
  };

  try {
    const service = new InstallerService(runner);
    const result = await service.start();
    assert.equal(result.ok, false);
    assert.equal(result.issue?.code, "BOOTSTRAP_FAILED");
    assert.match(result.issue?.suggestion ?? "", /python3-venv/);
    assert.match(result.message, /ensurepip/);
  } finally {
    process.env.UFREN_BOOTSTRAP_SCRIPT = previousScriptEnv;
    process.env.UFREN_WSL_DISTRO = previousDistroEnv;
    process.env.UFREN_HERMES_AGENT_PATH = previousAgentPathEnv;
    rmSync(scriptPath, { force: true });
    rmSync(dirname(scriptPath), { recursive: true, force: true });
    rmSync(agentSourcePath, { recursive: true, force: true });
  }
});

void test("classifies automatic Ubuntu dependency provisioning failures with actionable guidance", async () => {
  const scriptPath = createBootstrapScriptPath();
  const agentSourcePath = createHermesAgentSourcePath();
  const previousScriptEnv = process.env.UFREN_BOOTSTRAP_SCRIPT;
  const previousDistroEnv = process.env.UFREN_WSL_DISTRO;
  const previousAgentPathEnv = process.env.UFREN_HERMES_AGENT_PATH;
  process.env.UFREN_BOOTSTRAP_SCRIPT = scriptPath;
  process.env.UFREN_WSL_DISTRO = "Ubuntu";
  process.env.UFREN_HERMES_AGENT_PATH = agentSourcePath;

  const runner: ProcessRunner = (_command, args) => {
    if (args[0] === "--status") {
      return Promise.resolve({ exitCode: 0, stdout: "WSL is ready", stderr: "" });
    }
    if (args[0] === "-l" && args[1] === "-q") {
      return Promise.resolve({ exitCode: 0, stdout: "Ubuntu", stderr: "" });
    }
    if (args[0] === "-l" && args[1] === "-v") {
      return Promise.resolve({
        exitCode: 0,
        stdout: "  NAME            STATE           VERSION\n* Ubuntu          Running         2",
        stderr: ""
      });
    }
    if (args[0] === "-NoProfile") {
      return Promise.resolve({
        exitCode: 1,
        stdout:
          "[Ufren Hermes Desktop] [WSL] [step] Installing Ubuntu Python runtime dependencies\n" +
          "[Ufren Hermes Desktop] [WSL] Failed to install required Ubuntu packages: python3 python3-venv python3-full ca-certificates",
        stderr: ""
      });
    }
    return Promise.resolve({
      exitCode: 1,
      stdout: "",
      stderr: `unexpected args: ${args.join(" ")}`
    });
  };

  try {
    const service = new InstallerService(runner);
    const result = await service.start();
    assert.equal(result.ok, false);
    assert.equal(result.issue?.code, "BOOTSTRAP_FAILED");
    assert.match(result.issue?.suggestion ?? "", /package sources/i);
    assert.match(result.message, /Failed to install required Ubuntu packages/);
  } finally {
    process.env.UFREN_BOOTSTRAP_SCRIPT = previousScriptEnv;
    process.env.UFREN_WSL_DISTRO = previousDistroEnv;
    process.env.UFREN_HERMES_AGENT_PATH = previousAgentPathEnv;
    rmSync(scriptPath, { force: true });
    rmSync(dirname(scriptPath), { recursive: true, force: true });
    rmSync(agentSourcePath, { recursive: true, force: true });
  }
});
