import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestIdentity } from "../../src/types/auth.types";
import type { ProjectStatus } from "../../src/types/project.types";

/**
 * Unit tests for the matching engine (ai-architecture.md "Matching Pipeline").
 *
 * Pure scoring/filtering functions are tested directly with fixed fixtures.
 * The matchVolunteers orchestration uses a queue-based Supabase mock matching
 * the pattern from registration.service.test.ts.
 */

type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

vi.mock("../../src/lib/supabase", () => {
  const queues = new Map<string, QueryResult[]>();
  const rpcQueues = new Map<string, QueryResult[]>();

  function makeBuilder(table: string): Record<string, unknown> {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    const take = (): QueryResult => {
      const queue = queues.get(table);
      const next = queue?.shift();
      return next ?? { data: null, error: null, count: null };
    };

    builder.select = chain;
    builder.insert = chain;
    builder.update = chain;
    builder.delete = chain;
    builder.eq = chain;
    builder.in = chain;
    builder.order = chain;
    builder.range = chain;
    builder.contains = chain;
    builder.single = () => Promise.resolve(take());
    builder.maybeSingle = () => Promise.resolve(take());
    builder.then = (onFulfilled: never, onRejected?: never) =>
      Promise.resolve(take()).then(onFulfilled, onRejected);

    return builder;
  }

  const supabase = {
    from: (table: string) => makeBuilder(table),
    rpc: (fn: string, _args: unknown) => {
      const queue = rpcQueues.get(fn);
      const next = queue?.shift();
      return Promise.resolve(next ?? { data: null, error: null });
    },
  };

  return {
    supabase,
    __mock: {
      queue(table: string, results: QueryResult[]) {
        queues.set(table, [...results]);
      },
      queueRpc(fn: string, results: QueryResult[]) {
        rpcQueues.set(fn, [...results]);
      },
      reset() {
        queues.clear();
        rpcQueues.clear();
      },
    },
  };
});

import * as supabaseModule from "../../src/lib/supabase";
import {
  buildReasons,
  compositeScore,
  MATCHING_WEIGHTS,
  matchVolunteers,
  passesCapacityFilter,
  passesDistanceFilter,
  passesEligibilityFilter,
  passesStatusFilter,
  scoreDistance,
  scoreInterests,
  scoreSkills,
} from "../../src/services/ai/matching.service";
import { AuthorizationError, NotFoundError } from "../../src/utils/errors";

const mock = (supabaseModule as unknown as { __mock: {
  queue: (table: string, results: QueryResult[]) => void;
  queueRpc: (fn: string, results: QueryResult[]) => void;
  reset: () => void;
} }).__mock;

// -- Fixtures ------------------------------------------------------------------

function ngoIdentity(domainId = "ngo-1"): RequestIdentity {
  return {
    clerkUserId: "user_ngo",
    role: "ngo",
    email: "ngo@example.com",
    domainId,
    profile: { id: domainId },
  };
}

function volunteerIdentity(): RequestIdentity {
  return {
    clerkUserId: "user_vol",
    role: "volunteer",
    email: "vol@example.com",
    domainId: "vol-1",
    profile: { id: "vol-1", onboarding_complete: true, age: 25 },
  };
}

// =============================================================================
// Pure scoring functions
// =============================================================================

describe("scoreSkills", () => {
  it("returns 1 for a perfect match (identical sets)", () => {
    expect(scoreSkills(["teaching", "mentoring"], ["teaching", "mentoring"])).toBe(1);
  });

  it("returns 0 for a complete mismatch", () => {
    expect(scoreSkills(["coding", "design"], ["teaching", "mentoring"])).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(scoreSkills(["Teaching", "MENTORING"], ["teaching", "mentoring"])).toBe(1);
  });

  it("handles partial overlap with Jaccard formula", () => {
    // intersection = {teaching} = 1, union = {teaching, mentoring, coding} = 3
    const result = scoreSkills(["teaching", "mentoring"], ["teaching", "coding"]);
    expect(result).toBeCloseTo(1 / 3, 5);
  });

  it("returns 0 when both arrays are empty", () => {
    expect(scoreSkills([], [])).toBe(0);
  });

  it("returns 0 when volunteer has no skills but project requires some", () => {
    expect(scoreSkills([], ["teaching"])).toBe(0);
  });

  it("handles duplicate skills gracefully", () => {
    // After normalisation: volunteer = {teaching}, project = {teaching}
    expect(scoreSkills(["teaching", "teaching"], ["teaching"])).toBe(1);
  });
});

describe("scoreInterests", () => {
  it("returns 0.5 when one interest matches and one doesn't (Jaccard)", () => {
    // intersection = {education} = 1, union = {education, health} = 2 → 1/2
    expect(scoreInterests(["education", "health"], "Education")).toBe(0.5);
  });

  it("returns 0 for no overlap", () => {
    expect(scoreInterests(["sports", "health"], "Education")).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(scoreInterests(["EDUCATION"], "education")).toBe(1);
  });

  it("handles multi-word category by splitting on spaces/commas", () => {
    // Category "environment cleanup" → terms: {environment, cleanup}
    // Interests: {environment, education} → intersection=1, union=3
    const result = scoreInterests(
      ["environment", "education"],
      "environment cleanup"
    );
    expect(result).toBeCloseTo(1 / 3, 5);
  });

  it("returns 0 when interests are empty and category is non-empty", () => {
    expect(scoreInterests([], "Education")).toBe(0);
  });

  it("returns 0 when both are empty", () => {
    expect(scoreInterests([], "")).toBe(0);
  });
});

describe("scoreDistance", () => {
  it("returns 1 for the same coordinates (0 km)", () => {
    const loc = { lat: 24.8607, lng: 67.0011 }; // Karachi
    expect(scoreDistance(loc, loc)).toBe(1);
  });

  it("returns null when volunteer has no coordinates", () => {
    expect(scoreDistance(null, { lat: 24.8607, lng: 67.0011 })).toBeNull();
  });

  it("returns null when project has no coordinates", () => {
    expect(scoreDistance({ lat: 24.8607, lng: 67.0011 }, null)).toBeNull();
  });

  it("returns null when both have no coordinates", () => {
    expect(scoreDistance(null, null)).toBeNull();
  });

  it("returns 1/(1+km) for known distances", () => {
    // Karachi → Lahore ≈ 1025 km
    const karachi = { lat: 24.8607, lng: 67.0011 };
    const lahore = { lat: 31.5204, lng: 74.3587 };
    const result = scoreDistance(karachi, lahore);
    expect(result).not.toBeNull();
    // Verify: score ≈ 1/(1+~1025) ≈ 0.000975
    expect(result!).toBeLessThan(0.01);
    expect(result!).toBeGreaterThan(0);
  });
});

// =============================================================================
// Deterministic filters
// =============================================================================

describe("passesStatusFilter", () => {
  it("allows published projects", () => {
    expect(passesStatusFilter("published")).toBe(true);
  });

  it("allows active projects", () => {
    expect(passesStatusFilter("active")).toBe(true);
  });

  it("rejects draft projects", () => {
    expect(passesStatusFilter("draft")).toBe(false);
  });

  it("rejects completed projects", () => {
    expect(passesStatusFilter("completed")).toBe(false);
  });

  it("rejects cancelled projects", () => {
    expect(passesStatusFilter("cancelled")).toBe(false);
  });
});

describe("passesCapacityFilter", () => {
  it("passes when confirmed < capacity", () => {
    expect(passesCapacityFilter(10, 5)).toBe(true);
  });

  it("fails when confirmed == capacity", () => {
    expect(passesCapacityFilter(5, 5)).toBe(false);
  });

  it("fails when confirmed > capacity", () => {
    expect(passesCapacityFilter(5, 10)).toBe(false);
  });
});

describe("passesEligibilityFilter", () => {
  it("passes when no min_age is set", () => {
    expect(passesEligibilityFilter({}, 25)).toBe(true);
  });

  it("passes when min_age is null/undefined", () => {
    expect(passesEligibilityFilter({ min_age: undefined }, 25)).toBe(true);
    expect(passesEligibilityFilter(null, 25)).toBe(true);
    expect(passesEligibilityFilter(undefined, 25)).toBe(true);
  });

  it("passes when volunteer meets min_age", () => {
    expect(passesEligibilityFilter({ min_age: 18 }, 25)).toBe(true);
  });

  it("fails when volunteer is below min_age", () => {
    expect(passesEligibilityFilter({ min_age: 18 }, 16)).toBe(false);
  });

  it("passes when volunteer is exactly min_age", () => {
    expect(passesEligibilityFilter({ min_age: 18 }, 18)).toBe(true);
  });

  it("fails when volunteer age is null but min_age is set", () => {
    expect(passesEligibilityFilter({ min_age: 18 }, null)).toBe(false);
  });
});

describe("passesDistanceFilter", () => {
  it("passes when either location is missing", () => {
    expect(passesDistanceFilter(null, { lat: 24, lng: 67 })).toBe(true);
    expect(passesDistanceFilter({ lat: 24, lng: 67 }, null)).toBe(true);
    expect(passesDistanceFilter(null, null)).toBe(true);
  });

  it("passes for nearby locations (< 100 km)", () => {
    // Two points ~50 km apart
    const a = { lat: 24.8607, lng: 67.0011 }; // Karachi
    const b = { lat: 25.2, lng: 67.3 }; // ~50 km NE
    expect(passesDistanceFilter(a, b)).toBe(true);
  });

  it("fails for distant locations (> 100 km)", () => {
    // Karachi → Lahore ≈ 1025 km
    const karachi = { lat: 24.8607, lng: 67.0011 };
    const lahore = { lat: 31.5204, lng: 74.3587 };
    expect(passesDistanceFilter(karachi, lahore)).toBe(false);
  });
});

// =============================================================================
// Composite score
// =============================================================================

describe("compositeScore", () => {
  it("computes the weighted sum when all components are present", () => {
    const skills = 0.5;
    const interests = 0.8;
    const embedding = 0.6;
    const distance = 0.9;

    const expected =
      MATCHING_WEIGHTS.distance * distance +
      MATCHING_WEIGHTS.skills * skills +
      MATCHING_WEIGHTS.interests * interests +
      MATCHING_WEIGHTS.embedding * embedding;

    const { score } = compositeScore(skills, interests, embedding, distance);
    expect(score).toBeCloseTo(expected, 10);
  });

  it("renormalises weights when distance is null", () => {
    const skills = 0.5;
    const interests = 0.8;
    const embedding = 0.6;

    const remaining = MATCHING_WEIGHTS.skills + MATCHING_WEIGHTS.interests + MATCHING_WEIGHTS.embedding;
    const expected =
      (MATCHING_WEIGHTS.skills / remaining) * skills +
      (MATCHING_WEIGHTS.interests / remaining) * interests +
      (MATCHING_WEIGHTS.embedding / remaining) * embedding;

    const { score, componentScores } = compositeScore(skills, interests, embedding, null);
    expect(score).toBeCloseTo(expected, 10);
    expect(componentScores.distance).toBeNull();
  });

  it("returns 0 when all components are 0", () => {
    const { score } = compositeScore(0, 0, 0, 0);
    expect(score).toBe(0);
  });

  it("returns 1 when all components are 1 (with distance)", () => {
    const { score } = compositeScore(1, 1, 1, 1);
    expect(score).toBeCloseTo(1, 10);
  });

  it("returns 1 when all components are 1 (without distance)", () => {
    const { score } = compositeScore(1, 1, 1, null);
    expect(score).toBeCloseTo(1, 10);
  });

  it("componentScores reflect raw input values", () => {
    const { componentScores } = compositeScore(0.3, 0.7, 0.5, 0.8);
    expect(componentScores.skills).toBe(0.3);
    expect(componentScores.interests).toBe(0.7);
    expect(componentScores.embedding).toBe(0.5);
    expect(componentScores.distance).toBe(0.8);
  });
});

// =============================================================================
// Reason generation
// =============================================================================

describe("buildReasons", () => {
  it("correctly identifies matching and missing skills", () => {
    const reasons = buildReasons(
      ["teaching", "coding"],
      ["teaching", "mentoring"],
      ["education"],
      "education",
      0.5,
      10
    );
    expect(reasons.skills_match).toEqual(["teaching"]);
    expect(reasons.skills_missing).toEqual(["mentoring"]);
  });

  it("is case-insensitive for skill matching", () => {
    const reasons = buildReasons(
      ["Teaching", "MENTORING"],
      ["teaching", "mentoring"],
      [],
      "",
      0,
      null
    );
    expect(reasons.skills_match).toEqual(["teaching", "mentoring"]);
    expect(reasons.skills_missing).toEqual([]);
  });

  it("correctly identifies matching interests against category", () => {
    const reasons = buildReasons(
      [],
      [],
      ["education", "health"],
      "Education",
      0,
      null
    );
    expect(reasons.interests_match).toEqual(["education"]);
  });

  it("passes through embedding similarity and distance", () => {
    const reasons = buildReasons([], [], [], "", 0.75, 42.5);
    expect(reasons.embedding_similarity).toBe(0.75);
    expect(reasons.distance_km).toBe(42.5);
  });

  it("returns empty arrays when nothing matches", () => {
    const reasons = buildReasons(
      ["coding"],
      ["teaching"],
      ["sports"],
      "education",
      0,
      null
    );
    expect(reasons.skills_match).toEqual([]);
    expect(reasons.skills_missing).toEqual(["teaching"]);
    expect(reasons.interests_match).toEqual([]);
    expect(reasons.distance_km).toBeNull();
  });
});

// =============================================================================
// matchVolunteers integration (mocked Supabase)
// =============================================================================

/** Standard project row for matchVolunteers tests. */
function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "proj-1",
    ngo_id: "ngo-1",
    title: "After-School Tutoring",
    description: "Help children with homework",
    category: "education",
    required_skills: ["teaching", "mentoring"],
    responsibilities: ["Tutor students", "Prepare materials"],
    eligibility: {},
    capacity: 10,
    whatsapp_group_url: null,
    status: "published" as ProjectStatus,
    start_date: "2026-09-15",
    end_date: "2026-12-15",
    event_date: null,
    location_name: "Karachi, Pakistan",
    location_lat: 24.8607,
    location_lng: 67.0011,
    hours_per_session: 2,
    created_at: "2026-09-01",
    updated_at: "2026-09-01",
    ...overrides,
  };
}

/** Volunteer candidate row. */
function volunteerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "vol-1",
    full_name: "Alice",
    skills: ["teaching", "coding"],
    interests: ["education", "technology"],
    experience: "2 years tutoring",
    location_lat: 24.8607,
    location_lng: 67.0011,
    age: 25,
    ...overrides,
  };
}

/**
 * Queue the Supabase calls that matchVolunteers makes in order:
 *  1. projects.select (maybeSingle)
 *  2. registrations.select head:true (count)
 *  3. volunteers.select (list)
 *  4. registrations.select (registered IDs)
 *  5. project_embeddings.select (maybeSingle)
 *  6. rpc match_volunteers
 */
function queueHappyPath(
  project: Record<string, unknown>,
  volunteers: Record<string, unknown>[],
  registeredVolIds: string[] = []
) {
  mock.queue("projects", [{ data: project, error: null }]);
  mock.queue("registrations", [
    { count: 3, error: null }, // confirmed count (head:true)
    { data: registeredVolIds.map((id) => ({ volunteer_id: id })), error: null }, // registered list
  ]);
  mock.queue("volunteers", [{ data: volunteers, error: null }]);
  mock.queue("project_embeddings", [{ data: null, error: null }]); // no embedding
  mock.queueRpc("match_volunteers", [{ data: [], error: null }]);
}

describe("matchVolunteers", () => {
  beforeEach(() => mock.reset());

  it("rejects non-NGO callers with 403", async () => {
    await expect(
      matchVolunteers(volunteerIdentity(), "proj-1")
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("returns 404 when project does not exist", async () => {
    mock.queue("projects", [{ data: null, error: null }]);

    await expect(
      matchVolunteers(ngoIdentity(), "proj-1")
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns 404 when the project belongs to a different NGO", async () => {
    mock.queue("projects", [
      { data: projectRow({ ngo_id: "ngo-2" }), error: null },
    ]);

    await expect(
      matchVolunteers(ngoIdentity("ngo-1"), "proj-1")
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns empty array when project is at capacity", async () => {
    mock.queue("projects", [
      { data: projectRow({ capacity: 3 }), error: null },
    ]);
    mock.queue("registrations", [
      { count: 3, error: null }, // 3 confirmed >= capacity 3
    ]);

    const result = await matchVolunteers(ngoIdentity(), "proj-1");
    expect(result).toEqual([]);
  });

  it("excludes volunteers who are already registered", async () => {
    const vol1 = volunteerRow({ id: "vol-1", full_name: "Alice" });
    const vol2 = volunteerRow({ id: "vol-2", full_name: "Bob" });

    queueHappyPath(projectRow(), [vol1, vol2], ["vol-1"]);

    const result = await matchVolunteers(ngoIdentity(), "proj-1");
    // Only vol-2 should appear (vol-1 is registered)
    expect(result).toHaveLength(1);
    expect(result[0].volunteer_id).toBe("vol-2");
  });

  it("excludes volunteers below min_age", async () => {
    const adult = volunteerRow({ id: "vol-adult", age: 25 });
    const minor = volunteerRow({ id: "vol-minor", age: 16 });

    queueHappyPath(
      projectRow({ eligibility: { min_age: 18 } }),
      [adult, minor]
    );

    const result = await matchVolunteers(ngoIdentity(), "proj-1");
    expect(result).toHaveLength(1);
    expect(result[0].volunteer_id).toBe("vol-adult");
  });

  it("ranks candidates correctly with fixed fixtures", async () => {
    // Project in Karachi (24.86, 67.00) requiring ["teaching", "mentoring"]
    // category: "education". All volunteers must be within 100 km.
    const project = projectRow();

    // Volunteer 1: very close (~5 km), 1/3 skill overlap, 1/3 interest overlap
    const vol1 = volunteerRow({
      id: "vol-1",
      full_name: "Nearby Partial",
      skills: ["teaching", "coding"],
      interests: ["education", "technology", "sports"],
      location_lat: 24.9,
      location_lng: 67.02,
    });

    // Volunteer 2: close (~52 km), 0 skill overlap, 0 interest overlap
    const vol2 = volunteerRow({
      id: "vol-2",
      full_name: "Close NoMatch",
      skills: ["cooking", "painting"],
      interests: ["sports", "music"],
      location_lat: 25.0,
      location_lng: 67.5,
    });

    // Volunteer 3: far (~89 km, still within 100 km), perfect skill + interest match
    const vol3 = volunteerRow({
      id: "vol-3",
      full_name: "Far Expert",
      skills: ["teaching", "mentoring"],
      interests: ["education"],
      location_lat: 25.4,
      location_lng: 67.6,
    });

    queueHappyPath(project, [vol1, vol2, vol3]);

    const result = await matchVolunteers(ngoIdentity(), "proj-1");
    expect(result).toHaveLength(3);

    // vol-3 (high skills+interests despite distance) > vol-1 (close, some overlap) > vol-2 (close, no overlap)
    expect(result[0].volunteer_id).toBe("vol-3");
    expect(result[1].volunteer_id).toBe("vol-1");
    expect(result[2].volunteer_id).toBe("vol-2");

    // Verify all scores are positive and strictly descending
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].composite_score).toBeGreaterThan(result[i + 1].composite_score);
    }
    for (const r of result) {
      expect(r.composite_score).toBeGreaterThan(0);
    }
  });

  it("produces correct component scores for a known fixture", async () => {
    // Project in Karachi requiring ["teaching"], category: "education"
    const project = projectRow({
      required_skills: ["teaching"],
      category: "education",
    });

    // Volunteer with perfect skill match, 1/1 interest match, ~50 km away
    const vol = volunteerRow({
      id: "vol-perfect",
      skills: ["teaching"],
      interests: ["education"],
      location_lat: 25.2,
      location_lng: 67.3,
    });

    queueHappyPath(project, [vol]);

    const result = await matchVolunteers(ngoIdentity(), "proj-1");
    expect(result).toHaveLength(1);

    const match = result[0];
    expect(match.component_scores.skills).toBe(1);
    expect(match.component_scores.interests).toBe(1);
    expect(match.component_scores.embedding).toBe(0); // stubbed
    expect(match.component_scores.distance).not.toBeNull();
    expect(match.component_scores.distance).toBeGreaterThan(0);

    // Verify composite = 0.35*distance + 0.30*1 + 0.15*1 + 0.20*0
    const expectedScore =
      MATCHING_WEIGHTS.distance * (match.component_scores.distance as number) +
      MATCHING_WEIGHTS.skills * 1 +
      MATCHING_WEIGHTS.interests * 1 +
      MATCHING_WEIGHTS.embedding * 0;
    expect(match.composite_score).toBeCloseTo(expectedScore, 3);
  });

  it("renormalises weights when volunteer has no coordinates", async () => {
    const project = projectRow();
    const vol = volunteerRow({
      id: "vol-noloc",
      skills: ["teaching", "mentoring"],
      interests: ["education"],
      location_lat: null,
      location_lng: null,
    });

    queueHappyPath(project, [vol]);

    const result = await matchVolunteers(ngoIdentity(), "proj-1");
    expect(result).toHaveLength(1);

    const match = result[0];
    expect(match.component_scores.distance).toBeNull();

    // Without distance: remaining = 0.30 + 0.15 + 0.20 = 0.65
    // normSkills = 0.30/0.65, normInterests = 0.15/0.65, normEmbedding = 0.20/0.65
    // skills=1, interests=1, embedding=0
    const remaining = MATCHING_WEIGHTS.skills + MATCHING_WEIGHTS.interests + MATCHING_WEIGHTS.embedding;
    const expected =
      (MATCHING_WEIGHTS.skills / remaining) * 1 +
      (MATCHING_WEIGHTS.interests / remaining) * 1 +
      (MATCHING_WEIGHTS.embedding / remaining) * 0;
    expect(match.composite_score).toBeCloseTo(expected, 3);
  });

  it("includes human-readable reasons in each result", async () => {
    const project = projectRow({
      required_skills: ["teaching", "mentoring"],
      category: "education",
    });

    // Offset volunteer from project so distance > 0
    const vol = volunteerRow({
      skills: ["teaching", "coding"],
      interests: ["education", "technology"],
      location_lat: 25.2,
      location_lng: 67.3,
    });

    queueHappyPath(project, [vol]);

    const result = await matchVolunteers(ngoIdentity(), "proj-1");
    expect(result).toHaveLength(1);

    const reasons = result[0].reasons;
    expect(reasons.skills_match).toContain("teaching");
    expect(reasons.skills_missing).toContain("mentoring");
    expect(reasons.interests_match).toContain("education");
    expect(reasons.embedding_similarity).toBe(0);
    expect(reasons.distance_km).not.toBeNull();
    expect(reasons.distance_km).toBeGreaterThan(0);
  });

  it("limits results to the requested N", async () => {
    const project = projectRow();
    const volunteers = Array.from({ length: 10 }, (_, i) =>
      volunteerRow({
        id: `vol-${i}`,
        full_name: `Volunteer ${i}`,
        skills: ["teaching"],
        interests: ["education"],
      })
    );

    queueHappyPath(project, volunteers);

    const result = await matchVolunteers(ngoIdentity(), "proj-1", 3);
    expect(result).toHaveLength(3);
  });

  it("respects the limit parameter default of 20", async () => {
    const project = projectRow();
    const volunteers = Array.from({ length: 25 }, (_, i) =>
      volunteerRow({
        id: `vol-${i}`,
        full_name: `Volunteer ${i}`,
        skills: ["teaching"],
        interests: ["education"],
      })
    );

    queueHappyPath(project, volunteers);

    const result = await matchVolunteers(ngoIdentity(), "proj-1");
    expect(result).toHaveLength(20);
  });
});
