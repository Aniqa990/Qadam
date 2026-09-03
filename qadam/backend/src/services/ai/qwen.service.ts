import { aiConfig } from "../../config/ai";
import { AIProviderError } from "../../utils/errors";

/**
 * Qwen (Alibaba Cloud DashScope) text-generation wrapper
 * (ai-architecture.md "qwen.service.ts").
 *
 * Uses the OpenAI-compatible DashScope endpoint as the automatic fallback
 * when Gemini errors, times out, or is rate-limited. Same internal
 * interface as gemini.service.ts so llm.service.ts can swap providers
 * transparently.
 *
 * Interface:
 *   generateText({ prompt, systemInstruction?, temperature?, maxTokens? }) → string
 */

const QWEN_TIMEOUT_MS = 30_000;

// -- Types ---------------------------------------------------------------------

export interface GenerateTextParams {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

// -- Public API ----------------------------------------------------------------

/**
 * Generate text using the Qwen DashScope API. Throws AIProviderError on
 * timeout, rate limit, malformed response, empty response, or network error.
 */
export async function generateText(params: GenerateTextParams): Promise<string> {
  if (!params.prompt.trim()) {
    throw new AIProviderError(
      "EMPTY_RESPONSE",
      "qwen",
      "Cannot generate text from an empty prompt"
    );
  }

  const url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";

  const messages: { role: string; content: string }[] = [];
  if (params.systemInstruction) {
    messages.push({ role: "system", content: params.systemInstruction });
  }
  messages.push({ role: "user", content: params.prompt });

  const body: Record<string, unknown> = {
    model: aiConfig.qwen.model,
    messages,
  };
  if (params.temperature != null) body.temperature = params.temperature;
  if (params.maxTokens != null) body.max_tokens = params.maxTokens;

  let response: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QWEN_TIMEOUT_MS);
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiConfig.qwen.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AIProviderError("TIMEOUT", "qwen", "Qwen request timed out");
    }
    throw new AIProviderError(
      "NETWORK_ERROR",
      "qwen",
      err instanceof Error ? err.message : "Unknown network error"
    );
  }

  if (response.status === 429) {
    throw new AIProviderError("RATE_LIMITED", "qwen", "Qwen rate limit exceeded");
  }
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new AIProviderError(
      "MALFORMED_RESPONSE",
      "qwen",
      `Qwen returned ${response.status}: ${errorText.slice(0, 300)}`
    );
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new AIProviderError(
      "MALFORMED_RESPONSE",
      "qwen",
      "Failed to parse Qwen JSON response"
    );
  }

  const text = extractQwenText(result);
  if (!text) {
    throw new AIProviderError(
      "EMPTY_RESPONSE",
      "qwen",
      "Qwen returned an empty response"
    );
  }

  return text;
}

// -- Helpers -------------------------------------------------------------------

function extractQwenText(result: unknown): string | null {
  try {
    const obj = result as {
      choices?: { message?: { content?: string } }[];
    };
    const text = obj?.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}
