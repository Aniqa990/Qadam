import { aiConfig } from "../../config/ai";
import { httpJson } from "../../lib/http";
import { AIProviderError } from "../../utils/errors";
import { logger } from "../../utils/logger";

/**
 * Wraps Alibaba Cloud DashScope's OpenAI-compatible Qwen API as the fallback
 * LLM provider (ai-architecture.md "qwen.service.ts"). Implements the same
 * internal generateText interface as gemini.service.ts so llm.service.ts can
 * call either transparently.
 *
 * DashScope OpenAI-compatible endpoint:
 *   POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
 *   Authorization: Bearer <DASHSCOPE_API_KEY>
 */

interface GenerateTextParams {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

interface DashScopeResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

const DASHSCOPE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const QWEN_TIMEOUT_MS = 30_000;

export async function generateText(params: GenerateTextParams): Promise<string> {
  const { prompt, systemInstruction, temperature = 0.7, maxTokens = 2048 } = params;
  const { apiKey, model } = aiConfig.qwen;

  const messages: Array<{ role: string; content: string }> = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const body = JSON.stringify({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  let res: DashScopeResponse;
  try {
    res = await httpJson<DashScopeResponse>(DASHSCOPE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
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

  const text = res?.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new AIProviderError(
      "MALFORMED_RESPONSE",
      "qwen",
      "Qwen response missing choices[0].message.content"
    );
  }

  if (text.trim().length === 0) {
    throw new AIProviderError("EMPTY_RESPONSE", "qwen", "Qwen returned an empty string");
  }

  return text;
}
