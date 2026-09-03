import { z } from "zod";

/**
 * Zod schemas for AI endpoints (api-contracts.md "Matching Module" /
 * ai-architecture.md). The assistant chat endpoint accepts a free-text
 * message; the copilot draft endpoint is later-phase scope.
 */

/** POST /api/ai/assistant/chat */
export const assistantChatSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message must not be empty")
    .max(2000, "Message must be at most 2000 characters"),
});

export type AssistantChatBody = z.infer<typeof assistantChatSchema>;
