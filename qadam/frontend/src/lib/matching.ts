import type { ApiFetcher } from "./projects";
import type { ProjectMatch, VolunteerMatch } from "@/types/matching";

/**
 * Typed wrappers around the matching REST API (api-contracts.md "Matching
 * Module"). Both endpoints return flat arrays (not paginated) — the backend
 * caps results via the `limit` query param.
 */

/** NGO-only: ranked volunteer matches for a specific project. */
export function getVolunteerMatches(
  api: ApiFetcher,
  projectId: string,
  limit = 20
): Promise<VolunteerMatch[]> {
  return api<VolunteerMatch[]>(
    `/matching/volunteers/${projectId}?limit=${limit}`
  );
}

/** Volunteer-only: ranked project recommendations for the caller. */
export function getProjectRecommendations(
  api: ApiFetcher,
  limit = 10
): Promise<ProjectMatch[]> {
  return api<ProjectMatch[]>(`/matching/projects?limit=${limit}`);
}
