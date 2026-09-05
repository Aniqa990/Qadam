/**
 * Impact DTOs mirroring api-contracts.md "Impact Module" and the backend's
 * impact.types.ts - keep both sides in sync. Every value is aggregated
 * server-side by PostgreSQL (ngo_impact_metrics function); the client only
 * renders them.
 */

/** Verified hours per cause (projects.category). */
export interface CauseBreakdownItem {
  category: string;
  projects: number;
  volunteers: number;
  hours: number;
}

/** Verified hours per location (projects.location_name, "City, Country"). */
export interface LocationBreakdownItem {
  location: string;
  projects: number;
  volunteers: number;
  hours: number;
}

/** Verified hours per calendar month of check-in, chronological. */
export interface MonthlyHoursItem {
  /** "YYYY-MM" */
  month: string;
  hours: number;
}

/** GET /api/impact/ngo response (NGO-only, own metrics). */
export interface NgoImpactMetrics {
  /** All projects owned by the NGO, any status. */
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  /** Distinct volunteers with a confirmed registration on the NGO's projects. */
  total_volunteers: number;
  /** SUM(attendance.hours) where check_out IS NOT NULL (verified only). */
  total_hours: number;
  /**
   * Share of the confirmed-registered volunteers who have at least one
   * check-in on the NGO's projects; 0 when nobody is registered. [0, 1].
   */
  attendance_rate: number;
  by_cause: CauseBreakdownItem[];
  by_location: LocationBreakdownItem[];
  by_month: MonthlyHoursItem[];
}
