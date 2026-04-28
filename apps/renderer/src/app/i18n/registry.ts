import type { AppLocale } from "./shared.js";
import { appMessages } from "./app.js";
import { chatConsoleMessages } from "./chat.js";
import { dashboardMessages } from "./dashboard.js";
import { installerMessages } from "./installer.js";
import { runtimeMessages } from "./runtime.js";
import { workspaceMessages } from "./workspace.js";

export const messageRegistry = {
  app: appMessages,
  chat: chatConsoleMessages,
  dashboard: dashboardMessages,
  installer: installerMessages,
  runtime: runtimeMessages,
  workspace: workspaceMessages
} as const;

export type MessageNamespace = keyof typeof messageRegistry;

export function getMessages<N extends MessageNamespace>(namespace: N, locale: AppLocale) {
  return messageRegistry[namespace][locale];
}
