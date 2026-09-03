/**
 * Frontend mirrors of the matching API DTOs (api-contracts.md "Matching
 * Module"). Keep in sync with the backend matching service.
 *
 * Scoring weights (AGENTS.md "Composite scoring weights"):
 *   distance 0.50 + skills 0.30 + embedding 0.20.
 * Distance is excluded (weights redistributed proportionally) when either
 * party has no coordinates.
 */

export interface SkillsMatch {
  score: number;
  matched: string[];
  missing: string[];
}

export interface MatchReasons {
  /** Actual distance in kilometres; null when either side has no coordinates. */
  distance_km: number | null;
  /** Weighted distance factor (1 / (1 + km)); 0 when distance is unavailable. */
  distance_score: number;
  skills_match: SkillsMatch;
  embedding_similarity: number;
}

/** Single item in GET /api/matching/volunteers/:projectId response. */
export interface VolunteerMatch {
  volunteer_id: string;
  volunteer_name: string;
  composite_score: number;
  reasons: MatchReasons;
}

/** Single item in GET /api/matching/projects response. */
export interface ProjectMatch {
  project_id: string;
  project_title: string;
  ngo_name: string;
  composite_score: number;
  reasons: MatchReasons;
}
