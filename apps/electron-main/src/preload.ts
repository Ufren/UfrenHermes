import { contextBridge, ipcRenderer } from "electron";

import {
  appLogsResponseSchema,
  appLogsRequestSchema,
  chatCompletionRequestSchema,
  chatCompletionResponseSchema,
  dashboardHealthSchema,
  installerActionResultSchema,
  installerContextSchema,
  installerTraceResponseSchema,
  ipcChannels,
  runtimeActionResultSchema,
  runtimeHealthSchema,
  runtimeLogsResponseSchema,
  runtimeProbeResponseSchema,
  runtimeStatusSchema,
  type InstallerActionResultDto,
  type AppLogsRequestDto,
  type AppLogsResponseDto,
  type ChatCompletionRequestDto,
  type ChatCompletionResponseDto,
  type DashboardHealthDto,
  type InstallerContextDto,
  type InstallerTraceResponseDto,
  type RuntimeActionResultDto,
  type RuntimeHealthDto,
  type RuntimeLogsRequestDto,
  type RuntimeProbeRequestDto,
  type RuntimeProbeResponseDto,
  type RuntimeStatus
} from "@ufren/shared";

interface UfrenDesktopApi {
  installerStatus: () => Promise<InstallerContextDto>;
  installerStart: () => Promise<InstallerActionResultDto>;
  installerRetry: () => Promise<InstallerActionResultDto>;
  installerTrace: () => Promise<InstallerTraceResponseDto>;
  onInstallerContextChanged: (listener: (context: InstallerContextDto) => void) => () => void;
  runtimeStatus: () => Promise<RuntimeStatus>;
  runtimeStart: () => Promise<RuntimeActionResultDto>;
  runtimeStop: () => Promise<RuntimeActionResultDto>;
  runtimeHealth: () => Promise<RuntimeHealthDto>;
  runtimeLogs: (payload?: Partial<RuntimeLogsRequestDto>) => Promise<string>;
  runtimeProbe: (payload?: Partial<RuntimeProbeRequestDto>) => Promise<RuntimeProbeResponseDto>;
  dashboardHealth: () => Promise<DashboardHealthDto>;
  dashboardStart: () => Promise<RuntimeActionResultDto>;
  dashboardStop: () => Promise<RuntimeActionResultDto>;
  chatComplete: (payload: ChatCompletionRequestDto) => Promise<ChatCompletionResponseDto>;
  appLogs: (payload?: Partial<AppLogsRequestDto>) => Promise<AppLogsResponseDto>;
  windowMinimize: () => Promise<void>;
  windowMaximizeToggle: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
}

const api: UfrenDesktopApi = {
  installerStatus: async () => {
    const response: unknown = await ipcRenderer.invoke(ipcChannels.installerStatus);
    return installerContextSchema.parse(response);
  },
  installerStart: async () => {
    const response: unknown = await ipcRenderer.invoke(ipcChannels.installerStart);
    return installerActionResultSchema.parse(response);
  },
  installerRetry: async () => {
    const response: unknown = await ipcRenderer.invoke(ipcChannels.installerRetry);
    return installerActionResultSchema.parse(response);
  },
  installerTrace: async () => {
    const response: unknown = await ipcRenderer.invoke(ipcChannels.installerTrace);
    return installerTraceResponseSchema.parse(response);
  },
  onInstallerContextChanged: (listener) => {
    const callback = (_event: unknown, payload: unknown) => {
      listener(installerContextSchema.parse(payload));
    };
    ipcRenderer.on(ipcChannels.installerContextChanged, callback);
    return () => {
      ipcRenderer.off(ipcChannels.installerContextChanged, callback);
    };
  },
  runtimeStatus: async () => {
    const response: unknown = await ipcRenderer.invoke(ipcChannels.runtimeStatus);
    return runtimeStatusSchema.parse(response);
  },
  runtimeStart: async () => {
    const response: unknown = await ipcRenderer.invoke(ipcChannels.runtimeStart);
    return runtimeActionResultSchema.parse(response);
  },
  runtimeStop: async () => {
    const response: unknown = await ipcRenderer.invoke(ipcChannels.runtimeStop);
    return runtimeActionResultSchema.parse(response);
  },
  runtimeHealth: async () => {
    const response: unknown = await ipcRenderer.invoke(ipcChannels.runtimeHealth);
    return runtimeHealthSchema.parse(response);
  },
  runtimeLogs: async (payload) => {
    const response: unknown = await ipcRenderer.invoke(
      ipcChannels.runtimeLogs,
      payload ?? {}
    );
    return runtimeLogsResponseSchema.parse(response).content;
  },
  runtimeProbe: async (payload) => {
    const response: unknown = await ipcRenderer.invoke(
      ipcChannels.runtimeProbe,
      payload ?? {}
    );
    return runtimeProbeResponseSchema.parse(response);
  },
  dashboardHealth: async () => {
    const response: unknown = await ipcRenderer.invoke(ipcChannels.dashboardHealth);
    return dashboardHealthSchema.parse(response);
  },
  dashboardStart: async () => {
    const response: unknown = await ipcRenderer.invoke(ipcChannels.dashboardStart);
    return runtimeActionResultSchema.parse(response);
  },
  dashboardStop: async () => {
    const response: unknown = await ipcRenderer.invoke(ipcChannels.dashboardStop);
    return runtimeActionResultSchema.parse(response);
  },
  chatComplete: async (payload) => {
    const request = chatCompletionRequestSchema.parse(payload);
    const response: unknown = await ipcRenderer.invoke(ipcChannels.chatComplete, request);
    return chatCompletionResponseSchema.parse(response);
  },
  appLogs: async (payload) => {
    const request = appLogsRequestSchema.parse(payload ?? {});
    const response: unknown = await ipcRenderer.invoke(ipcChannels.appLogs, request);
    return appLogsResponseSchema.parse(response);
  },
  windowMinimize: async () => {
    await ipcRenderer.invoke(ipcChannels.windowMinimize);
  },
  windowMaximizeToggle: async () => {
    const response: unknown = await ipcRenderer.invoke(ipcChannels.windowMaximizeToggle);
    if (typeof response !== "boolean") {
      throw new TypeError("Window maximize toggle response must be a boolean");
    }
    return response;
  },
  windowClose: async () => {
    await ipcRenderer.invoke(ipcChannels.windowClose);
  },
  openExternal: async (url: string) => {
    await ipcRenderer.invoke(ipcChannels.openExternal, url);
  }
};

contextBridge.exposeInMainWorld("ufrenDesktopApi", api);
