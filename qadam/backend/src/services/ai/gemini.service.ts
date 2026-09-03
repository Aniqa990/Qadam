import { aiConfig } from "../../config/ai";
import { httpJson } from "../../lib/http";
import { AIProviderError } from "../../utils/errors";
import { logger } from "../../utils/logger";

/**
 * Wraps the Gemini free-tier REST API for text generation
 * (ai-architecture.md "gemini.service.ts").
 *
 * Responsibilities:
 *  - Send a prompt + optional system instruction to Gemini
 *  - Extract the response text from the candidates[] payload
 *  - Throw AIProviderError for timeout, rate-limit, malformed, empty, or
 *    network errors so llm.service.ts can decide whether to fall back
 */

interface GenerateTextParams {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Gemini REST response shape (subset we actually read). */
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

const GEMINI_TIMEOUT_MS = 30_000;

export async function generateText(params: GenerateTextParams): Promise<string> {
  const { prompt, systemInstruction, temperature = 0.7, maxTokens = 2048 } = params;
  const { apiKey, model } = aiConfig.gemini;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = [{ role: "user", parts: [{ text: prompt }] }];
  const system_instruction = systemInstruction
    ? { parts: [{ text: systemInstruction }] }
    : undefined;

  const body = JSON.stringify({
    contents,
    ...(system_instruction ? { system_instruction } : {}),
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  let res: GeminiResponse;
  try {
    res = await httpJson<GeminiResponse>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      timeoutMs: GEMINI_TIMEOUT_MS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // httpJson throws on non-2xx status and AbortController timeouts alike.
    if (message.includes("aborted") || message.toLowerCase().includes("abort")) {
      throw new AIProviderError("TIMEOUT", "gemini", `Gemini request timed out after ${GEMINI_TIMEOUT_MS}ms`);
    }
    // DashScope/Gemini return 429 on rate limits; surface as RATE_LIMITED.
    if (message.includes("HTTP 429")) {
      throw new AIProviderError("RATE_LIMITED", "gemini", message);
    }
    logger.warn("Gemini network/HTTP error", { message });
    throw new AIProviderError("NETWORK_ERROR", "gemini", message);
  }

  const text = res?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new AIProviderError(
      "MALFORMED_RESPONSE",
      "gemini",
      "Gemini response missing candidates[0].content.parts[0].text"
    );
  }

  if (text.trim().length === 0) {
    throw new AIProviderError("EMPTY_RESPONSE", "gemini", "Gemini returned an empty string");
  }

  return text;
}
