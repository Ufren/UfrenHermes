import type {
  AppLogsRequestDto,
  AppLogsResponseDto,
  ChatCompletionRequestDto,
  ChatCompletionResponseDto,
  DashboardHealthDto,
  InstallerActionResultDto,
  InstallerContextDto,
  InstallerTraceResponseDto,
  RuntimeActionResultDto,
  RuntimeHealthDto,
  RuntimeLogsRequestDto,
  RuntimeProbeRequestDto,
  RuntimeProbeResponseDto,
  RuntimeStatus
} from "@ufren/shared";

export interface DesktopApi {
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

declare global {
  interface Window {
    ufrenDesktopApi: DesktopApi;
  }
}

export {};
