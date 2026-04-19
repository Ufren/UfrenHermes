import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runProcess } from "@ufren/runtime-sdk";

export async function syncRuntimeShellScripts(
  distribution: string,
  runtimeHome: string
): Promise<void> {
  const syncScriptPath = resolveSyncRuntimeScriptsPath();
  const wslScriptSourcePath = resolveWslScriptSourcePath();
  const result = await runProcess(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      syncScriptPath,
      "-Distribution",
      distribution,
      "-RuntimeScriptsRoot",
      runtimeHome,
      "-SourceWindowsPath",
      wslScriptSourcePath
    ],
    {
      timeoutMs: 30_000
    }
  );

  if (result.exitCode !== 0) {
    const detail = result.stderr || result.stdout || "Unknown sync failure";
    throw new Error(detail);
  }
}

function resolveSyncRuntimeScriptsPath(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(currentDir, "..", "..", "..", "resources", "powershell", "sync-runtime-scripts.ps1"),
    join(process.resourcesPath, "powershell", "sync-runtime-scripts.ps1")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to locate runtime script sync helper");
}

function resolveWslScriptSourcePath(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(currentDir, "..", "..", "..", "resources", "wsl"),
    join(process.resourcesPath, "wsl")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to locate WSL runtime scripts");
}
