export const runtimeStatusValues = [
  "not_installed",
  "installing",
  "stopped",
  "starting",
  "running",
  "degraded",
  "error"
] as const;

export type RuntimeStatus = (typeof runtimeStatusValues)[number];

export interface RuntimeHealth {
  status: RuntimeStatus;
  endpoint: string;
  lastCheckedAt: string;
  detail?: string;
}

export interface RuntimeActionResult {
  ok: boolean;
  message: string;
}

export interface DashboardHealth {
  status: RuntimeStatus;
  url: string;
  lastCheckedAt: string;
  detail?: string;
}

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  systemPrompt?: string;
  model?: string;
}

export interface ChatTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ChatCompletionResponse {
  message: string;
  model: string;
  responseId?: string;
  usage?: ChatTokenUsage;
}
