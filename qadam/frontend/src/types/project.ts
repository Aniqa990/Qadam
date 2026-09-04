/**
 * Frontend mirrors of the projects API DTOs (api-contracts.md "Projects
 * Module" / backend types/project.types.ts). Keep in sync with the backend.
 */
export type ProjectStatus = "draft" | "published" | "active" | "completed" | "cancelled";

export interface ProjectEligibility {
  min_age?: number;
  custom_requirements?: string[];
}

/** List item shape returned by GET /api/projects. */
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
  /** Haversine km from the caller's profile pin; present only while a
   * near_km proximity filter is active. */
  distance_km?: number | null;
}

/** Full shape returned by GET /api/projects/:id. */
export interface ProjectDetail extends ProjectSummary {
  responsibilities: string[];
  eligibility: ProjectEligibility;
  event_date: string | null;
  location_lat: number | null;
  location_lng: number | null;
  hours_per_session: number | null;
  created_at: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
