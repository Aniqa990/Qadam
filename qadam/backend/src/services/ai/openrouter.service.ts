import { aiConfig } from "../../config/ai";
import { httpJson } from "../../lib/http";
import { AIProviderError } from "../../utils/errors";
import { logger } from "../../utils/logger";

const OPENROUTER_TIMEOUT_MS = 30_000;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface GenerateTextParams {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function generateText(params: GenerateTextParams): Promise<string> {
  const { prompt, systemInstruction, temperature = 0.7, maxTokens = 2048 } = params;

  if (!prompt.trim()) {
    throw new AIProviderError("EMPTY_RESPONSE", "openrouter", "Cannot generate text from an empty prompt");
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
  messages.push({ role: "user", content: prompt });

  let response: OpenRouterResponse;
  try {
    response = await httpJson<OpenRouterResponse>(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiConfig.openRouter.apiKey}`,
        "HTTP-Referer": "https://qadam.app",
        "X-Title": "Qadam",
      },
      body: JSON.stringify({
        model: aiConfig.openRouter.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      timeoutMs: OPENROUTER_TIMEOUT_MS,
    });
  } catch (err) {
    throw classifyProviderFailure(err, "openrouter", OPENROUTER_TIMEOUT_MS, "OpenRouter");
  }

  const text = response.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new AIProviderError(
      "MALFORMED_RESPONSE",
      "openrouter",
      "OpenRouter response missing choices[0].message.content"
    );
  }
  if (!text.trim()) {
    throw new AIProviderError("EMPTY_RESPONSE", "openrouter", "OpenRouter returned an empty string");
  }
  return text.trim();
}

function classifyProviderFailure(
  err: unknown,
  provider: "openrouter",
  timeoutMs: number,
  label: string
): AIProviderError {
  const message = err instanceof Error ? err.message : String(err);
  if (message.toLowerCase().includes("abort")) {
    return new AIProviderError("TIMEOUT", provider, `${label} request timed out after ${timeoutMs}ms`);
  }
  if (message.includes("HTTP 429")) {
    return new AIProviderError("RATE_LIMITED", provider, message);
  }
  logger.warn(`${label} network/HTTP error`, { message });
  return new AIProviderError("NETWORK_ERROR", provider, message);
}