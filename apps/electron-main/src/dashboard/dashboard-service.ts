import { WslExecutor } from "@ufren/runtime-sdk";
import type { DashboardHealth, RuntimeActionResult, RuntimeStatus } from "@ufren/shared";
import { ufrenBrand } from "@ufren/shared";

import { createLogger } from "../logging/logger.js";
import { syncRuntimeShellScripts } from "../runtime/runtime-script-sync.js";

const defaultRuntimeHome = "$HOME/.local/share/ufren-hermes/runtime/scripts";
const dashboardLogger = createLogger("dashboard-service");

export class DashboardService {
  private readonly wslExecutor: WslExecutor;
  private readonly distribution: string;
  private readonly runtimeHome: string;
  private readonly dashboardUrl: string;
  private readonly dashboardApiUrl: string;
  private runtimeScriptsSynced = false;

  public constructor(wslExecutor = new WslExecutor()) {
    this.wslExecutor = wslExecutor;
    this.distribution = process.env.UFREN_WSL_DISTRO ?? "Ubuntu";
    this.runtimeHome = process.env.UFREN_RUNTIME_HOME ?? defaultRuntimeHome;
    this.dashboardUrl = process.env.UFREN_DASHBOARD_URL ?? "http://127.0.0.1:9119";
    this.dashboardApiUrl =
      process.env.UFREN_DASHBOARD_HEALTH_URL ?? new URL("/api/status", this.dashboardUrl).toString();

    dashboardLogger.info("Dashboard service initialized", {
      distribution: this.distribution,
      runtimeHome: this.runtimeHome,
      dashboardUrl: this.dashboardUrl,
      dashboardApiUrl: this.dashboardApiUrl
    });
  }

  public async getHealth(): Promise<DashboardHealth> {
    await this.trySyncRuntimeScripts();
    const status = await this.getStatus();
    if (status === "running" || status === "starting") {
      const endpointHealthy = await this.probeDashboardEndpoint();
      if (endpointHealthy) {
        return {
          status: "running",
          url: this.dashboardUrl,
          lastCheckedAt: new Date().toISOString(),
          detail: `${ufrenBrand.productName} dashboard ready`
        };
      }
      if (status === "running") {
        return {
          status: "degraded",
          url: this.dashboardUrl,
          lastCheckedAt: new Date().toISOString(),
          detail: `${ufrenBrand.productName} dashboard process is running, but the web endpoint is unavailable`
        };
      }
    }

    return {
      status,
      url: this.dashboardUrl,
      lastCheckedAt: new Date().toISOString(),
      detail: this.describeHealthStatus(status)
    };
  }

  public async start(): Promise<RuntimeActionResult> {
    dashboardLogger.info("Dashboard start requested");
    await this.trySyncRuntimeScripts(true);
    await this.wslExecutor.runBash(`bash "${this.runtimeHome}/start-hermes-dashboard.sh"`, {
      distribution: this.distribution,
      timeoutMs: 25_000
    });

    const startupDeadline = Date.now() + 20_000;
    let latestHealth = await this.getHealth();
    while (latestHealth.status === "starting" && Date.now() < startupDeadline) {
      await this.sleep(1000);
      latestHealth = await this.getHealth();
    }

    if (latestHealth.status === "running") {
      return {
        ok: true,
        message: `${ufrenBrand.productName} dashboard started`
      };
    }

    if (latestHealth.status === "starting") {
      return {
        ok: true,
        message: `${ufrenBrand.productName} dashboard is starting`
      };
    }

    return {
      ok: false,
      message: latestHealth.detail ?? `${ufrenBrand.productName} dashboard failed to start`
    };
  }

  public async stop(): Promise<RuntimeActionResult> {
    dashboardLogger.info("Dashboard stop requested");
    await this.trySyncRuntimeScripts(true);
    await this.wslExecutor.runBash(`bash "${this.runtimeHome}/stop-hermes-dashboard.sh"`, {
      distribution: this.distribution
    });
    return {
      ok: true,
      message: `${ufrenBrand.productName} dashboard stopped`
    };
  }

  private async getStatus(): Promise<RuntimeStatus> {
    await this.trySyncRuntimeScripts();
    await this.wslExecutor.ensureWslAvailable();
    const distributions = await this.wslExecutor.listDistributions();
    if (!distributions.includes(this.distribution)) {
      return "not_installed";
    }

    try {
      const status = await this.wslExecutor.runBash(
        `bash "${this.runtimeHome}/status-hermes-dashboard.sh"`,
        {
          distribution: this.distribution,
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

  private async probeDashboardEndpoint(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 3000);

    try {
      const apiResponse = await fetch(this.dashboardApiUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          accept: "application/json,text/plain,*/*"
        }
      });
      if (!apiResponse.ok) {
        return false;
      }

      const response = await fetch(this.dashboardUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml"
        }
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async trySyncRuntimeScripts(force = false): Promise<void> {
    if (this.runtimeScriptsSynced && !force) {
      return;
    }

    try {
      await syncRuntimeShellScripts(this.distribution, this.runtimeHome);
      this.runtimeScriptsSynced = true;
      dashboardLogger.debug("Dashboard runtime shell scripts synchronized", {
        distribution: this.distribution,
        runtimeHome: this.runtimeHome
      });
    } catch (error) {
      dashboardLogger.warn("Failed to synchronize dashboard shell scripts", {
        distribution: this.distribution,
        runtimeHome: this.runtimeHome,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private describeHealthStatus(status: RuntimeStatus): string {
    switch (status) {
      case "not_installed":
        return `${ufrenBrand.productName} runtime is not installed`;
      case "installing":
        return `${ufrenBrand.productName} runtime installation is in progress`;
      case "stopped":
        return `${ufrenBrand.productName} dashboard is stopped`;
      case "starting":
        return `${ufrenBrand.productName} dashboard is starting`;
      case "degraded":
        return `${ufrenBrand.productName} dashboard process exited unexpectedly or the dashboard state is stale`;
      case "error":
        return `Unable to determine ${ufrenBrand.productName} dashboard status`;
      case "running":
        return `${ufrenBrand.productName} dashboard is running`;
      default:
        return "Dashboard status unavailable";
    }
  }
}
