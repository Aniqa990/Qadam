import type { RequestIdentity } from "../types/auth.types";
import type { NgoImpactMetrics } from "../types/impact.types";
import { supabase } from "../lib/supabase";
import { AppError, AuthorizationError } from "../utils/errors";

/**
 * NGO impact metrics (api-contracts.md "Impact Module"). All arithmetic is
 * PostgreSQL aggregation inside the `ngo_impact_metrics` function (migration
 * 013) - the service only authorizes, calls the function once (no N+1), and
 * defensively normalizes the result. No AI/RAG is involved anywhere here.
 *
 * Authorization: the NGO id is ALWAYS identity.domainId, resolved from the
 * authenticated Clerk session by resolveUserMiddleware - it is never read
 * from the request, so an NGO can only ever aggregate its own rows.
 */

/** Rounds to 4 decimals (guards float noise from the JSON round trip). */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toHours(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 100) / 100
    : 0;
}

/**
 * The RPC result already has the right shape (our own SQL); this only fills
 * defaults so a malformed payload can never crash the endpoint - the metric
 * definitions themselves live entirely in the database function.
 */
function normalizeMetrics(raw: NgoImpactMetrics): NgoImpactMetrics {
  return {
    total_projects: toCount(raw.total_projects),
    active_projects: toCount(raw.active_projects),
    completed_projects: toCount(raw.completed_projects),
    total_volunteers: toCount(raw.total_volunteers),
    total_hours: toHours(raw.total_hours),
    attendance_rate: round4(toCount(raw.attendance_rate)),
    by_cause: (raw.by_cause ?? []).map((item) => ({
      category: item.category,
      projects: toCount(item.projects),
      volunteers: toCount(item.volunteers),
      hours: toHours(item.hours),
    })),
    by_location: (raw.by_location ?? []).map((item) => ({
      location: item.location,
      projects: toCount(item.projects),
      volunteers: toCount(item.volunteers),
      hours: toHours(item.hours),
    })),
    by_month: (raw.by_month ?? []).map((item) => ({
      month: item.month,
      hours: toHours(item.hours),
    })),
  };
}

/**
 * GET /api/impact/ngo - the authenticated NGO's verified impact metrics:
 * totals, attendance rate, and breakdowns by cause, location, and month.
 */
export async function getNgoImpactMetrics(identity: RequestIdentity): Promise<NgoImpactMetrics> {
  if (identity.role !== "ngo") {
    throw new AuthorizationError("Only NGO accounts can view impact metrics");
  }

  const { data, error } = await supabase.rpc("ngo_impact_metrics", {
    p_ngo_id: identity.domainId,
  });
  if (error) {
    throw new AppError(`Failed to compute impact metrics: ${error.message}`, 500);
  }
  if (!data) {
    throw new AppError("Failed to compute impact metrics", 500);
  }

  return normalizeMetrics(data as unknown as NgoImpactMetrics);
}
