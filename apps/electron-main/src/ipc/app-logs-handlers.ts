import { ipcMain } from "electron";

import { appLogsRequestSchema, appLogsResponseSchema, ipcChannels } from "@ufren/shared";

import { readAppLogs } from "../logging/logger.js";

export function registerAppLogsHandlers(): void {
  ipcMain.handle(ipcChannels.appLogs, async (_, payload: unknown) => {
    const request = appLogsRequestSchema.parse(payload ?? {});
    const snapshot = await readAppLogs(request.lines);
    return appLogsResponseSchema.parse(snapshot);
  });
}

