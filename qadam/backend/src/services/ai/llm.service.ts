import { AIProviderError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import * as gemini from "./gemini.service";
import * as groq from "./groq.service";
import * as openRouter from "./openrouter.service";

/**
 * Provider-agnostic LLM wrapper (ai-architecture.md "llm.service.ts").
 *
 * Tries Gemini first, then Groq, then OpenRouter on timeout, network failure,
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

/** Errors that should trigger the next provider in the fallback chain. */
const FALLBACK_CODES = new Set(["TIMEOUT", "NETWORK_ERROR", "MALFORMED_RESPONSE", "EMPTY_RESPONSE", "RATE_LIMITED"]);

/**
 * Generate text through the provider chain. Non-fallback errors propagate
 * normally, while fallback-triggering errors advance to the next provider.
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

    logger.warn("Gemini failed - falling back to Groq", {
      geminiCode: err.code,
      message: err.message,
    });

    try {
      const text = await groq.generateText(params);
      logger.info("LLM provider served request", { provider: "groq", fallbackFrom: "gemini" });
      return text;
    } catch (groqErr) {
      if (!(groqErr instanceof AIProviderError) || !FALLBACK_CODES.has(groqErr.code)) {
        throw groqErr;
      }

      logger.warn("Groq failed - falling back to OpenRouter", {
        groqCode: groqErr.code,
        message: groqErr.message,
      });

      try {
        const text = await openRouter.generateText(params);
        logger.info("LLM provider served request", {
          provider: "openrouter",
          fallbackFrom: "groq",
        });
        return text;
      } catch (openRouterErr) {
        if (openRouterErr instanceof AIProviderError) {
          logger.error("OpenRouter fallback also failed", {
            openRouterCode: openRouterErr.code,
            message: openRouterErr.message,
          });
        }
        throw openRouterErr;
      }
    }
  }
}
