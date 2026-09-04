/**
 * Domain/DTO shapes for the projects module (Phase 4 - implementation-plan.md).
 * Request-payload shapes live in validators/project.validator.ts (z.infer);
 * this file owns the database row shape and the API response DTOs from
 * api-contracts.md "Projects Module".
 */
export type ProjectStatus = "draft" | "upcoming" | "active" | "completed" | "cancelled";

/**
 * projects.eligibility JSONB shape (database-schema.md). min_age is the only
 * machine-enforced key (checked server-side at registration/matching time);
 * custom_requirements is free text shown to volunteers, not machine-validated.
 */
export interface ProjectEligibility {
  min_age?: number;
  custom_requirements?: string[];
}

/** Raw `projects` row as returned by Supabase (DATE columns arrive as YYYY-MM-DD strings). */
export interface ProjectRow {
  id: string;
  ngo_id: string;
  title: string;
  description: string;
  required_skills: string[];
  category: string;
  responsibilities: string[];
  eligibility: ProjectEligibility;
  capacity: number;
  whatsapp_group_url: string | null;
  status: ProjectStatus;
  start_date: string;
  end_date: string;
  event_date: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  hours_per_session: number | null;
  created_at: string;
  updated_at: string;
  /** Present when the query embeds ngos(name) - list/detail only. */
  ngo?: { name: string } | null;
}

/** List-item shape per api-contracts.md `GET /api/projects`. */
export interface ProjectSummary {
  id: string;
  ngo_id: string;
  ngo_name: string;
  title: string;
  description: string;
  category: string;
  required_skills: string[];
  capacity: number;
  registered_count: number;
  whatsapp_group_url: string | null;
  status: ProjectStatus;
  start_date: string;
  end_date: string;
  location_name: string | null;
  /** Haversine km from the caller's profile pin; populated only while a
   * near_km proximity filter is active, null otherwise. */
  distance_km: number | null;
}

/** Full detail shape per api-contracts.md `GET /api/projects/:id`. */
export interface ProjectDetail extends ProjectSummary {
  responsibilities: string[];
  eligibility: ProjectEligibility;
  event_date: string | null;
  location_lat: number | null;
  location_lng: number | null;
  hours_per_session: number | null;
  created_at: string;
}
