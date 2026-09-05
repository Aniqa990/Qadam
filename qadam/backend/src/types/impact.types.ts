/**
 * Domain/DTO shapes for the impact module (api-contracts.md "Impact Module").
 * GET /api/impact/ngo returns exactly the object produced by the
 * `ngo_impact_metrics` PostgreSQL function (migration 013) - every value is
 * aggregated in the database from projects + registrations + attendance;
 * nothing is stored or maintained separately.
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
   * check-in on the NGO's projects, rounded to 4 decimals; 0 when nobody
   * is registered. Bounded [0, 1].
   */
  attendance_rate: number;
  by_cause: CauseBreakdownItem[];
  by_location: LocationBreakdownItem[];
  by_month: MonthlyHoursItem[];
}
