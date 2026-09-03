import { z } from "zod";

/**
 * Zod schemas for the AI module request payloads (api-contracts.md "AI Module").
 * The copilot response is validated by CopilotDraftSchema in
 * services/ai/copilot.service.ts - never re-validated at the HTTP layer.
 */

export const copilotDraftBodySchema = z.object({
  brief: z
    .string()
    .trim()
    .min(1, "brief is required")
    .max(2000, "brief must be at most 2000 characters"),
});

export type CopilotDraftBody = z.infer<typeof copilotDraftBodySchema>;
