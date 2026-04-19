import { ipcMain } from "electron";

import {
  dashboardHealthSchema,
  ipcChannels,
  runtimeActionResultSchema
} from "@ufren/shared";

import type { DashboardService } from "../dashboard/dashboard-service.js";

export function registerDashboardHandlers(dashboardService: DashboardService): void {
  ipcMain.handle(ipcChannels.dashboardHealth, async () => {
    const health = await dashboardService.getHealth();
    return dashboardHealthSchema.parse(health);
  });

  ipcMain.handle(ipcChannels.dashboardStart, async () => {
    const result = await dashboardService.start();
    return runtimeActionResultSchema.parse(result);
  });

  ipcMain.handle(ipcChannels.dashboardStop, async () => {
    const result = await dashboardService.stop();
    return runtimeActionResultSchema.parse(result);
  });
}
