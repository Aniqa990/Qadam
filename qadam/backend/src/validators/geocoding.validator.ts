import { z } from "zod";

/**
 * Zod schema for the geocoding module (api-contracts.md "Geocoding Module").
 * The search box debounces and only fires for meaningful queries, but the
 * server re-validates regardless: short queries would hammer Nominatim for
 * junk results, and unbounded ones could smuggle URL garbage.
 */
export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "Search query must be at least 2 characters")
    .max(100, "Search query must be at most 100 characters"),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
