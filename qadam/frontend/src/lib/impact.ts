import type { NgoImpactMetrics } from "@/types/impact";
import type { ApiFetcher } from "./projects";

/**
 * Typed wrapper for the impact REST API (api-contracts.md "Impact Module").
 * Metrics are computed server-side by PostgreSQL aggregation over projects,
 * registrations, and attendance - the client only renders them.
 */

/** GET /api/impact/ngo - the authenticated NGO's own verified metrics. */
export function getNgoImpact(api: ApiFetcher): Promise<NgoImpactMetrics> {
  return api<NgoImpactMetrics>("/impact/ngo");
}
