import type { ApiListResponse } from "./api";
import type { ApiFetcher, ApiListFetcher } from "./projects";
import type { RegistrationStatus, RegistrationSummary } from "@/types/registration";

/**
 * Typed wrappers around the registrations REST API (api-contracts.md
 * "Registrations Module"). registerForProject sends ONLY the project id -
 * the volunteer identity is resolved server-side from the session.
 */
export interface RegistrationListParams {
  page?: number;
  limit?: number;
  project_id?: string;
  status?: RegistrationStatus;
}

type RegisterResult = { id: string; status: RegistrationStatus; registered_at: string };
type CancelResult = { id: string; status: RegistrationStatus; cancelled_at: string | null };

export function registerForProject(api: ApiFetcher, projectId: string): Promise<RegisterResult> {
  return api<RegisterResult>("/registrations", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId }),
  });
}

export function listRegistrations(
  apiList: ApiListFetcher,
  params: RegistrationListParams = {}
): Promise<ApiListResponse<RegistrationSummary>> {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.project_id) search.set("project_id", params.project_id);
  if (params.status) search.set("status", params.status);
  const qs = search.toString();
  return apiList<RegistrationSummary>(`/registrations${qs ? `?${qs}` : ""}`);
}

export function cancelRegistration(api: ApiFetcher, id: string): Promise<CancelResult> {
  return api<CancelResult>(`/registrations/${id}/cancel`, { method: "PUT" });
}
