import { z } from "zod";

/**
 * Zod schemas for GET /api/matching/volunteers/:projectId.
 * projectId must be a UUID (matching the projects PK); limit caps at 50
 * to keep responses bounded while still allowing a reasonable top-N.
 */

export const matchingProjectParamsSchema = z.object({
  projectId: z.string().uuid("projectId must be a UUID"),
});

export const matchingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type MatchingProjectParams = z.infer<typeof matchingProjectParamsSchema>;
export type MatchingQuery = z.infer<typeof matchingQuerySchema>;
