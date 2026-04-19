import type {
  RuntimeActionResultDto,
  RuntimeHealthDto,
  RuntimeProbeResponseDto,
  RuntimeStatus
} from "@ufren/shared";

interface RuntimeBridgeApi {
  runtimeStatus: () => Promise<RuntimeStatus>;
  runtimeStart: () => Promise<RuntimeActionResultDto>;
  runtimeStop: () => Promise<RuntimeActionResultDto>;
  runtimeHealth: () => Promise<RuntimeHealthDto>;
  runtimeLogs: (payload?: { lines?: number }) => Promise<string>;
  runtimeProbe: (payload?: { path?: string; timeoutMs?: number }) => Promise<RuntimeProbeResponseDto>;
}

function getDesktopApi(): RuntimeBridgeApi {
  if (!Object.hasOwn(window, "ufrenDesktopApi")) {
    throw new Error("Desktop API bridge is unavailable");
  }
  return window.ufrenDesktopApi as RuntimeBridgeApi;
}

export async function fetchRuntimeStatus(): Promise<RuntimeStatus> {
  return await getDesktopApi().runtimeStatus();
}

export async function startRuntime(): Promise<RuntimeActionResultDto> {
  return await getDesktopApi().runtimeStart();
}

export async function stopRuntime(): Promise<RuntimeActionResultDto> {
  return await getDesktopApi().runtimeStop();
}

export async function fetchRuntimeHealth(): Promise<RuntimeHealthDto> {
  return await getDesktopApi().runtimeHealth();
}

export async function fetchRuntimeLogs(lines = 200): Promise<string> {
  return await getDesktopApi().runtimeLogs({ lines });
}

export async function probeRuntime(path = "/health", timeoutMs = 5000): Promise<RuntimeProbeResponseDto> {
  return await getDesktopApi().runtimeProbe({ path, timeoutMs });
}
