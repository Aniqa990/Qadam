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

/**
 * Generate text, trying Gemini first and falling back to Qwen on any
 * AIProviderError. Non-AI errors (e.g. coding bugs) propagate normally.
 */
export async function generateText(params: GenerateTextParams): Promise<string> {
  try {
    const text = await gemini.generateText(params);
    logger.info("LLM response served by Gemini");
    return text;
  } catch (err) {
    if (err instanceof AIProviderError) {
      logger.warn("Gemini failed, falling back to Qwen", {
        code: err.code,
        message: err.message,
      });

      const text = await qwen.generateText(params);
      logger.info("LLM response served by Qwen (fallback)");
      return text;
    }
    throw err;
  }
}
