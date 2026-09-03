import type { RequestIdentity } from "../../types/auth.types";
import type { ProjectEligibility, ProjectRow, ProjectStatus } from "../../types/project.types";
import { supabase } from "../../lib/supabase";
import { haversineDistanceKm } from "../../utils/distance";
import { logger } from "../../utils/logger";
import {
  AppError,
  AuthorizationError,
  NotFoundError,
} from "../../utils/errors";

/**
 * Deterministic volunteer matching engine (ai-architecture.md).
 *
 * Pipeline:
 *   1. Deterministic filtering (hard constraints — always run first)
 *   2. Multi-factor scoring (weighted composite: distance, skills,
 *      interests, pgvector embedding similarity)
 *   3. Ranking + explanation
 *
 * Embedding similarity uses real pgvector cosine similarity when both
 * the project and volunteer embeddings exist; gracefully defaults to 0
 * when either side is missing an embedding. No LLM is used for ranking.
 */

// -- Scoring weights (centralised per AGENTS.md) --------------------------------

export const MATCHING_WEIGHTS = {
  distance: 0.35,
  skills: 0.30,
  embedding: 0.20,
  interests: 0.15,
} as const;

/** Maximum distance (km) for the deterministic location filter. */
const MAX_DISTANCE_KM = 100;

/** Projects in these statuses are matchable. */
const MATCHABLE_STATUSES: readonly ProjectStatus[] = ["published", "active"];

// -- Types ---------------------------------------------------------------------

export interface MatchReasons {
  skills_match: string[];
  skills_missing: string[];
  interests_match: string[];
  embedding_similarity: number;
  distance_km: number | null;
}

export interface ComponentScores {
  skills: number;
  interests: number;
  embedding: number;
  distance: number | null;
}

export interface MatchResult {
  volunteer_id: string;
  volunteer_name: string;
  composite_score: number;
  component_scores: ComponentScores;
  reasons: MatchReasons;
}

/** Internal shape for a volunteer candidate loaded from the DB. */
interface VolunteerCandidate {
  id: string;
  full_name: string;
  skills: string[];
  interests: string[];
  experience: string | null;
  location_lat: number | null;
  location_lng: number | null;
  age: number | null;
}

// -- Pure scoring functions (exported for unit testing) ------------------------

/**
 * Lowercase and deduplicate a string array for set-overlap comparisons.
 */
function normalize(items: string[]): string[] {
  return [...new Set(items.map((s) => s.toLowerCase().trim()))];
}

/**
 * Jaccard-style set overlap score in [0, 1].
 * Returns 0 when both sets are empty (no meaningful overlap).
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  return intersection / union.size;
}

/**
 * Skills match score: Jaccard similarity of normalised volunteer skills
 * against project required_skills.
 */
export function scoreSkills(
  volunteerSkills: string[],
  requiredSkills: string[]
): number {
  return jaccardSimilarity(normalize(volunteerSkills), normalize(requiredSkills));
}

/**
 * Interests match score: Jaccard similarity of normalised volunteer interests
 * against project category (split by common separators for multi-word cats).
 */
export function scoreInterests(
  volunteerInterests: string[],
  projectCategory: string
): number {
  const categoryTerms = normalize(
    projectCategory.split(/[\s,/]+/).filter(Boolean)
  );
  return jaccardSimilarity(normalize(volunteerInterests), categoryTerms);
}

/**
 * Distance score: `1 / (1 + distance_km)`.
 * Returns null when either party has no coordinates — the caller must
 * renormalise the remaining weights proportionally.
 */
export function scoreDistance(
  volunteerLoc: { lat: number; lng: number } | null,
  projectLoc: { lat: number; lng: number } | null
): number | null {
  if (!volunteerLoc || !projectLoc) return null;
  const km = haversineDistanceKm(volunteerLoc, projectLoc);
  return 1 / (1 + km);
}

// -- Deterministic filters (exported for unit testing) -------------------------

/**
 * Hard-filter: project status must be published or active.
 */
export function passesStatusFilter(status: ProjectStatus): boolean {
  return (MATCHABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Hard-filter: project has room for at least one more volunteer.
 */
export function passesCapacityFilter(capacity: number, confirmedCount: number): boolean {
  return confirmedCount < capacity;
}

/**
 * Hard-filter: volunteer meets the project's min_age eligibility.
 * Returns true when no age requirement is set.
 */
export function passesEligibilityFilter(
  eligibility: ProjectEligibility | null | undefined,
  volunteerAge: number | null
): boolean {
  const minAge = eligibility?.min_age;
  if (minAge === undefined || minAge === null) return true;
  if (volunteerAge === null || volunteerAge === undefined) return false;
  return volunteerAge >= minAge;
}

/**
 * Hard-filter: distance must be ≤ MAX_DISTANCE_KM when both coordinates exist.
 * Passes when either side has no coordinates (distance is unknowable).
 */
export function passesDistanceFilter(
  volunteerLoc: { lat: number; lng: number } | null,
  projectLoc: { lat: number; lng: number } | null
): boolean {
  if (!volunteerLoc || !projectLoc) return true;
  return haversineDistanceKm(volunteerLoc, projectLoc) <= MAX_DISTANCE_KM;
}

// -- Composite scoring ---------------------------------------------------------

/**
 * Weighted composite score. When distance is unavailable (null), the distance
 * weight is dropped and the remaining weights are renormalised proportionally
 * so the total still sums to 1.
 */
export function compositeScore(
  skills: number,
  interests: number,
  embedding: number,
  distance: number | null
): { score: number; componentScores: ComponentScores } {
  const w = MATCHING_WEIGHTS;

  if (distance === null) {
    // Drop distance, renormalise the remaining weights proportionally.
    const remaining = w.skills + w.interests + w.embedding;
    const normSkills = w.skills / remaining;
    const normInterests = w.interests / remaining;
    const normEmbedding = w.embedding / remaining;

    return {
      score:
        normSkills * skills +
        normInterests * interests +
        normEmbedding * embedding,
      componentScores: { skills, interests, embedding, distance: null },
    };
  }

  return {
    score:
      w.distance * distance +
      w.skills * skills +
      w.interests * interests +
      w.embedding * embedding,
    componentScores: { skills, interests, embedding, distance },
  };
}

// -- Reason generation ---------------------------------------------------------

/**
 * Build human-readable reasons explaining why a volunteer matched.
 */
export function buildReasons(
  volunteerSkills: string[],
  requiredSkills: string[],
  volunteerInterests: string[],
  projectCategory: string,
  embeddingSimilarity: number,
  distanceKm: number | null
): MatchReasons {
  const normRequired = normalize(requiredSkills);
  const normVolSkills = normalize(volunteerSkills);
  const normVolSkillsSet = new Set(normVolSkills);

  const skillsMatch = normRequired.filter((s) => normVolSkillsSet.has(s));
  const skillsMissing = normRequired.filter((s) => !normVolSkillsSet.has(s));

  const categoryTerms = normalize(
    projectCategory.split(/[\s,/]+/).filter(Boolean)
  );
  const normInterestsSet = new Set(normalize(volunteerInterests));
  const interestsMatch = categoryTerms.filter((t) => normInterestsSet.has(t));

  return {
    skills_match: skillsMatch,
    skills_missing: skillsMissing,
    interests_match: interestsMatch,
    embedding_similarity: embeddingSimilarity,
    distance_km: distanceKm,
  };
}

// -- Internal helpers ----------------------------------------------------------

/** Round to 4 decimal places for clean API responses. */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function getVolunteerCoords(
  v: VolunteerCandidate
): { lat: number; lng: number } | null {
  return v.location_lat !== null && v.location_lng !== null
    ? { lat: v.location_lat, lng: v.location_lng }
    : null;
}

function getProjectCoords(
  p: Pick<ProjectRow, "location_lat" | "location_lng">
): { lat: number; lng: number } | null {
  return p.location_lat !== null && p.location_lng !== null
    ? { lat: p.location_lat, lng: p.location_lng }
    : null;
}

function scoreVolunteer(
  volunteer: VolunteerCandidate,
  project: ProjectRow,
  projectLoc: { lat: number; lng: number } | null,
  embeddingMap: Map<string, number>
): MatchResult {
  const volunteerLoc = getVolunteerCoords(volunteer);
  const distanceKm =
    volunteerLoc && projectLoc
      ? haversineDistanceKm(volunteerLoc, projectLoc)
      : null;

  const sSkills = scoreSkills(volunteer.skills, project.required_skills);
  const sInterests = scoreInterests(volunteer.interests, project.category);
  const sEmbedding = embeddingMap.get(volunteer.id) ?? 0;
  const sDistance = scoreDistance(volunteerLoc, projectLoc);

  const { score, componentScores } = compositeScore(
    sSkills,
    sInterests,
    sEmbedding,
    sDistance
  );

  return {
    volunteer_id: volunteer.id,
    volunteer_name: volunteer.full_name,
    composite_score: round4(score),
    component_scores: {
      ...componentScores,
      skills: round4(componentScores.skills),
      interests: round4(componentScores.interests),
      embedding: round4(componentScores.embedding),
      ...(componentScores.distance !== null
        ? { distance: round4(componentScores.distance) }
        : {}),
    },
    reasons: buildReasons(
      volunteer.skills,
      project.required_skills,
      volunteer.interests,
      project.category,
      sEmbedding,
      distanceKm !== null ? round4(distanceKm) : null
    ),
  };
}

/**
 * Load embedding similarity scores via the `match_volunteers` pgvector RPC.
 * Returns an empty map on any failure — matching still works with the
 * deterministic components (embedding score defaults to 0).
 */
async function fetchEmbeddingSimilarity(
  projectEmbedding: string
): Promise<Map<string, number>> {
  try {
    const { data, error } = await supabase.rpc("match_volunteers", {
      query_embedding: projectEmbedding,
      match_count: 50,
      match_threshold: 0.01,
    });
    if (error) {
      logger.warn("Embedding similarity lookup failed", {
        error: error.message,
      });
      return new Map();
    }
    const rows = (data ?? []) as { volunteer_id: string; similarity: number }[];
    return new Map(rows.map((r) => [r.volunteer_id, r.similarity]));
  } catch {
    logger.warn("Embedding similarity lookup threw unexpectedly");
    return new Map();
  }
}

// -- Public API ----------------------------------------------------------------

/**
 * GET /api/matching/volunteers/:projectId
 *
 * Returns ranked volunteer candidates for a project using the three-step
 * matching pipeline: deterministic filtering → multi-factor scoring →
 * ranking + explanation.
 *
 * Embedding similarity uses real pgvector cosine similarity when stored
 * embeddings exist; defaults to 0 when either side has no embedding yet.
 */
export async function matchVolunteers(
  identity: RequestIdentity,
  projectId: string,
  limit = 20
): Promise<MatchResult[]> {
  if (identity.role !== "ngo") {
    throw new AuthorizationError("Only NGO accounts can view volunteer matches");
  }

  // 1. Load project (must belong to the calling NGO).
  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) {
    throw new AppError(
      `Failed to load project: ${projectError.message}`,
      500
    );
  }
  if (!projectData) {
    throw new NotFoundError("Project not found");
  }

  const project = projectData as unknown as ProjectRow;
  if (project.ngo_id !== identity.domainId) {
    throw new NotFoundError("Project not found");
  }
  if (!passesStatusFilter(project.status)) {
    throw new AppError(
      "Matching is only available for published or active projects",
      400,
      "PROJECT_NOT_MATCHABLE"
    );
  }

  // 2. Count confirmed registrations & check capacity.
  const { count: confirmedCount, error: countError } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("status", "confirmed");
  if (countError) {
    throw new AppError(
      `Failed to count registrations: ${countError.message}`,
      500
    );
  }
  if (!passesCapacityFilter(project.capacity, confirmedCount ?? 0)) {
    return []; // at capacity — no candidates possible
  }

  // 3. Load all onboarding-complete volunteers.
  const { data: volunteersData, error: volunteersError } = await supabase
    .from("volunteers")
    .select(
      "id, full_name, skills, interests, experience, location_lat, location_lng, age"
    )
    .eq("onboarding_complete", true);
  if (volunteersError) {
    throw new AppError(
      `Failed to load volunteers: ${volunteersError.message}`,
      500
    );
  }
  const allVolunteers = (volunteersData ?? []) as unknown as VolunteerCandidate[];

  // 4. Exclude already-registered volunteers for this project.
  const { data: registeredData } = await supabase
    .from("registrations")
    .select("volunteer_id")
    .eq("project_id", projectId);
  const registeredIds = new Set(
    ((registeredData ?? []) as { volunteer_id: string }[]).map(
      (r) => r.volunteer_id
    )
  );

  // 5. Deterministic filtering.
  const projectLoc = getProjectCoords(project);

  const candidates = allVolunteers.filter((v) => {
    if (registeredIds.has(v.id)) return false;
    if (!passesEligibilityFilter(project.eligibility, v.age)) return false;

    const volLoc = getVolunteerCoords(v);
    if (!passesDistanceFilter(volLoc, projectLoc)) return false;

    return true;
  });

  // 6. Best-effort embedding similarity via pgvector (gracefully defaults to 0
  //    when embeddings are missing or the lookup fails). Hard filters from
  //    Step 5 are never replaced by embeddings — they stay mandatory.
  let embeddingMap = new Map<string, number>();
  try {
    const { data: embData } = await supabase
      .from("project_embeddings")
      .select("embedding")
      .eq("project_id", projectId)
      .maybeSingle();
    if (embData) {
      const row = embData as unknown as { embedding: string };
      if (row.embedding) {
        embeddingMap = await fetchEmbeddingSimilarity(row.embedding);
      }
    }
  } catch {
    // Embedding lookup is best-effort — matching continues with 0 similarity.
    logger.warn("Project embedding lookup failed, using 0 for embedding scores");
  }

  // 7. Score each candidate.
  const results = candidates.map((v) =>
    scoreVolunteer(v, project, projectLoc, embeddingMap)
  );

  // 8. Rank by composite_score descending, return top-N.
  results.sort((a, b) => b.composite_score - a.composite_score);
  return results.slice(0, limit);
}
