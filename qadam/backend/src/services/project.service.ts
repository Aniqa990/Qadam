import type { RequestIdentity } from "../types/auth.types";
import type { ProjectDetail, ProjectRow, ProjectStatus, ProjectSummary } from "../types/project.types";
import type { CreateProjectBody, ListProjectsQuery, UpdateProjectBody } from "../validators/project.validator";
import { supabase } from "../lib/supabase";
import { reverseGeocode } from "./geocoding.service";
import { regenerateProjectEmbedding } from "./ai/embedding.service";
import { logger } from "../utils/logger";
import {
  AppError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../utils/errors";

/**
 * Projects business logic (Phase 4 - implementation-plan.md). Authorization
 * invariants enforced here, never in the client:
 *   - ngo_id always comes from req.identity.domainId, never the request body
 *   - only the owning NGO can modify a project
 *   - drafts are invisible to non-owners (read as 404)
 *   - status only changes through validated lifecycle transitions
 *   - capacity can never be lowered below the confirmed registration count
 */

/** Draft projects are invisible to volunteers (and other NGOs). */
const VOLUNTEER_VISIBLE_STATUSES: readonly ProjectStatus[] = ["published", "active", "completed"];

/** Terminal states: no edits, no transitions, no new registrations. */
const TERMINAL_STATUSES: readonly ProjectStatus[] = ["completed", "cancelled"];

/** Allowed lifecycle transitions - anything else is a 409 conflict. */
const STATUS_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  draft: ["published"],
  published: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

interface ListResult {
  data: ProjectSummary[];
  page: number;
  limit: number;
  total: number;
}

function isOwner(identity: RequestIdentity, row: Pick<ProjectRow, "ngo_id">): boolean {
  return identity.role === "ngo" && identity.domainId === row.ngo_id;
}

function sameStrings(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Fire-and-forget: an embedding failure must never fail a core write. */
function triggerEmbeddingRegeneration(projectId: string): void {
  regenerateProjectEmbedding(projectId).catch((err) => {
    logger.error("Project embedding regeneration failed", {
      projectId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

async function countConfirmedRegistrations(projectId: string): Promise<number> {
  const { count, error } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("status", "confirmed");
  if (error) {
    throw new AppError(`Failed to count registrations: ${error.message}`, 500);
  }
  return count ?? 0;
}

async function fetchConfirmedCounts(projectIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (projectIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("registrations")
    .select("project_id")
    .eq("status", "confirmed")
    .in("project_id", projectIds);
  if (error) {
    throw new AppError(`Failed to count registrations: ${error.message}`, 500);
  }
  for (const row of (data ?? []) as { project_id: string }[]) {
    counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1);
  }
  return counts;
}

function toSummary(row: ProjectRow, registeredCount: number): ProjectSummary {
  return {
    id: row.id,
    ngo_id: row.ngo_id,
    ngo_name: row.ngo?.name ?? "",
    title: row.title,
    description: row.description,
    category: row.category,
    required_skills: row.required_skills,
    capacity: row.capacity,
    registered_count: registeredCount,
    whatsapp_group_url: row.whatsapp_group_url,
    status: row.status,
    start_date: row.start_date,
    end_date: row.end_date,
    location_name: row.location_name,
  };
}

function toDetail(row: ProjectRow, registeredCount: number): ProjectDetail {
  return {
    ...toSummary(row, registeredCount),
    responsibilities: row.responsibilities,
    eligibility: row.eligibility ?? {},
    event_date: row.event_date,
    location_lat: row.location_lat,
    location_lng: row.location_lng,
    hours_per_session: row.hours_per_session,
    created_at: row.created_at,
  };
}

/**
 * Loads a project and enforces write ownership: 404 when it doesn't exist,
 * 403 when the caller isn't the owning NGO. Client-supplied project ids are
 * only ever used as lookup keys - ownership is derived from req.identity.
 */
async function loadProjectForOwner(identity: RequestIdentity, projectId: string): Promise<ProjectRow> {
  const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (error) {
    throw new AppError(`Failed to load project: ${error.message}`, 500);
  }
  if (!data) {
    throw new NotFoundError("Project not found");
  }
  const row = data as unknown as ProjectRow;
  if (!isOwner(identity, row)) {
    throw new AuthorizationError("Only the organization that owns this project can modify it");
  }
  return row;
}

/**
 * GET /api/projects - role-scoped listing. NGOs see all of their own projects
 * (drafts included); volunteers only ever see published/active/completed.
 */
export async function listProjects(
  identity: RequestIdentity,
  query: ListProjectsQuery
): Promise<ListResult> {
  const { page, limit } = query;

  let status = query.status;
  if (identity.role !== "ngo") {
    // A volunteer asking for drafts (or any non-visible status) simply gets
    // an empty list - the status is invisible to them, not an error.
    if (status && !(VOLUNTEER_VISIBLE_STATUSES as readonly ProjectStatus[]).includes(status)) {
      return { data: [], page, limit, total: 0 };
    }
    status = status ?? undefined;
  }

  let dbQuery = supabase.from("projects").select("*, ngo:ngos(name)", { count: "exact" });
  if (identity.role === "ngo") {
    dbQuery = dbQuery.eq("ngo_id", identity.domainId);
  } else {
    dbQuery = dbQuery.in("status", [...VOLUNTEER_VISIBLE_STATUSES]);
  }
  if (status) {
    dbQuery = dbQuery.eq("status", status);
  }
  if (query.category) {
    dbQuery = dbQuery.eq("category", query.category);
  }
  // Deterministic discovery filters (Phase 5): skill containment on the
  // lowercased TEXT[] column, substring match on the cached location label,
  // and a date-overlap window (project runs at any point within it).
  if (query.skill) {
    dbQuery = dbQuery.contains("required_skills", [query.skill]);
  }
  if (query.location) {
    dbQuery = dbQuery.ilike("location_name", `%${query.location}%`);
  }
  if (query.date_from) {
    dbQuery = dbQuery.gte("end_date", query.date_from);
  }
  if (query.date_to) {
    dbQuery = dbQuery.lte("start_date", query.date_to);
  }
  // Strip PostgREST or-filter reserved characters so search terms can't break
  // (or inject) the embedded filter expression.
  const searchTerm = query.search?.replace(/[,()"]/g, " ").trim();
  if (searchTerm) {
    dbQuery = dbQuery.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
  }

  const { data, error, count } = await dbQuery
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (error) {
    throw new AppError(`Failed to list projects: ${error.message}`, 500);
  }

  const rows = (data ?? []) as unknown as ProjectRow[];
  const confirmedCounts = await fetchConfirmedCounts(rows.map((row) => row.id));

  return {
    data: rows.map((row) => toSummary(row, confirmedCounts.get(row.id) ?? 0)),
    page,
    limit,
    total: count ?? 0,
  };
}

/**
 * GET /api/projects/:id - full detail. Drafts are visible ONLY to the owning
 * NGO; for anyone else a draft reads as 404 so their existence isn't leaked.
 */
export async function getProject(identity: RequestIdentity, projectId: string): Promise<ProjectDetail> {
  const { data, error } = await supabase
    .from("projects")
    .select("*, ngo:ngos(name)")
    .eq("id", projectId)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to load project: ${error.message}`, 500);
  }
  if (!data) {
    throw new NotFoundError("Project not found");
  }

  const row = data as unknown as ProjectRow;
  if (row.status === "draft" && !isOwner(identity, row)) {
    throw new NotFoundError("Project not found");
  }

  return toDetail(row, await countConfirmedRegistrations(projectId));
}

/**
 * POST /api/projects - creates a new project as a draft. The owner is ALWAYS
 * the authenticated NGO (req.identity.domainId); location_name is resolved
 * server-side from the exact pin and cached in the row.
 */
export async function createProject(
  identity: RequestIdentity,
  input: CreateProjectBody
): Promise<{ id: string; status: ProjectStatus }> {
  if (identity.role !== "ngo") {
    throw new AuthorizationError("Only NGO accounts can create projects");
  }

  // Best-effort display label; a geocoder outage never blocks creation.
  const locationName = await reverseGeocode(input.location_lat, input.location_lng);

  const { data, error } = await supabase
    .from("projects")
    .insert({
      ngo_id: identity.domainId,
      title: input.title,
      description: input.description,
      category: input.category,
      required_skills: input.required_skills,
      responsibilities: input.responsibilities,
      eligibility: input.eligibility,
      capacity: input.capacity,
      whatsapp_group_url: input.whatsapp_group_url ?? null,
      status: "draft",
      start_date: input.start_date,
      end_date: input.end_date,
      event_date: input.event_date ?? null,
      location_lat: input.location_lat,
      location_lng: input.location_lng,
      location_name: locationName,
      hours_per_session: input.hours_per_session ?? 0,
    })
    .select("id")
    .single();
  if (error) {
    throw new AppError(`Failed to create project: ${error.message}`, 500);
  }

  triggerEmbeddingRegeneration(data.id);
  return { id: data.id, status: "draft" };
}

/**
 * PUT /api/projects/:id - partial update. Completed/cancelled projects are
 * immutable; capacity can't drop below confirmed registrations; a moved pin
 * re-resolves its "City, Country" label; embedding-relevant content changes
 * trigger embedding regeneration.
 */
export async function updateProject(
  identity: RequestIdentity,
  projectId: string,
  input: UpdateProjectBody
): Promise<{ id: string; status: ProjectStatus }> {
  const row = await loadProjectForOwner(identity, projectId);

  if (TERMINAL_STATUSES.includes(row.status)) {
    throw new ConflictError("Completed or cancelled projects can no longer be edited");
  }

  // Cross-field rules are checked against the MERGED record (a patch may only
  // send end_date, which still has to clear the stored start_date).
  const startDate = input.start_date ?? row.start_date;
  const endDate = input.end_date ?? row.end_date;
  if (endDate < startDate) {
    throw new ValidationError("End date must be on or after start date");
  }

  if (input.capacity !== undefined && input.capacity < row.capacity) {
    const confirmed = await countConfirmedRegistrations(projectId);
    if (input.capacity < confirmed) {
      throw new AppError(
        `Capacity cannot be lower than the ${confirmed} confirmed registration(s) for this project`,
        400,
        "CAPACITY_BELOW_CONFIRMED"
      );
    }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) update.title = input.title;
  if (input.description !== undefined) update.description = input.description;
  if (input.category !== undefined) update.category = input.category;
  if (input.required_skills !== undefined) update.required_skills = input.required_skills;
  if (input.responsibilities !== undefined) update.responsibilities = input.responsibilities;
  if (input.eligibility !== undefined) update.eligibility = input.eligibility;
  if (input.capacity !== undefined) update.capacity = input.capacity;
  if (input.whatsapp_group_url !== undefined) update.whatsapp_group_url = input.whatsapp_group_url;
  if (input.start_date !== undefined) update.start_date = input.start_date;
  if (input.end_date !== undefined) update.end_date = input.end_date;
  if (input.event_date !== undefined) update.event_date = input.event_date;
  if (input.hours_per_session !== undefined) update.hours_per_session = input.hours_per_session;

  const latChanged = input.location_lat !== undefined && input.location_lat !== row.location_lat;
  const lngChanged = input.location_lng !== undefined && input.location_lng !== row.location_lng;
  if (latChanged || lngChanged) {
    const lat = input.location_lat as number;
    const lng = input.location_lng as number;
    update.location_lat = lat;
    update.location_lng = lng;
    // Re-resolve (and cache) the display label only when the pin actually moved.
    update.location_name = await reverseGeocode(lat, lng);
  }

  const { error } = await supabase.from("projects").update(update).eq("id", projectId);
  if (error) {
    throw new AppError(`Failed to update project: ${error.message}`, 500);
  }

  // Embedding input is title + category + description + required_skills +
  // responsibilities (database-schema.md "project_embeddings") - regenerate
  // whenever any of them changed.
  const embeddingContentChanged =
    (input.title !== undefined && input.title !== row.title) ||
    (input.description !== undefined && input.description !== row.description) ||
    (input.category !== undefined && input.category !== row.category) ||
    (input.required_skills !== undefined && !sameStrings(input.required_skills, row.required_skills)) ||
    (input.responsibilities !== undefined && !sameStrings(input.responsibilities, row.responsibilities));
  if (embeddingContentChanged) {
    triggerEmbeddingRegeneration(projectId);
  }

  return { id: row.id, status: row.status };
}

/**
 * DELETE /api/projects/:id - drafts only. Once a project has been published
 * it may have registrations/attendance history and must be cancelled instead.
 */
export async function deleteProject(
  identity: RequestIdentity,
  projectId: string
): Promise<{ message: string }> {
  const row = await loadProjectForOwner(identity, projectId);

  if (row.status !== "draft") {
    throw new ConflictError("Only draft projects can be deleted - cancel the project instead");
  }

  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) {
    throw new AppError(`Failed to delete project: ${error.message}`, 500);
  }
  return { message: "Project deleted" };
}

/**
 * POST /api/projects/:id/publish|activate|complete|cancel - validated status
 * transitions. Cancelling also cancels the project's confirmed registrations
 * (api-contracts.md); publishing kicks off embedding generation.
 */
export async function transitionProject(
  identity: RequestIdentity,
  projectId: string,
  target: ProjectStatus
): Promise<{ id: string; status: ProjectStatus }> {
  const row = await loadProjectForOwner(identity, projectId);

  const allowed = STATUS_TRANSITIONS[row.status];
  if (!allowed.includes(target)) {
    throw new ConflictError(`A project in '${row.status}' status cannot be moved to '${target}'`);
  }

  const { error } = await supabase
    .from("projects")
    .update({ status: target, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) {
    throw new AppError(`Failed to update project status: ${error.message}`, 500);
  }

  if (target === "cancelled") {
    await cancelConfirmedRegistrations(projectId);
  }
  if (target === "published") {
    triggerEmbeddingRegeneration(projectId);
  }

  return { id: row.id, status: target };
}

/**
 * Cancelling a project cancels every confirmed registration on it. Runs after
 * the project itself is cancelled (the source of truth) - if this update
 * fails we log loudly rather than failing the whole transition, since the
 * project status is already committed.
 */
async function cancelConfirmedRegistrations(projectId: string): Promise<void> {
  const { error } = await supabase
    .from("registrations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("status", "confirmed");
  if (error) {
    logger.error("Failed to cancel registrations for cancelled project", {
      projectId,
      error: error.message,
    });
  }
}
