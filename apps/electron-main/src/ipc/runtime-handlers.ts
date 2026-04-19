import { ipcMain } from "electron";

import {
  ipcChannels,
  runtimeActionResultSchema,
  runtimeHealthSchema,
  runtimeLogsRequestSchema,
  runtimeLogsResponseSchema,
  runtimeProbeRequestSchema,
  runtimeProbeResponseSchema
} from "@ufren/shared";

import type { RuntimeService } from "../runtime/runtime-service.js";

export function registerRuntimeHandlers(runtimeService: RuntimeService): void {
  ipcMain.handle(ipcChannels.runtimeStatus, async () => {
    return await runtimeService.getStatus();
  });

  ipcMain.handle(ipcChannels.runtimeStart, async () => {
    const result = await runtimeService.start();
    return runtimeActionResultSchema.parse(result);
  });

  ipcMain.handle(ipcChannels.runtimeStop, async () => {
    const result = await runtimeService.stop();
    return runtimeActionResultSchema.parse(result);
  });

  ipcMain.handle(ipcChannels.runtimeHealth, async () => {
    const health = await runtimeService.getHealth();
    return runtimeHealthSchema.parse(health);
  });

  ipcMain.handle(ipcChannels.runtimeLogs, async (_, payload: unknown) => {
    const request = runtimeLogsRequestSchema.parse(payload ?? {});
    const content = await runtimeService.getLogs(request.lines);
    return runtimeLogsResponseSchema.parse({ content });
  });

  ipcMain.handle(ipcChannels.runtimeProbe, async (_, payload: unknown) => {
    const request = runtimeProbeRequestSchema.parse(payload ?? {});
    const probe = await runtimeService.probeRuntime(request);
    return runtimeProbeResponseSchema.parse(probe);
  });
}
