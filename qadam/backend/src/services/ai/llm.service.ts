import { AIProviderError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import * as gemini from "./gemini.service";
import * as qwen from "./qwen.service";

/**
 * Provider-agnostic LLM wrapper (ai-architecture.md "llm.service.ts").
 *
 * Tries Gemini first, falls back to Qwen on timeout, network failure,
 * malformed/empty response, or rate limiting. Callers (rag.service,
 * copilot.service) never know or care which provider answered.
 *
 * The provider choice is logged server-side. Zod validation of structured
 * output happens at the caller level regardless of provider.
 */

// Re-export the shared params type so callers import from llm.service.
export interface GenerateTextParams {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Errors that should trigger a fallback to the secondary provider. */
const FALLBACK_CODES = new Set(["TIMEOUT", "NETWORK_ERROR", "MALFORMED_RESPONSE", "EMPTY_RESPONSE", "RATE_LIMITED"]);

/**
 * Generate text, trying Gemini first and falling back to Qwen on any
 * valid fallback-triggering AIProviderError. Non-fallback errors propagate normally.
 */
export async function generateText(params: GenerateTextParams): Promise<string> {
  try {
    const text = await gemini.generateText(params);
    logger.info("LLM provider served request", { provider: "gemini" });
    return text;
  } catch (err) {
    if (!(err instanceof AIProviderError) || !FALLBACK_CODES.has(err.code)) {
      // Non-fallback or non-AI error: propagate immediately.
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
      // If Qwen also fails, log the Qwen error and surface it so the caller knows both failed.
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
