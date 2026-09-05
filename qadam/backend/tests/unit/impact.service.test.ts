import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestIdentity } from "../../src/types/auth.types";
import type { NgoImpactMetrics } from "../../src/types/impact.types";

/**
 * Unit tests for impact.service's NGO metrics endpoint. The service talks to
 * exactly one database function, so the Supabase client is module-mocked with
 * an RPC-only mock that queues results per function name (same idea as
 * matching.service.test.ts) and records every rpc call so tests can assert
 * the NGO id is derived from the authenticated identity, never the client.
 */

type QueryResult = { data?: unknown; error?: unknown };

vi.mock("../../src/lib/supabase", () => {
  const rpcQueues = new Map<string, QueryResult[]>();
  const rpcCalls: { fn: string; args: unknown }[] = [];

  const supabase = {
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      const queue = rpcQueues.get(fn);
      const next = queue?.shift();
      return Promise.resolve(next ?? { data: null, error: null });
    },
  };

  return {
    supabase,
    __mock: {
      rpcCalls,
      queueRpc(fn: string, results: QueryResult[]) {
        rpcQueues.set(fn, [...results]);
      },
      reset() {
        rpcCalls.length = 0;
        rpcQueues.clear();
      },
    },
  };
});

import * as supabaseModule from "../../src/lib/supabase";
import { getNgoImpactMetrics } from "../../src/services/impact.service";
import { AppError, AuthorizationError } from "../../src/utils/errors";

const mock = (supabaseModule as unknown as { __mock: {
  rpcCalls: { fn: string; args: unknown }[];
  queueRpc: (fn: string, results: QueryResult[]) => void;
  reset: () => void;
} }).__mock;

// -- fixtures ----------------------------------------------------------------

function ngoIdentity(domainId = "ngo-1"): RequestIdentity {
  return {
    clerkUserId: "user_ngo",
    role: "ngo",
    email: "ngo@example.com",
    domainId,
    profile: { id: domainId },
  };
}

const volunteerIdentity = (): RequestIdentity => ({
  clerkUserId: "user_vol",
  role: "volunteer",
  email: "vol@example.com",
  domainId: "vol-1",
  profile: { id: "vol-1" },
});

function metricsPayload(overrides: Partial<NgoImpactMetrics> = {}): NgoImpactMetrics {
  return {
    total_projects: 8,
    active_projects: 2,
    completed_projects: 5,
    total_volunteers: 85,
    total_hours: 1250.0,
    attendance_rate: 0.7647,
    by_cause: [
      { category: "education", projects: 4, volunteers: 50, hours: 800.5 },
      { category: "environment", projects: 4, volunteers: 35, hours: 449.5 },
    ],
    by_location: [
      { location: "Jeddah, Saudi Arabia", projects: 5, volunteers: 60, hours: 900.0 },
      { location: "Riyadh, Saudi Arabia", projects: 3, volunteers: 25, hours: 350.0 },
    ],
    by_month: [
      { month: "2026-07", hours: 120.0 },
      { month: "2026-08", hours: 210.0 },
    ],
    ...overrides,
  };
}

// -- getNgoImpactMetrics -------------------------------------------------------

describe("getNgoImpactMetrics", () => {
  beforeEach(() => mock.reset());

  it("rejects volunteer callers with 403 before any data access", async () => {
    await expect(getNgoImpactMetrics(volunteerIdentity())).rejects.toBeInstanceOf(
      AuthorizationError
    );
    expect(mock.rpcCalls).toHaveLength(0);
  });

  it("aggregates via the ngo_impact_metrics RPC scoped to the caller's NGO id", async () => {
    mock.queueRpc("ngo_impact_metrics", [{ data: metricsPayload(), error: null }]);

    const result = await getNgoImpactMetrics(ngoIdentity("ngo-42"));

    expect(result).toEqual(metricsPayload());
    // The NGO id comes from the authenticated identity, never the request.
    expect(mock.rpcCalls).toEqual([
      { fn: "ngo_impact_metrics", args: { p_ngo_id: "ngo-42" } },
    ]);
  });

  it("rounds attendance_rate to 4 decimals", async () => {
    mock.queueRpc("ngo_impact_metrics", [
      { data: metricsPayload({ attendance_rate: 0.7654321 }), error: null },
    ]);

    const result = await getNgoImpactMetrics(ngoIdentity());

    expect(result.attendance_rate).toBe(0.7654);
  });

  it("normalizes a zero-state NGO (no projects, no attendance)", async () => {
    mock.queueRpc("ngo_impact_metrics", [
      {
        data: metricsPayload({
          total_projects: 0,
          active_projects: 0,
          completed_projects: 0,
          total_volunteers: 0,
          total_hours: 0,
          attendance_rate: 0,
          by_cause: [],
          by_location: [],
          by_month: [],
        }),
        error: null,
      },
    ]);

    const result = await getNgoImpactMetrics(ngoIdentity());

    expect(result).toMatchObject({
      total_projects: 0,
      total_volunteers: 0,
      total_hours: 0,
      attendance_rate: 0,
      by_cause: [],
      by_location: [],
      by_month: [],
    });
  });

  it("fills defaults when the payload misses breakdown arrays", async () => {
    mock.queueRpc("ngo_impact_metrics", [
      {
        data: metricsPayload({
          total_projects: 1,
          by_cause: undefined,
          by_location: undefined,
          by_month: undefined,
        }),
        error: null,
      },
    ]);

    const result = await getNgoImpactMetrics(ngoIdentity());

    expect(result.total_projects).toBe(1);
    expect(result.by_cause).toEqual([]);
    expect(result.by_location).toEqual([]);
    expect(result.by_month).toEqual([]);
  });

  it("maps an RPC error to a 500 AppError", async () => {
    mock.queueRpc("ngo_impact_metrics", [
      { data: null, error: { message: "function not found" } },
    ]);

    const rejection = getNgoImpactMetrics(ngoIdentity());

    await expect(rejection).rejects.toBeInstanceOf(AppError);
    await expect(rejection).rejects.toMatchObject({
      statusCode: 500,
      code: "INTERNAL_ERROR",
    });
  });

  it("treats a null RPC result as a server error", async () => {
    mock.queueRpc("ngo_impact_metrics", [{ data: null, error: null }]);

    await expect(getNgoImpactMetrics(ngoIdentity())).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});
