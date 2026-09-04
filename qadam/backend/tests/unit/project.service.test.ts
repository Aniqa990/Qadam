import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestIdentity } from "../../src/types/auth.types";

/**
 * Unit tests for project.service.listProjects, focused on the "near you"
 * proximity filter (near_km): radius filtering, nearest-first sorting,
 * pagination over the filtered set, and the graceful no-coordinate paths.
 * Uses the queue-based Supabase mock pattern from matching.service.test.ts.
 */

type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

vi.mock("../../src/lib/supabase", () => {
  const queues = new Map<string, QueryResult[]>();

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
    builder.ilike = chain;
    builder.contains = chain;
    builder.or = chain;
    builder.gte = chain;
    builder.lte = chain;
    builder.single = () => Promise.resolve(take());
    builder.maybeSingle = () => Promise.resolve(take());
    builder.then = (onFulfilled: never, onRejected?: never) =>
      Promise.resolve(take()).then(onFulfilled, onRejected);

    return builder;
  }

  const supabase = { from: (table: string) => makeBuilder(table) };

  return {
    supabase,
    __mock: {
      queue(table: string, results: QueryResult[]) {
        queues.set(table, [...results]);
      },
      reset() {
        queues.clear();
      },
    },
  };
});

import * as supabaseModule from "../../src/lib/supabase";
import { listProjects } from "../../src/services/project.service";
import { haversineDistanceKm } from "../../src/utils/distance";

const mock = (supabaseModule as unknown as { __mock: {
  queue: (table: string, results: QueryResult[]) => void;
  reset: () => void;
} }).__mock;

// -- Fixtures ------------------------------------------------------------------

function volunteerIdentity(): RequestIdentity {
  return {
    clerkUserId: "user_vol",
    role: "volunteer",
    email: "vol@example.com",
    domainId: "vol-1",
    profile: { id: "vol-1" },
  };
}

function ngoIdentity(): RequestIdentity {
  return {
    clerkUserId: "user_ngo",
    role: "ngo",
    email: "ngo@example.com",
    domainId: "ngo-1",
    profile: { id: "ngo-1" },
  };
}

/** Volunteer pin: Karachi. */
const VOLUNTEER_LOC = { location_lat: 24.8607, location_lng: 67.0011 };

function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "proj-1",
    ngo_id: "ngo-1",
    title: "After-School Tutoring",
    description: "Help children with homework",
    required_skills: ["teaching"],
    category: "education",
    responsibilities: [],
    eligibility: {},
    capacity: 10,
    whatsapp_group_url: null,
    status: "published",
    start_date: "2026-09-15",
    end_date: "2026-12-15",
    event_date: null,
    location_name: "Karachi, Pakistan",
    location_lat: 24.8607,
    location_lng: 67.0011,
    hours_per_session: 2,
    created_at: "2026-09-01",
    updated_at: "2026-09-01",
    ngo: { name: "HopeReach" },
    ...overrides,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Queue the volunteer pin lookup consumed by the near_km path. */
function queueVolunteerLocation(
  loc: { location_lat: number | null; location_lng: number | null } | null
) {
  mock.queue("volunteers", [{ data: loc, error: null }]);
}

/** Queue the confirmed-count lookup (fetchConfirmedCounts). */
function queueRegistrations() {
  mock.queue("registrations", [{ data: [], error: null }]);
}

// =============================================================================

describe("listProjects near_km proximity filter", () => {
  beforeEach(() => mock.reset());

  it("keeps only in-radius projects, sorted nearest-first, with distance_km", async () => {
    queueVolunteerLocation(VOLUNTEER_LOC);
    const close = projectRow({ id: "proj-close", location_lat: 24.87, location_lng: 67.0 });
    const mid = projectRow({ id: "proj-mid", location_lat: 25.0, location_lng: 67.1 });
    const far = projectRow({ id: "proj-far", location_lat: 25.4, location_lng: 67.6 });
    // ~220 km away — outside the 100 km radius.
    const outOfRange = projectRow({ id: "proj-out", location_lat: 26.86, location_lng: 68.0 });
    // No pin — not verifiably "within 100 km", excluded from the proximity view.
    const noCoords = projectRow({ id: "proj-noloc", location_lat: null, location_lng: null });
    mock.queue("projects", [{ data: [outOfRange, far, noCoords, mid, close], error: null }]);
    queueRegistrations();

    const result = await listProjects(volunteerIdentity(), {
      page: 1,
      limit: 20,
      near_km: 100,
    });

    expect(result.total).toBe(3);
    expect(result.data.map((p) => p.id)).toEqual(["proj-close", "proj-mid", "proj-far"]);

    const expectedClose = round1(
      haversineDistanceKm(
        { lat: VOLUNTEER_LOC.location_lat, lng: VOLUNTEER_LOC.location_lng },
        { lat: 24.87, lng: 67.0 }
      )
    );
    expect(result.data[0].distance_km).toBe(expectedClose);
    expect(result.data[0].distance_km!).toBeLessThan(result.data[1].distance_km!);
    expect(result.data[1].distance_km!).toBeLessThan(result.data[2].distance_km!);
  });

  it("paginates over the filtered set with a correct total", async () => {
    queueVolunteerLocation(VOLUNTEER_LOC);
    const rows = [
      projectRow({ id: "p1", location_lat: 24.861, location_lng: 67.0011 }),
      projectRow({ id: "p2", location_lat: 24.862, location_lng: 67.0011 }),
      projectRow({ id: "p3", location_lat: 24.863, location_lng: 67.0011 }),
    ];
    mock.queue("projects", [{ data: rows, error: null }]);
    queueRegistrations();

    const result = await listProjects(volunteerIdentity(), {
      page: 2,
      limit: 2,
      near_km: 100,
    });

    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(1);
    // Nearest-first ordering: p1 < p2 < p3, so page 2 holds only p3.
    expect(result.data[0].id).toBe("p3");
  });

  it("ignores the filter when the volunteer profile has no coordinates", async () => {
    queueVolunteerLocation({ location_lat: null, location_lng: null });
    const rows = [
      projectRow({ id: "p1" }),
      projectRow({ id: "p2", location_lat: 26.86, location_lng: 68.0 }),
      projectRow({ id: "p3", location_lat: null, location_lng: null }),
    ];
    mock.queue("projects", [{ data: rows, error: null, count: 3 }]);
    queueRegistrations();

    const result = await listProjects(volunteerIdentity(), {
      page: 1,
      limit: 20,
      near_km: 10,
    });

    expect(result.total).toBe(3);
    expect(result.data.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(result.data.every((p) => p.distance_km === null)).toBe(true);
  });

  it("ignores the filter when the volunteer profile row is missing", async () => {
    queueVolunteerLocation(null);
    const rows = [projectRow({ id: "p1" })];
    mock.queue("projects", [{ data: rows, error: null, count: 1 }]);
    queueRegistrations();

    const result = await listProjects(volunteerIdentity(), {
      page: 1,
      limit: 20,
      near_km: 10,
    });

    expect(result.total).toBe(1);
    expect(result.data[0].id).toBe("p1");
    expect(result.data[0].distance_km).toBeNull();
  });

  it("ignores near_km for NGO callers (no profile location)", async () => {
    const rows = [
      projectRow({ id: "p1" }),
      projectRow({ id: "p2", location_lat: 26.86, location_lng: 68.0 }),
    ];
    mock.queue("projects", [{ data: rows, error: null, count: 2 }]);
    queueRegistrations();

    const result = await listProjects(ngoIdentity(), {
      page: 1,
      limit: 20,
      near_km: 10,
    });

    expect(result.total).toBe(2);
    expect(result.data.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(result.data.every((p) => p.distance_km === null)).toBe(true);
  });

  it("returns distance_km null when no proximity filter is active", async () => {
    const rows = [projectRow({ id: "p1" })];
    mock.queue("projects", [{ data: rows, error: null, count: 1 }]);
    queueRegistrations();

    const result = await listProjects(volunteerIdentity(), { page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.data[0].distance_km).toBeNull();
  });
});
