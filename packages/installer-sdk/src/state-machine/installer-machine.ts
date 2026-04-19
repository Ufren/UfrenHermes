export const installerStateValues = [
  "idle",
  "checking_prerequisites",
  "installing_wsl",
  "installing_ubuntu",
  "bootstrapping_runtime",
  "finalizing",
  "ready",
  "error"
] as const;

export type InstallerState = (typeof installerStateValues)[number];

export interface InstallerContext {
  state: InstallerState;
  lastError?: string;
}

export type InstallerEvent =
  | { type: "START" }
  | { type: "NEXT" }
  | { type: "FAIL"; message: string }
  | { type: "RESET" };

const transitionMap: Record<InstallerState, InstallerState | null> = {
  idle: "checking_prerequisites",
  checking_prerequisites: "installing_wsl",
  installing_wsl: "installing_ubuntu",
  installing_ubuntu: "bootstrapping_runtime",
  bootstrapping_runtime: "finalizing",
  finalizing: "ready",
  ready: null,
  error: null
};

export function reduceInstallerState(
  context: InstallerContext,
  event: InstallerEvent
): InstallerContext {
  if (event.type === "RESET") {
    return { state: "idle" };
  }
  if (event.type === "FAIL") {
    return { state: "error", lastError: event.message };
  }
  if (event.type === "START" && context.state === "idle") {
    return { state: "checking_prerequisites" };
  }
  if (event.type === "NEXT") {
    const next = transitionMap[context.state];
    if (next) {
      return { state: next };
    }
  }
  return context;
}
