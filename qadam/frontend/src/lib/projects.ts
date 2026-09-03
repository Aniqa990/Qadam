import type { ApiListResponse } from "./api";
import type { ProjectDetail, ProjectStatus, ProjectSummary } from "@/types/project";

/**
 * Typed wrappers around the projects REST API (api-contracts.md "Projects
 * Module"). Pages pass in the authed fetcher from useApi() so components stay
 * free of auth/header concerns (AGENTS.md frontend rules).
 */
export type ApiFetcher = <T>(path: string, init?: RequestInit) => Promise<T>;
export type ApiListFetcher = <T>(path: string, init?: RequestInit) => Promise<ApiListResponse<T>>;

export type ProjectAction = "publish" | "activate" | "complete" | "cancel";

/** Curated cause list for the category picker; the backend stores free text. */
export const PROJECT_CATEGORIES = [
  "education",
  "health",
  "environment",
  "community",
  "youth",
  "sports",
  "arts",
  "food-security",
  "emergency-relief",
  "animal-welfare",
  "technology",
  "other",
] as const;

export interface ProjectListParams {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
  category?: string;
  search?: string;
  /** Lowercased skill; matched against required_skills (array contains). */
  skill?: string;
  /** Substring match against the cached "City, Country" label. */
  location?: string;
  /** Date-overlap window (YYYY-MM-DD): project runs at any point within it. */
  date_from?: string;
  date_to?: string;
}

export interface ProjectFormPayload {
  title: string;
  description: string;
  category: string;
  required_skills: string[];
  responsibilities: string[];
  eligibility: { min_age?: number; custom_requirements?: string[] };
  capacity: number;
  whatsapp_group_url: string | null;
  start_date: string;
  end_date: string;
  event_date: string | null;
  location_lat: number;
  location_lng: number;
  hours_per_session: number;
}

type StatusResult = { id: string; status: ProjectStatus };

export function listProjects(api: ApiListFetcher, params: ProjectListParams = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.status) search.set("status", params.status);
  if (params.category) search.set("category", params.category);
  if (params.search) search.set("search", params.search);
  if (params.skill) search.set("skill", params.skill.toLowerCase());
  if (params.location) search.set("location", params.location);
  if (params.date_from) search.set("date_from", params.date_from);
  if (params.date_to) search.set("date_to", params.date_to);
  const qs = search.toString();
  return api<ProjectSummary>(`/projects${qs ? `?${qs}` : ""}`);
}

export function getProject(api: ApiFetcher, id: string): Promise<ProjectDetail> {
  return api<ProjectDetail>(`/projects/${id}`);
}

export function createProject(api: ApiFetcher, input: ProjectFormPayload): Promise<StatusResult> {
  return api<StatusResult>("/projects", { method: "POST", body: JSON.stringify(input) });
}

export function updateProject(
  api: ApiFetcher,
  id: string,
  input: Partial<ProjectFormPayload>
): Promise<StatusResult> {
  return api<StatusResult>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteProject(api: ApiFetcher, id: string): Promise<{ message: string }> {
  return api<{ message: string }>(`/projects/${id}`, { method: "DELETE" });
}

export function transitionProject(
  api: ApiFetcher,
  id: string,
  action: ProjectAction
): Promise<StatusResult> {
  return api<StatusResult>(`/projects/${id}/${action}`, { method: "POST" });
}
