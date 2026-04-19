import { HermesRuntimeManager } from "@ufren/runtime-sdk";
import type {
  RuntimeActionResult,
  RuntimeHealth,
  RuntimeProbeRequestDto,
  RuntimeProbeResponseDto,
  RuntimeStatus
} from "@ufren/shared";

import { createLogger } from "../logging/logger.js";
import { syncRuntimeShellScripts } from "./runtime-script-sync.js";

const defaultRuntimeHome = "$HOME/.local/share/ufren-hermes/runtime/scripts";
const runtimeLogger = createLogger("runtime-service");

export class RuntimeService {
  private readonly manager: HermesRuntimeManager;
  private readonly distribution: string;
  private readonly healthEndpoint: string;
  private readonly runtimeHome: string;
  private runtimeScriptsSynced = false;

  public constructor() {
    this.distribution = process.env.UFREN_WSL_DISTRO ?? "Ubuntu";
    this.healthEndpoint = process.env.UFREN_HEALTH_ENDPOINT ?? "http://127.0.0.1:8642/health";
    this.runtimeHome = process.env.UFREN_RUNTIME_HOME ?? defaultRuntimeHome;
    this.manager = new HermesRuntimeManager({
      distribution: this.distribution,
      healthEndpoint: this.healthEndpoint,
      runtimeHome: this.runtimeHome
    });
    runtimeLogger.info("Runtime service initialized", {
      distribution: this.distribution,
      healthEndpoint: this.healthEndpoint,
      runtimeHome: this.runtimeHome
    });
  }

  public async getStatus(): Promise<RuntimeStatus> {
    await this.trySyncRuntimeScripts();
    const status = await this.manager.getStatus();
    runtimeLogger.debug("Runtime status fetched", { status });
    return status;
  }

  public async start(): Promise<RuntimeActionResult> {
    runtimeLogger.info("Runtime start requested");
    await this.trySyncRuntimeScripts(true);
    const result = await this.manager.start();
    runtimeLogger.info("Runtime start finished", {
      ok: result.ok,
      message: result.message
    });
    return result;
  }

  public async stop(): Promise<RuntimeActionResult> {
    runtimeLogger.info("Runtime stop requested");
    await this.trySyncRuntimeScripts(true);
    const result = await this.manager.stop();
    runtimeLogger.info("Runtime stop finished", {
      ok: result.ok,
      message: result.message
    });
    return result;
  }

  public async getHealth(): Promise<RuntimeHealth> {
    await this.trySyncRuntimeScripts();
    const health = await this.manager.health();
    runtimeLogger.debug("Runtime health fetched", {
      status: health.status,
      endpoint: health.endpoint,
      lastCheckedAt: health.lastCheckedAt,
      detail: health.detail
    });
    return health;
  }

  public async getLogs(lines: number): Promise<string> {
    runtimeLogger.debug("Runtime logs requested", { lines });
    await this.trySyncRuntimeScripts();
    return await this.manager.tailLogs(lines);
  }

  public async probeRuntime(payload: RuntimeProbeRequestDto): Promise<RuntimeProbeResponseDto> {
    const endpoint = this.resolveProbeEndpoint(payload.path);
    const startedAt = Date.now();
    const timeoutMs = payload.timeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        signal: controller.signal,
        headers: {
          accept: "application/json,text/plain,*/*"
        }
      });
      const text = await response.text();
      runtimeLogger.debug("Runtime probe completed", {
        endpoint,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        ok: response.ok
      });
      return {
        ok: response.ok,
        endpoint,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
        bodySnippet: text.slice(0, 320),
        error: response.ok ? undefined : `Probe failed with status ${response.status}`
      };
    } catch (error) {
      runtimeLogger.warn("Runtime probe failed", {
        endpoint,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        ok: false,
        endpoint,
        statusCode: 0,
        durationMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Runtime probe request failed"
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private resolveProbeEndpoint(path?: string): string {
    if (!path?.trim()) {
      return this.healthEndpoint;
    }
    return new URL(path, this.healthEndpoint).toString();
  }

  private async trySyncRuntimeScripts(force = false): Promise<void> {
    if (this.runtimeScriptsSynced && !force) {
      return;
    }

    try {
      await this.syncRuntimeScripts();
      this.runtimeScriptsSynced = true;
    } catch (error) {
      runtimeLogger.warn("Failed to synchronize runtime shell scripts", {
        distribution: this.distribution,
        runtimeHome: this.runtimeHome,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async syncRuntimeScripts(): Promise<void> {
    await syncRuntimeShellScripts(this.distribution, this.runtimeHome);
    runtimeLogger.debug("Runtime shell scripts synchronized", {
      distribution: this.distribution,
      runtimeHome: this.runtimeHome
    });
  }
}
