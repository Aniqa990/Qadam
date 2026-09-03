import { aiConfig } from "../../config/ai";
import { httpJson } from "../../lib/http";
import { AIProviderError } from "../../utils/errors";
import { logger } from "../../utils/logger";

/**
 * Qwen (Alibaba Cloud DashScope) text-generation wrapper
 * (ai-architecture.md "qwen.service.ts").
 *
 * Uses the OpenAI-compatible DashScope endpoint as the automatic fallback
 * when Gemini errors, times out, or is rate-limited. Same internal
 * interface as gemini.service.ts so llm.service.ts can swap providers
 * transparently.
 *
 * DashScope OpenAI-compatible endpoint:
 *   POST https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions
 *   Authorization: Bearer <DASHSCOPE_API_KEY>
 */

const QWEN_TIMEOUT_MS = 30_000;
const DASHSCOPE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";

// -- Types ---------------------------------------------------------------------

export interface GenerateTextParams {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

/** DashScope OpenAI-compatible response shape (subset we actually read). */
interface DashScopeResponse {
  choices?: Array<{
    message?: { content?: string };
  >>;
}

// -- Public API ----------------------------------------------------------------

/**
 * Generate text using the Qwen DashScope API. Throws AIProviderError on
 * timeout, rate limit, malformed response, empty response, or network error.
 */
export async function generateText(params: GenerateTextParams): Promise<string> {
  const { prompt, systemInstruction, temperature = 0.7, maxTokens = 2048 } = params;

  if (!prompt.trim()) {
    throw new AIProviderError(
      "EMPTY_RESPONSE",
      "qwen",
      "Cannot generate text from an empty prompt"
    );
  }

  const { apiKey, model } = aiConfig.qwen;

  const messages: Array<{ role: string; content: string }> = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  let res: DashScopeResponse;
  try {
    res = await httpJson<DashScopeResponse>(DASHSCOPE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      timeoutMs: QWEN_TIMEOUT_MS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("aborted") || message.toLowerCase().includes("abort")) {
      throw new AIProviderError("TIMEOUT", "qwen", `Qwen request timed out after ${QWEN_TIMEOUT_MS}ms`);
    }
    if (message.includes("HTTP 429")) {
      throw new AIProviderError("RATE_LIMITED", "qwen", message);
    }
    logger.warn("Qwen network/HTTP error", { message });
    throw new AIProviderError("NETWORK_ERROR", "qwen", message);
  }

  const text = extractQwenText(res);
  if (!text) {
    throw new AIProviderError(
      "MALFORMED_RESPONSE",
      "qwen",
      "Qwen response missing choices[0].message.content or returned empty"
    );
  }

  if (text.trim().length === 0) {
    throw new AIProviderError("EMPTY_RESPONSE", "qwen", "Qwen returned an empty string");
  }

  return text;
}

// -- Helpers -------------------------------------------------------------------

function extractQwenText(result: DashScopeResponse): string | null {
  try {
    const text = result?.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}
