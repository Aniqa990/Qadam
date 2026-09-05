import type { ProjectStatus } from "./project.types";

/**
 * Domain and DTO shapes for the registrations module (Phase 5 -
 * implementation-plan.md). The volunteer id is ALWAYS derived from the
 * authenticated identity in registration.service - a client-supplied
 * volunteer_id is never accepted (api-contracts.md "Registrations Module").
 */
export type RegistrationStatus = "confirmed" | "cancelled" | "completed";

/**
 * Raw `registrations` row plus the joined columns the list/detail queries
 * embed (volunteer name for NGO callers, project info for both roles).
 */
export interface RegistrationRow {
  id: string;
  volunteer_id: string;
  project_id: string;
  status: RegistrationStatus;
  registered_at: string;
  cancelled_at: string | null;
  volunteer?: { full_name: string } | null;
  project?: {
    title: string;
    status: ProjectStatus;
    start_date: string;
    end_date: string;
    location_name: string | null;
    ngo_id: string;
  } | null;
}

/**
 * List/detail response shape. The project_* fields beyond the contract's
 * project_title (status, dates, location) let the UI render meaningful
 * registration cards without extra round-trips; they are a superset, not a
 * divergence, of api-contracts.md.
 */
export interface RegistrationSummary {
  id: string;
  volunteer_id: string;
  volunteer_name: string;
  project_id: string;
  project_title: string;
  project_status: ProjectStatus;
  project_start_date: string;
  project_end_date: string;
  project_location_name: string | null;
  status: RegistrationStatus;
  registered_at: string;
  cancelled_at: string | null;
}
