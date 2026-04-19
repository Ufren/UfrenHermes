import type { RuntimeActionResult, RuntimeHealth, RuntimeStatus } from "@ufren/shared";
import { ufrenBrand } from "@ufren/shared";

import { WslExecutor } from "../wsl/wsl-executor.js";

export interface RuntimeManagerOptions {
  distribution: string;
  healthEndpoint: string;
  runtimeHome: string;
}

export class HermesRuntimeManager {
  private readonly wslExecutor: WslExecutor;
  private readonly options: RuntimeManagerOptions;

  public constructor(options: RuntimeManagerOptions, wslExecutor = new WslExecutor()) {
    this.options = options;
    this.wslExecutor = wslExecutor;
  }

  public async getStatus(): Promise<RuntimeStatus> {
    await this.wslExecutor.ensureWslAvailable();
    const distributions = await this.wslExecutor.listDistributions();
    const distroFound = distributions.includes(this.options.distribution);
    if (!distroFound) {
      return "not_installed";
    }

    try {
      const status = await this.wslExecutor.runBash(
        `bash "${this.options.runtimeHome}/status-hermes.sh"`,
        {
          distribution: this.options.distribution,
          timeoutMs: 10_000
        }
      );
      const normalized = status.trim();
      if (normalized === "running") {
        return "running";
      }
      if (normalized === "starting") {
        return "starting";
      }
      if (normalized === "degraded") {
        return "degraded";
      }
      return "stopped";
    } catch {
      return "error";
    }
  }

  public async start(): Promise<RuntimeActionResult> {
    await this.wslExecutor.runBash(`bash "${this.options.runtimeHome}/start-hermes.sh"`, {
      distribution: this.options.distribution,
      timeoutMs: 25_000
    });

    const startupDeadline = Date.now() + 20_000;
    let latestHealth = await this.health();
    while (latestHealth.status === "starting" && Date.now() < startupDeadline) {
      await this.sleep(1000);
      latestHealth = await this.health();
    }

    if (latestHealth.status === "running") {
      return {
        ok: true,
        message: `${ufrenBrand.productName} runtime started`
      };
    }

    if (latestHealth.status === "starting") {
      return {
        ok: true,
        message: `${ufrenBrand.productName} runtime is starting`
      };
    }

    return {
      ok: false,
      message: latestHealth.detail ?? `${ufrenBrand.productName} runtime failed to start`
    };
  }

  public async stop(): Promise<RuntimeActionResult> {
    await this.wslExecutor.runBash(`bash "${this.options.runtimeHome}/stop-hermes.sh"`, {
      distribution: this.options.distribution
    });
    return {
      ok: true,
      message: `${ufrenBrand.productName} runtime stopped`
    };
  }

  public async health(): Promise<RuntimeHealth> {
    const status = await this.getStatus();
    if (status === "running" || status === "starting") {
      const endpointHealthy = await this.probeHealthEndpoint();
      if (endpointHealthy) {
        return {
          status: "running",
          endpoint: this.options.healthEndpoint,
          lastCheckedAt: new Date().toISOString(),
          detail: `${ufrenBrand.productName} runtime healthy`
        };
      }
      if (status === "running") {
        return {
          status: "degraded",
          endpoint: this.options.healthEndpoint,
          lastCheckedAt: new Date().toISOString(),
          detail: this.describeHealthStatus(status)
        };
      }
    }

    return {
      status,
      endpoint: this.options.healthEndpoint,
      lastCheckedAt: new Date().toISOString(),
      detail: this.describeHealthStatus(status)
    };
  }

  public async tailLogs(lines: number): Promise<string> {
    const safeLines = Number.isInteger(lines) ? Math.max(10, Math.min(lines, 2000)) : 200;
    return await this.wslExecutor.runBash(
      `bash "${this.options.runtimeHome}/tail-hermes-log.sh" ${safeLines}`,
      {
        distribution: this.options.distribution
      }
    );
  }

  private describeHealthStatus(status: RuntimeStatus): string {
    switch (status) {
      case "not_installed":
        return `${ufrenBrand.productName} runtime is not installed`;
      case "installing":
        return `${ufrenBrand.productName} runtime installation is in progress`;
      case "stopped":
        return `${ufrenBrand.productName} runtime is installed but not started`;
      case "starting":
        return `${ufrenBrand.productName} runtime is starting and the API endpoint is not ready yet`;
      case "degraded":
        return `${ufrenBrand.productName} runtime process exited unexpectedly or the runtime state is stale`;
      case "error":
        return `Unable to determine ${ufrenBrand.productName} runtime status`;
      case "running":
        return `${ufrenBrand.productName} runtime process is running, but the API health endpoint is unavailable`;
      default:
        return "Runtime status unavailable";
    }
  }

  private async probeHealthEndpoint(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 3000);

    try {
      const response = await fetch(this.options.healthEndpoint, {
        method: "GET",
        signal: controller.signal,
        headers: {
          accept: "application/json,text/plain,*/*"
        }
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
