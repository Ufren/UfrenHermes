import { ipcMain } from "electron";

import {
  installerActionResultSchema,
  installerContextSchema,
  installerTraceResponseSchema,
  ipcChannels
} from "@ufren/shared";

import type { InstallerService } from "../installer/installer-service.js";

export function registerInstallerHandlers(installerService: InstallerService): void {
  ipcMain.handle(ipcChannels.installerStatus, () => {
    const context = installerService.getContext();
    return installerContextSchema.parse(context);
  });

  ipcMain.handle(ipcChannels.installerStart, async () => {
    const result = await installerService.start();
    return installerActionResultSchema.parse(result);
  });

  ipcMain.handle(ipcChannels.installerRetry, async () => {
    const result = await installerService.retry();
    return installerActionResultSchema.parse(result);
  });

  ipcMain.handle(ipcChannels.installerTrace, () => {
    const entries = installerService.getExecutionTrace();
    return installerTraceResponseSchema.parse({ entries });
  });
}
