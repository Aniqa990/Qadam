import type { RequestIdentity } from "../types/auth.types";
import type { ProjectRow, ProjectStatus } from "../types/project.types";
import type {
  RegistrationRow,
  RegistrationStatus,
  RegistrationSummary,
} from "../types/registration.types";
import type {
  CreateRegistrationBody,
  ListRegistrationsQuery,
} from "../validators/registration.validator";
import { supabase } from "../lib/supabase";
import {
  AppError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
} from "../utils/errors";

/**
 * Registrations business logic (Phase 5 - implementation-plan.md). The
 * authenticated identity is the ONLY source of the volunteer id - a
 * client-supplied volunteer_id is never read. Invariants enforced here:
 *   - only volunteers with a completed profile can register
 *   - drafts are invisible (they read as 404), completed/cancelled projects
 *     are closed for registration
 *   - one registration per (volunteer, project): a duplicate is a 409; a
 *     previously cancelled registration is reactivated in place (the DB
 *     unique constraint forbids a second row)
 *   - confirmed registrations can never exceed the project's capacity
 *   - min_age eligibility is checked deterministically against the profile
 */

/** Projects in these statuses accept new registrations. */
const REGISTRABLE_STATUSES: readonly ProjectStatus[] = ["upcoming", "active"];

/** Joined select shared by every registrations query in this module. */
const REGISTRATION_SELECT =
  "*, volunteer:volunteers(full_name), project:projects(title, status, start_date, end_date, location_name, ngo_id)";

interface ListResult {
  data: RegistrationSummary[];
  page: number;
  limit: number;
  total: number;
}

/**
 * Kept local (project.service has its own private copy) so this module's
 * test/import graph stays decoupled from the projects service chain.
 */
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

function toSummary(row: RegistrationRow): RegistrationSummary {
  return {
    id: row.id,
    volunteer_id: row.volunteer_id,
    volunteer_name: row.volunteer?.full_name ?? "",
    project_id: row.project_id,
    project_title: row.project?.title ?? "",
    project_status: row.project?.status ?? "cancelled",
    project_start_date: row.project?.start_date ?? "",
    project_end_date: row.project?.end_date ?? "",
    project_location_name: row.project?.location_name ?? null,
    status: row.status,
    registered_at: row.registered_at,
    cancelled_at: row.cancelled_at,
  };
}

/**
 * Loads a registration and enforces access: volunteers may only touch their
 * own, NGOs only those on their own projects. Anything else reads as 404 so
 * existence isn't leaked across accounts.
 */
async function loadRegistrationForAccess(
  identity: RequestIdentity,
  registrationId: string
): Promise<RegistrationRow> {
  const { data, error } = await supabase
    .from("registrations")
    .select(REGISTRATION_SELECT)
    .eq("id", registrationId)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to load registration: ${error.message}`, 500);
  }
  if (!data) {
    throw new NotFoundError("Registration not found");
  }

  const row = data as unknown as RegistrationRow;
  const allowed =
    identity.role === "volunteer"
      ? row.volunteer_id === identity.domainId
      : row.project?.ngo_id === identity.domainId;
  if (!allowed) {
    throw new NotFoundError("Registration not found");
  }
  return row;
}

/**
 * POST /api/registrations - registers the authenticated volunteer. Runs the
 * full deterministic guard chain from api-contracts.md before writing.
 */
export async function register(
  identity: RequestIdentity,
  input: CreateRegistrationBody
): Promise<{ id: string; status: RegistrationStatus; registered_at: string }> {
  if (identity.role !== "volunteer") {
    throw new AuthorizationError("Only volunteer accounts can register for projects");
  }
  if (identity.profile.onboarding_complete !== true) {
    throw new AppError(
      "Complete your volunteer profile before registering for projects",
      400,
      "ONBOARDING_INCOMPLETE"
    );
  }

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", input.project_id)
    .maybeSingle();
  if (projectError) {
    throw new AppError(`Failed to load project: ${projectError.message}`, 500);
  }
  if (!projectData) {
    throw new NotFoundError("Project not found");
  }
  const project = projectData as unknown as ProjectRow;

  // Drafts are invisible to volunteers - registering reads as 404, not 403.
  if (project.status === "draft") {
    throw new NotFoundError("Project not found");
  }
  if (!REGISTRABLE_STATUSES.includes(project.status)) {
    throw new AppError("This project is no longer open for registration", 400, "PROJECT_NOT_OPEN");
  }

  // Duplicate check runs before capacity so "already registered" (409) wins
  // over "at capacity" (400) when both would apply.
  const { data: existingData, error: existingError } = await supabase
    .from("registrations")
    .select("id, status")
    .eq("volunteer_id", identity.domainId)
    .eq("project_id", input.project_id)
    .maybeSingle();
  if (existingError) {
    throw new AppError(`Failed to check existing registration: ${existingError.message}`, 500);
  }
  if (existingData && (existingData as { status: string }).status === "confirmed") {
    throw new ConflictError("You are already registered for this project");
  }

  const minAge = project.eligibility?.min_age;
  if (minAge !== undefined && minAge !== null) {
    const age = identity.profile.age;
    if (typeof age !== "number" || age < minAge) {
      throw new AppError(
        `This project requires volunteers to be at least ${minAge} years old`,
        400,
        "ELIGIBILITY_NOT_MET"
      );
    }
  }

  const confirmed = await countConfirmedRegistrations(input.project_id);
  if (confirmed >= project.capacity) {
    throw new AppError("This project is at capacity", 400, "PROJECT_AT_CAPACITY");
  }

  // A previously cancelled registration is reactivated in place - the
  // UNIQUE (volunteer_id, project_id) constraint forbids a second row.
  if (existingData) {
    const existing = existingData as { id: string };
    const { data: reactivated, error: reactivationError } = await supabase
      .from("registrations")
      .update({
        status: "confirmed",
        registered_at: new Date().toISOString(),
        cancelled_at: null,
      })
      .eq("id", existing.id)
      .select("id, registered_at")
      .single();
    if (reactivationError) {
      throw new AppError(`Failed to register for project: ${reactivationError.message}`, 500);
    }
    return {
      id: reactivated.id,
      status: "confirmed",
      registered_at: reactivated.registered_at,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("registrations")
    .insert({ volunteer_id: identity.domainId, project_id: input.project_id })
    .select("id, registered_at")
    .single();
  if (insertError) {
    // Unique violation = a concurrent duplicate registration won the race.
    if (insertError.code === "23505") {
      throw new ConflictError("You are already registered for this project");
    }
    throw new AppError(`Failed to register for project: ${insertError.message}`, 500);
  }
  return { id: inserted.id, status: "confirmed", registered_at: inserted.registered_at };
}

/**
 * GET /api/registrations - role-scoped listing: volunteers see their own,
 * NGOs see registrations for their own projects. PostgREST cannot filter on
 * an embedded column (project.ngo_id), so the NGO scope resolves its owned
 * project ids first and then filters on the plain project_id column.
 */
export async function listRegistrations(
  identity: RequestIdentity,
  query: ListRegistrationsQuery
): Promise<ListResult> {
  const { page, limit } = query;

  let dbQuery = supabase.from("registrations").select(REGISTRATION_SELECT, { count: "exact" });
  if (identity.role === "volunteer") {
    dbQuery = dbQuery.eq("volunteer_id", identity.domainId);
  } else {
    const { data: ownProjects, error: ownError } = await supabase
      .from("projects")
      .select("id")
      .eq("ngo_id", identity.domainId);
    if (ownError) {
      throw new AppError(`Failed to list registrations: ${ownError.message}`, 500);
    }
    const ownProjectIds = ((ownProjects ?? []) as { id: string }[]).map((p) => p.id);
    if (ownProjectIds.length === 0) {
      return { data: [], page, limit, total: 0 };
    }
    dbQuery = dbQuery.in("project_id", ownProjectIds);
  }
  if (query.project_id) {
    dbQuery = dbQuery.eq("project_id", query.project_id);
  }
  if (query.status) {
    dbQuery = dbQuery.eq("status", query.status);
  }

  const { data, error, count } = await dbQuery
    .order("registered_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (error) {
    throw new AppError(`Failed to list registrations: ${error.message}`, 500);
  }

  const rows = (data ?? []) as unknown as RegistrationRow[];
  return {
    data: rows.map(toSummary),
    page,
    limit,
    total: count ?? 0,
  };
}

/**
 * GET /api/registrations/:id - a single registration, access-checked.
 */
export async function getRegistration(
  identity: RequestIdentity,
  registrationId: string
): Promise<RegistrationSummary> {
  const row = await loadRegistrationForAccess(identity, registrationId);
  return toSummary(row);
}

/**
 * PUT /api/registrations/:id/cancel - volunteers cancel their own; NGOs cancel
 * registrations on their own projects. PUT semantics: cancelling an
 * already-cancelled registration is an idempotent no-op, not a conflict.
 */
export async function cancelRegistration(
  identity: RequestIdentity,
  registrationId: string
): Promise<{ id: string; status: RegistrationStatus; cancelled_at: string | null }> {
  const row = await loadRegistrationForAccess(identity, registrationId);
  if (row.status === "cancelled") {
    return { id: row.id, status: "cancelled", cancelled_at: row.cancelled_at };
  }

  const cancelledAt = new Date().toISOString();
  const { error } = await supabase
    .from("registrations")
    .update({ status: "cancelled", cancelled_at: cancelledAt })
    .eq("id", registrationId);
  if (error) {
    throw new AppError(`Failed to cancel registration: ${error.message}`, 500);
  }
  return { id: row.id, status: "cancelled", cancelled_at: cancelledAt };
}
