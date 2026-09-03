import { AIProviderError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import * as gemini from "./gemini.service";
import * as qwen from "./qwen.service";

/**
 * Provider-agnostic text generation wrapper (ai-architecture.md
 * "qwen.service.ts and llm.service.ts"). Tries Gemini first; falls back to
 * Qwen on timeout, network failure, malformed/empty response, or rate
 * limiting. Callers never select a provider.
 *
 * The provider that actually served the request is logged server-side so we
 * can monitor fallback frequency without exposing it to the route layer.
 */

interface GenerateTextParams {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Errors that should trigger a fallback to the secondary provider. */
const FALLBACK_CODES = new Set(["TIMEOUT", "NETWORK_ERROR", "MALFORMED_RESPONSE", "EMPTY_RESPONSE", "RATE_LIMITED"]);

export async function generateText(params: GenerateTextParams): Promise<string> {
  try {
    const text = await gemini.generateText(params);
    logger.info("LLM provider served request", { provider: "gemini" });
    return text;
  } catch (err) {
    if (!(err instanceof AIProviderError) || !FALLBACK_CODES.has(err.code)) {
      // Non-fallback error: propagate immediately.
      throw err;
    }

    logger.warn("Gemini failed - falling back to Qwen", {
      geminiCode: err.code,
      message: err.message,
    });

    try {
      const text = await qwen.generateText(params);
      logger.info("LLM provider served request", { provider: "qwen", fallbackFrom: "gemini" });
      return text;
    } catch (qwenErr) {
      // If Qwen also fails, surface the Qwen error so the caller knows both
      // providers failed. The original Gemini error is already logged above.
      if (qwenErr instanceof AIProviderError) {
        logger.error("Qwen fallback also failed", {
          qwenCode: qwenErr.code,
          message: qwenErr.message,
        });
      }
      throw qwenErr;
    }
  }
}
