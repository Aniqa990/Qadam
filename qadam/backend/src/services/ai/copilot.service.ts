import { z } from "zod";
import { AppError, AIProviderError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import * as llm from "./llm.service";

/**
 * Owns the Copilot prompt construction and response validation
 * (ai-architecture.md "Project Copilot Flow"). Calls llm.service.ts for
 * text generation; never calls Gemini/Qwen directly.
 *
 * The Zod schema matches ai-architecture.md's CopilotDraftSchema exactly.
 * If validation fails, retry once with a stricter prompt before surfacing
 * a typed 502 to the UI.
 */

export const CopilotDraftSchema = z.object({
  title: z.string().min(5).max(200),
  category: z.string().min(2).max(50),
  description: z.string().min(20).max(2000),
  required_skills: z.array(z.string()).min(1).max(20),
  responsibilities: z.array(z.string()).min(1).max(20),
  eligibility: z.object({
    min_age: z.number().int().min(0).max(100).optional(),
    custom_requirements: z.array(z.string()).max(10).optional(),
  }),
  capacity: z.number().int().min(1).max(500),
});

export type CopilotDraft = z.infer<typeof CopilotDraftSchema>;

const SYSTEM_INSTRUCTION = [
  "You are a project planning assistant for a volunteer platform.",
  "Given a brief description of a volunteer project, generate a structured project draft.",
  "Return ONLY valid JSON matching this schema (no markdown, no prose outside JSON):",
  "{",
  '  "title": string (5-200 chars),',
  '  "category": string (2-50 chars, e.g. education, health, environment, community, youth, food-security),',
  '  "description": string (20-2000 chars, professional and realistic),',
  '  "required_skills": string[] (1-20 items),',
  '  "responsibilities": string[] (1-20 items),',
  '  "eligibility": { "min_age"?: number (0-100), "custom_requirements"?: string[] (max 10) },',
  '  "capacity": number (1-500)',
  "}",
  "Do not invent specific facts, dates, or locations. Generate professional, realistic content.",
].join("\n");

/**
 * Extract the JSON object from a raw LLM response. LLMs sometimes wrap the
 * JSON in a markdown code fence or add preamble text; strip those before
 * attempting to parse.
 */
function extractJson(raw: string): string {
  let text = raw.trim();
  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch?.[1]) {
    text = fenceMatch[1].trim();
  }
  return text;
}

async function attemptGeneration(brief: string): Promise<CopilotDraft> {
  const rawText = await llm.generateText({
    prompt: brief,
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.7,
    maxTokens: 2048,
  });

  const jsonStr = extractJson(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new AIProviderError("MALFORMED_RESPONSE", "gemini", "LLM output is not valid JSON");
  }

  const result = CopilotDraftSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn("Copilot draft failed Zod validation", { issues: result.error.flatten() });
    throw new AIProviderError(
      "MALFORMED_RESPONSE",
      "gemini",
      `Copilot draft validation failed: ${JSON.stringify(result.error.flatten())}`
    );
  }

  return result.data;
}

/**
 * Generate a project draft from a brief. Retries once on MALFORMED_RESPONSE
 * or EMPTY_RESPONSE before surfacing a 502 to the UI.
 */
export async function generateDraft(brief: string): Promise<CopilotDraft> {
  try {
    return await attemptGeneration(brief);
  } catch (err) {
    // Retry once on malformed/empty output (the LLM may have wrapped badly).
    if (
      err instanceof AIProviderError &&
      (err.code === "MALFORMED_RESPONSE" || err.code === "EMPTY_RESPONSE")
    ) {
      logger.warn("Retrying copilot generation once after malformed output", { code: err.code });
      try {
        return await attemptGeneration(brief);
      } catch (retryErr) {
        // Second failure: translate to a typed 502 for the controller.
        if (retryErr instanceof AIProviderError) {
          throw new AppError(
            "The AI assistant returned an unexpected response. Please try again or rephrase your brief.",
            502,
            "AI_DRAFT_ERROR"
          );
        }
        throw retryErr;
      }
    }

    // Translate other AIProviderError codes to user-facing AppErrors per
    // ai-architecture.md error handling switch.
    if (err instanceof AIProviderError) {
      switch (err.code) {
        case "TIMEOUT":
          throw new AppError("AI service is taking too long. Please try again.", 504, "AI_TIMEOUT");
        case "RATE_LIMITED":
          throw new AppError("AI service is busy. Please try again shortly.", 429, "AI_RATE_LIMITED");
        case "NETWORK_ERROR":
          throw new AppError("AI service is temporarily unavailable.", 502, "AI_NETWORK_ERROR");
        default:
          throw new AppError("AI service is temporarily unavailable.", 502, "AI_DRAFT_ERROR");
      }
    }

    throw err;
  }
}
