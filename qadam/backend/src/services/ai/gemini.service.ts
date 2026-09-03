import { aiConfig } from "../../config/ai";
import { AIProviderError } from "../../utils/errors";

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

interface GeminiRequestBody {
  contents: { role: string; parts: { text: string }[] }[];
  systemInstruction?: { parts: { text: string }[] };
  generationConfig?: { temperature?: number; maxOutputTokens?: number };
}

// -- Public API ----------------------------------------------------------------

/**
 * Generate text using the Gemini API. Throws AIProviderError on timeout,
 * rate limit, malformed response, empty response, or network error.
 */
export async function generateText(params: GenerateTextParams): Promise<string> {
  if (!params.prompt.trim()) {
    throw new AIProviderError(
      "EMPTY_RESPONSE",
      "gemini",
      "Cannot generate text from an empty prompt"
    );
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.gemini.model}:generateContent` +
    `?key=${aiConfig.gemini.apiKey}`;

  const body: GeminiRequestBody = {
    contents: [{ role: "user", parts: [{ text: params.prompt }] }],
  };
  if (params.systemInstruction) {
    body.systemInstruction = { parts: [{ text: params.systemInstruction }] };
  }
  if (params.temperature != null || params.maxTokens != null) {
    body.generationConfig = {};
    if (params.temperature != null) body.generationConfig.temperature = params.temperature;
    if (params.maxTokens != null) body.generationConfig.maxOutputTokens = params.maxTokens;
  }

  let response: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AIProviderError("TIMEOUT", "gemini", "Gemini request timed out");
    }
    throw new AIProviderError(
      "NETWORK_ERROR",
      "gemini",
      err instanceof Error ? err.message : "Unknown network error"
    );
  }

  if (response.status === 429) {
    throw new AIProviderError("RATE_LIMITED", "gemini", "Gemini rate limit exceeded");
  }
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new AIProviderError(
      "MALFORMED_RESPONSE",
      "gemini",
      `Gemini returned ${response.status}: ${errorText.slice(0, 300)}`
    );
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new AIProviderError(
      "MALFORMED_RESPONSE",
      "gemini",
      "Failed to parse Gemini JSON response"
    );
  }

  const text = extractGeminiText(result);
  if (!text) {
    throw new AIProviderError(
      "EMPTY_RESPONSE",
      "gemini",
      "Gemini returned an empty response"
    );
  }

  return text;
}

// -- Helpers -------------------------------------------------------------------

function extractGeminiText(result: unknown): string | null {
  try {
    const obj = result as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = obj?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}
