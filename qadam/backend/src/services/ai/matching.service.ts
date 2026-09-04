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
 *      pgvector embedding similarity)
 *   3. Ranking + explanation
 *
 * Embedding similarity uses real pgvector cosine similarity when both
 * the project and volunteer embeddings exist; gracefully defaults to 0
 * when either side is missing an embedding. No LLM is used for ranking.
 */

// -- Scoring weights (centralised per AGENTS.md) --------------------------------

export const MATCHING_WEIGHTS = {
  distance: 0.50,
  skills: 0.30,
  embedding: 0.20,
} as const;

/** Maximum distance (km) for the deterministic location filter. */
const MAX_DISTANCE_KM = 100;

/** Projects in these statuses are matchable. */
const MATCHABLE_STATUSES: readonly ProjectStatus[] = ["upcoming", "active"];

// -- Types ---------------------------------------------------------------------

export interface MatchReasons {
  skills_match: { score: number; matched: string[]; missing: string[] };
  embedding_similarity: number;
  distance_km: number | null;
  distance_score: number;
}

export interface ComponentScores {
  skills: number;
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

/** Single item in GET /api/matching/projects response (api-contracts.md). */
export interface ProjectRecommendation {
  project_id: string;
  project_title: string;
  ngo_name: string;
  composite_score: number;
  reasons: MatchReasons;
}

/** Internal shape for a volunteer candidate loaded from the DB. */
interface VolunteerCandidate {
  id: string;
  full_name: string;
  skills: string[];
  interests: string[];
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
 * Hard-filter: project status must be upcoming or active.
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
  embedding: number,
  distance: number | null
): { score: number; componentScores: ComponentScores } {
  const w = MATCHING_WEIGHTS;

  if (distance === null) {
    // Drop distance, renormalise the remaining weights proportionally.
    const remaining = w.skills + w.embedding;
    const normSkills = w.skills / remaining;
    const normEmbedding = w.embedding / remaining;

    return {
      score: normSkills * skills + normEmbedding * embedding,
      componentScores: { skills, embedding, distance: null },
    };
  }

  return {
    score: w.distance * distance + w.skills * skills + w.embedding * embedding,
    componentScores: { skills, embedding, distance },
  };
}

// -- Reason generation ---------------------------------------------------------

/**
 * Build human-readable reasons explaining why a volunteer matched.
 * Accepts pre-computed component scores so the frontend can render
 * score bars without recalculating them.
 */
export function buildReasons(
  volunteerSkills: string[],
  requiredSkills: string[],
  embeddingSimilarity: number,
  distanceKm: number | null,
  skillsScore: number,
  distanceScore: number | null
): MatchReasons {
  const normRequired = normalize(requiredSkills);
  const normVolSkills = normalize(volunteerSkills);
  const normVolSkillsSet = new Set(normVolSkills);

  const matched = normRequired.filter((s) => normVolSkillsSet.has(s));
  const missing = normRequired.filter((s) => !normVolSkillsSet.has(s));

  return {
    skills_match: { score: skillsScore, matched, missing },
    embedding_similarity: embeddingSimilarity,
    distance_km: distanceKm,
    distance_score: distanceScore ?? 0,
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
  const sEmbedding = embeddingMap.get(volunteer.id) ?? 0;
  const sDistance = scoreDistance(volunteerLoc, projectLoc);

  const { score, componentScores } = compositeScore(
    sSkills,
    sEmbedding,
    sDistance
  );

  return {
    volunteer_id: volunteer.id,
    volunteer_name: volunteer.full_name,
    composite_score: round4(score),
    component_scores: {
      skills: round4(componentScores.skills),
      embedding: round4(componentScores.embedding),
      distance: componentScores.distance !== null ? round4(componentScores.distance) : null,
    },
    reasons: buildReasons(
      volunteer.skills,
      project.required_skills,
      sEmbedding,
      distanceKm !== null ? round4(distanceKm) : null,
      round4(sSkills),
      sDistance !== null ? round4(sDistance) : null
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

/**
 * Load project embedding similarity scores via the `match_projects` RPC.
 * Returns an empty map on any failure — recommendation still works with
 * deterministic components (embedding score defaults to 0).
 */
async function fetchProjectEmbeddingSimilarity(
  volunteerEmbedding: string,
  matchCount: number
): Promise<Map<string, number>> {
  try {
    const { data, error } = await supabase.rpc("match_projects", {
      query_embedding: volunteerEmbedding,
      match_count: matchCount,
      match_threshold: 0.01,
    });
    if (error) {
      logger.warn("Project embedding similarity lookup failed", {
        error: error.message,
      });
      return new Map();
    }
    const rows = (data ?? []) as { project_id: string; similarity: number }[];
    return new Map(rows.map((r) => [r.project_id, r.similarity]));
  } catch {
    logger.warn("Project embedding similarity lookup threw unexpectedly");
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
      "Matching is only available for upcoming or active projects",
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
      "id, full_name, skills, interests, location_lat, location_lng, age"
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

// -- Volunteer-side project recommendations ------------------------------------

/** Internal shape for a project loaded for recommendation scoring. */
interface ProjectCandidate {
  id: string;
  ngo_id: string;
  title: string;
  category: string;
  description: string;
  required_skills: string[];
  responsibilities: string[];
  eligibility: ProjectEligibility | null;
  capacity: number;
  location_lat: number | null;
  location_lng: number | null;
}

/**
 * Score a single project for a given volunteer.
 * Mirrors `scoreVolunteer` but produces a `ProjectRecommendation` instead.
 */
function scoreProject(
  project: ProjectCandidate,
  ngoName: string,
  volunteer: {
    skills: string[];
    interests: string[];
    location_lat: number | null;
    location_lng: number | null;
  },
  volunteerLoc: { lat: number; lng: number } | null,
  embeddingMap: Map<string, number>
): ProjectRecommendation {
  const projectLoc =
    project.location_lat !== null && project.location_lng !== null
      ? { lat: project.location_lat, lng: project.location_lng }
      : null;

  const distanceKm =
    volunteerLoc && projectLoc
      ? haversineDistanceKm(volunteerLoc, projectLoc)
      : null;

  const sSkills = scoreSkills(volunteer.skills, project.required_skills);
  const sEmbedding = embeddingMap.get(project.id) ?? 0;
  const sDistance = scoreDistance(volunteerLoc, projectLoc);

  const { score } = compositeScore(sSkills, sEmbedding, sDistance);

  return {
    project_id: project.id,
    project_title: project.title,
    ngo_name: ngoName,
    composite_score: round4(score),
    reasons: buildReasons(
      volunteer.skills,
      project.required_skills,
      sEmbedding,
      distanceKm !== null ? round4(distanceKm) : null,
      round4(sSkills),
      sDistance !== null ? round4(sDistance) : null
    ),
  };
}

/**
 * GET /api/matching/projects
 *
 * Returns ranked project recommendations for the authenticated volunteer.
 * Uses the same three-step pipeline as matchVolunteers, but reversed:
 * one volunteer scored against all upcoming/active projects.
 *
 * Hard filters: project status, capacity, distance, eligibility.
 * Scoring: distance 0.50 + skills 0.30 + embedding 0.20.
 */
export async function matchProjects(
  identity: RequestIdentity,
  limit = 5
): Promise<ProjectRecommendation[]> {
  if (identity.role !== "volunteer") {
    throw new AuthorizationError("Only volunteer accounts can view project recommendations");
  }

  const volunteerId = identity.domainId;

  // 1. Load the volunteer's profile.
  const { data: volData, error: volError } = await supabase
    .from("volunteers")
    .select("skills, interests, location_lat, location_lng, age")
    .eq("id", volunteerId)
    .maybeSingle();
  if (volError) {
    throw new AppError(`Failed to load volunteer profile: ${volError.message}`, 500);
  }
  if (!volData) {
    return [];
  }

  const volunteer = volData as {
    skills: string[];
    interests: string[];
    location_lat: number | null;
    location_lng: number | null;
    age: number | null;
  };

  const volunteerLoc =
    volunteer.location_lat !== null && volunteer.location_lng !== null
      ? { lat: volunteer.location_lat, lng: volunteer.location_lng }
      : null;

  // 2. Load all upcoming/active projects with their NGO name.
  const { data: projectsData, error: projectsError } = await supabase
    .from("projects")
    .select(
      "id, ngo_id, title, category, description, required_skills, responsibilities, eligibility, capacity, location_lat, location_lng, ngos(name)"
    )
    .in("status", MATCHABLE_STATUSES as unknown as string[]);
  if (projectsError) {
    throw new AppError(`Failed to load projects: ${projectsError.message}`, 500);
  }
  const allProjects = (projectsData ?? []) as unknown as (ProjectCandidate & {
    ngos: { name: string } | null;
  })[];
  if (allProjects.length === 0) return [];

  // 3. Exclude projects the volunteer is already registered for.
  const { data: regData } = await supabase
    .from("registrations")
    .select("project_id")
    .eq("volunteer_id", volunteerId);
  const registeredProjectIds = new Set(
    ((regData ?? []) as { project_id: string }[]).map((r) => r.project_id)
  );

  // 4. Count confirmed registrations per project for capacity filtering.
  const projectIds = allProjects.map((p) => p.id).filter((id) => !registeredProjectIds.has(id));
  const confirmedCounts = new Map<string, number>();
  if (projectIds.length > 0) {
    const { data: countsData } = await supabase
      .from("registrations")
      .select("project_id")
      .eq("status", "confirmed")
      .in("project_id", projectIds);
    for (const row of ((countsData ?? []) as { project_id: string }[])) {
      confirmedCounts.set(row.project_id, (confirmedCounts.get(row.project_id) ?? 0) + 1);
    }
  }

  // 5. Deterministic filtering.
  const candidates = allProjects.filter((p) => {
    if (registeredProjectIds.has(p.id)) return false;
    if (!passesCapacityFilter(p.capacity, confirmedCounts.get(p.id) ?? 0)) return false;
    if (!passesEligibilityFilter(p.eligibility, volunteer.age)) return false;

    const projLoc =
      p.location_lat !== null && p.location_lng !== null
        ? { lat: p.location_lat, lng: p.location_lng }
        : null;
    if (!passesDistanceFilter(volunteerLoc, projLoc)) return false;

    return true;
  });

  if (candidates.length === 0) return [];

  // 6. Best-effort embedding similarity via match_projects RPC.
  let embeddingMap = new Map<string, number>();
  try {
    const { data: embData } = await supabase
      .from("volunteer_embeddings")
      .select("embedding")
      .eq("volunteer_id", volunteerId)
      .maybeSingle();
    if (embData) {
      const row = embData as unknown as { embedding: string };
      if (row.embedding) {
        embeddingMap = await fetchProjectEmbeddingSimilarity(
          row.embedding,
          candidates.length
        );
      }
    }
  } catch {
    logger.warn("Volunteer embedding lookup failed, using 0 for embedding scores");
  }

  // 7. Score each candidate project.
  const results = candidates.map((p) => {
    const ngoName = p.ngos?.name ?? "";
    return scoreProject(
      { id: p.id, ngo_id: p.ngo_id, title: p.title, category: p.category, description: p.description, required_skills: p.required_skills, responsibilities: p.responsibilities, eligibility: p.eligibility, capacity: p.capacity, location_lat: p.location_lat, location_lng: p.location_lng },
      ngoName,
      volunteer,
      volunteerLoc,
      embeddingMap
    );
  });

  // 8. Rank by composite_score descending, return top-N.
  results.sort((a, b) => b.composite_score - a.composite_score);
  return results.slice(0, limit);
}
