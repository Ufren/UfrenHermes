import { WslExecutor } from "@ufren/runtime-sdk";
import type { ChatCompletionRequestDto, ChatCompletionResponseDto } from "@ufren/shared";

import { createLogger } from "../logging/logger.js";

const chatLogger = createLogger("chat-service");

export class ChatService {
  private readonly wslExecutor: WslExecutor;
  private readonly distribution: string;
  private readonly apiBaseUrl: string;
  private readonly defaultModel: string;

  public constructor(wslExecutor = new WslExecutor()) {
    this.wslExecutor = wslExecutor;
    this.distribution = process.env.UFREN_WSL_DISTRO ?? "Ubuntu";
    const healthEndpoint = process.env.UFREN_HEALTH_ENDPOINT ?? "http://127.0.0.1:8642/health";
    this.apiBaseUrl = process.env.UFREN_API_BASE_URL ?? new URL("/v1/", healthEndpoint).toString();
    this.defaultModel = process.env.UFREN_CHAT_MODEL ?? "hermes-agent";

    chatLogger.info("Chat service initialized", {
      distribution: this.distribution,
      apiBaseUrl: this.apiBaseUrl,
      defaultModel: this.defaultModel
    });
  }

  public async complete(request: ChatCompletionRequestDto): Promise<ChatCompletionResponseDto> {
    const apiKey = await this.readOptionalApiKey();
    const response = await fetch(new URL("chat/completions", this.apiBaseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model: request.model ?? this.defaultModel,
        stream: false,
        messages: [
          ...(request.systemPrompt?.trim()
            ? [{ role: "system", content: request.systemPrompt.trim() }]
            : []),
          ...request.messages
        ]
      })
    });

    const rawText = await response.text();
    if (!response.ok) {
      chatLogger.warn("Chat completion failed", {
        status: response.status,
        bodySnippet: rawText.slice(0, 400)
      });
      const detail =
        rawText.trim() ||
        (response.status === 401
          ? "Hermes API server requires a valid API key."
          : `Hermes API server returned ${response.status}.`);
      throw new Error(detail);
    }

    const payload = JSON.parse(rawText) as {
      id?: string;
      model?: string;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
      choices?: {
        message?: {
          content?: unknown;
        };
      }[];
    };

    return {
      message: this.extractAssistantText(payload.choices?.[0]?.message?.content),
      model: payload.model ?? request.model ?? this.defaultModel,
      responseId: payload.id,
      usage: payload.usage
        ? {
            promptTokens: payload.usage.prompt_tokens,
            completionTokens: payload.usage.completion_tokens,
            totalTokens: payload.usage.total_tokens
          }
        : undefined
    };
  }

  private extractAssistantText(content: unknown): string {
    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((entry) => {
          if (typeof entry === "string") {
            return entry;
          }
          if (
            entry &&
            typeof entry === "object" &&
            "type" in entry &&
            "text" in entry &&
            (entry as { type?: unknown }).type === "text"
          ) {
            const text = (entry as { text: unknown }).text;
            return typeof text === "string" ? text : "";
          }
          return "";
        })
        .join("")
        .trim();
    }

    return "";
  }

  private async readOptionalApiKey(): Promise<string | undefined> {
    try {
      const key = await this.wslExecutor.runBash(
        `python3 - <<'PY'
from pathlib import Path

env_file = Path.home() / ".hermes" / ".env"
if not env_file.exists():
    raise SystemExit(0)

for line in env_file.read_text(encoding="utf-8").splitlines():
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in stripped:
        continue
    key, value = stripped.split("=", 1)
    if key.strip() != "API_SERVER_KEY":
        continue
    print(value.strip().strip('"').strip("'"))
    break
PY`,
        {
          distribution: this.distribution,
          timeoutMs: 10_000
        }
      );
      const normalized = key.trim();
      return normalized.length > 0 ? normalized : undefined;
    } catch (error) {
      chatLogger.debug("API server key not found or could not be read", {
        error: error instanceof Error ? error.message : String(error)
      });
      return undefined;
    }
  }
}
