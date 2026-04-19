import { z } from "zod";

import { installerIssueCodeValues, installerStateValues } from "../types/installer.js";
import { runtimeStatusValues } from "../types/runtime.js";

export const runtimeStatusSchema = z.enum(runtimeStatusValues);

export const runtimeHealthSchema = z.object({
  status: runtimeStatusSchema,
  endpoint: z.string().min(1),
  lastCheckedAt: z.string().datetime(),
  detail: z.string().optional()
});

export const runtimeActionResultSchema = z.object({
  ok: z.boolean(),
  message: z.string().min(1)
});

export const dashboardHealthSchema = z.object({
  status: runtimeStatusSchema,
  url: z.string().min(1),
  lastCheckedAt: z.string().datetime(),
  detail: z.string().optional()
});

export const runtimeLogsRequestSchema = z.object({
  lines: z.number().int().min(10).max(2000).default(200)
});

export const runtimeLogsResponseSchema = z.object({
  content: z.string()
});

export const appLogsRequestSchema = z.object({
  lines: z.number().int().min(10).max(2000).default(200)
});

export const appLogsResponseSchema = z.object({
  content: z.string(),
  filePath: z.string().optional()
});

export const runtimeProbeRequestSchema = z.object({
  path: z.string().optional(),
  timeoutMs: z.number().int().min(500).max(20_000).default(5000)
});

export const runtimeProbeResponseSchema = z.object({
  ok: z.boolean(),
  endpoint: z.string().min(1),
  statusCode: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  checkedAt: z.string().datetime(),
  bodySnippet: z.string().optional(),
  error: z.string().optional()
});

export const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string()
});

export const chatCompletionRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  systemPrompt: z.string().optional(),
  model: z.string().min(1).optional()
});

export const chatTokenUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional()
});

export const chatCompletionResponseSchema = z.object({
  message: z.string(),
  model: z.string().min(1),
  responseId: z.string().optional(),
  usage: chatTokenUsageSchema.optional()
});

export const installerContextSchema = z.object({
  state: z.enum(installerStateValues),
  lastError: z.string().optional()
});

export const installerActionResultSchema = z.object({
  ok: z.boolean(),
  message: z.string().min(1),
  context: installerContextSchema,
  issue: z
    .object({
      code: z.enum(installerIssueCodeValues),
      retryable: z.boolean(),
      requiresReboot: z.boolean(),
      requiresAdmin: z.boolean(),
      suggestion: z.string().optional(),
      detail: z.string().optional()
    })
    .optional()
});

export const installerTraceEntrySchema = z.object({
  at: z.string().datetime(),
  stage: z.enum(installerStateValues),
  command: z.string().min(1),
  args: z.array(z.string()),
  exitCode: z.number().int(),
  durationMs: z.number().nonnegative(),
  stdoutSnippet: z.string(),
  stderrSnippet: z.string()
});

export const installerTraceResponseSchema = z.object({
  entries: z.array(installerTraceEntrySchema)
});

export type RuntimeHealthDto = z.infer<typeof runtimeHealthSchema>;
export type RuntimeActionResultDto = z.infer<typeof runtimeActionResultSchema>;
export type DashboardHealthDto = z.infer<typeof dashboardHealthSchema>;
export type RuntimeLogsRequestDto = z.infer<typeof runtimeLogsRequestSchema>;
export type RuntimeLogsResponseDto = z.infer<typeof runtimeLogsResponseSchema>;
export type AppLogsRequestDto = z.infer<typeof appLogsRequestSchema>;
export type AppLogsResponseDto = z.infer<typeof appLogsResponseSchema>;
export type RuntimeProbeRequestDto = z.infer<typeof runtimeProbeRequestSchema>;
export type RuntimeProbeResponseDto = z.infer<typeof runtimeProbeResponseSchema>;
export type ChatMessageDto = z.infer<typeof chatMessageSchema>;
export type ChatCompletionRequestDto = z.infer<typeof chatCompletionRequestSchema>;
export type ChatCompletionResponseDto = z.infer<typeof chatCompletionResponseSchema>;
export type InstallerContextDto = z.infer<typeof installerContextSchema>;
export type InstallerActionResultDto = z.infer<typeof installerActionResultSchema>;
export type InstallerTraceEntryDto = z.infer<typeof installerTraceEntrySchema>;
export type InstallerTraceResponseDto = z.infer<typeof installerTraceResponseSchema>;
