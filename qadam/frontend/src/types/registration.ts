import type { ProjectStatus } from "./project";

/**
 * Frontend mirrors of the registrations API DTOs (api-contracts.md
 * "Registrations Module" / backend types/registration.types.ts). Keep these
 * in sync with the backend.
 */
export type RegistrationStatus = "confirmed" | "cancelled";

/** List item shape returned by GET /api/registrations. */
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
