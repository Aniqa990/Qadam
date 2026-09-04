import { aiConfig } from "../../config/ai";
import { httpJson } from "../../lib/http";
import { AIProviderError } from "../../utils/errors";
import { logger } from "../../utils/logger";

/**
 * Gemini text-generation wrapper (ai-architecture.md "gemini.service.ts").
 *
 * Responsibilities:
 *   - Send prompt + optional system instruction to Gemini free-tier API
 *   - Parse the response text
 *   - Handle errors: timeout, rate limit, malformed/empty response, network
 *   - Enforce a request timeout
 *
 * Interface:
 *   generateText({ prompt, systemInstruction?, temperature?, maxTokens? }) → string
 */

/** Gemini API request timeout in ms. */
const GEMINI_TIMEOUT_MS = 30_000;

// -- Types ---------------------------------------------------------------------

export interface GenerateTextParams {
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

interface GeminiRequestBody {
  contents: { role: string; parts: { text: string }[] }[];
  system_instruction?: { parts: { text: string }[] };
  generationConfig?: { temperature?: number; maxOutputTokens?: number };
}

// -- Public API ----------------------------------------------------------------

/**
 * Generate text using the Gemini API. Throws AIProviderError on timeout,
 * rate limit, malformed response, empty response, or network error.
 */
export async function generateText(params: GenerateTextParams): Promise<string> {
  const { prompt, systemInstruction, temperature = 0.7, maxTokens = 2048 } = params;

  if (!prompt.trim()) {
    throw new AIProviderError(
      "EMPTY_RESPONSE",
      "gemini",
      "Cannot generate text from an empty prompt"
    );
  }

  const { apiKey, model } = aiConfig.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body: GeminiRequestBody = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] };
  }

  let res: GeminiResponse;
  try {
    res = await httpJson<GeminiResponse>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeoutMs: GEMINI_TIMEOUT_MS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("aborted") || message.toLowerCase().includes("abort")) {
      throw new AIProviderError("TIMEOUT", "gemini", `Gemini request timed out after ${GEMINI_TIMEOUT_MS}ms`);
    }
    if (message.includes("HTTP 429")) {
      throw new AIProviderError("RATE_LIMITED", "gemini", message);
    }
    logger.warn("Gemini network/HTTP error", { message });
    throw new AIProviderError("NETWORK_ERROR", "gemini", message);
  }

  const text = extractGeminiText(res);
  if (!text) {
    throw new AIProviderError(
      "MALFORMED_RESPONSE",
      "gemini",
      "Gemini response missing candidates[0].content.parts[0].text or returned empty"
    );
  }

  if (text.trim().length === 0) {
    throw new AIProviderError("EMPTY_RESPONSE", "gemini", "Gemini returned an empty string");
  }

  return text;
}

// -- Helpers -------------------------------------------------------------------

function extractGeminiText(result: GeminiResponse): string | null {
  try {
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}
