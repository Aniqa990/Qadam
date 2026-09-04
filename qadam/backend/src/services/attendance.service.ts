import { randomBytes, randomUUID } from "crypto";
import type { RequestIdentity } from "../types/auth.types";
import type { ProjectRow, ProjectStatus } from "../types/project.types";
import type {
  AttendanceEventCreated,
  AttendanceEventQr,
  AttendanceEventRow,
  AttendanceEventSummary,
  AttendanceHistoryRow,
  AttendanceRecordSummary,
  AttendanceRow,
  CheckInResult,
  CheckOutResult,
  VolunteerAttendanceHistoryItem,
} from "../types/attendance.types";
import type {
  AttendanceScanBody,
  CreateAttendanceEventBody,
  ListAttendanceQuery,
} from "../validators/attendance.validator";
import { supabase } from "../lib/supabase";
import { AppError, AuthorizationError, NotFoundError } from "../utils/errors";

/**
 * Attendance business logic (api-contracts.md "Attendance Module", AGENTS.md
 * "Attendance"). Attendance is the source of truth for verified volunteer
 * participation and is ALWAYS written by the server - the client only ever
 * submits the scanned (event_id, token) pair.
 *
 * Security model:
 *   - the QR payload `qadam://attendance/{event_id}/{token}` encodes an opaque
 *     192-bit random token plus its event_id - no sensitive data is encoded
 *     directly. "Short-lived" is enforced by window_start/window_end, and the
 *     token is validated server-side via an indexed event_id + token lookup;
 *     the client-supplied event_id is a lookup hint, never authorization.
 *   - only the owning NGO can create/view/stop events for its project.
 *
 * Validation chain (check-in): event + token match -> active window -> open
 * project -> confirmed registration -> duplicate check-in -> insert. The
 * UNIQUE(volunteer_id, event_id) constraint backs the duplicate guard against
 * races (insert 23505 maps to 409).
 */

/** Attendance events can only be created for projects in these statuses. */
const ATTENDANCE_PROJECT_STATUSES: readonly ProjectStatus[] = ["upcoming", "active"];

/** The history view returns the volunteer's latest N completed events. */
const HISTORY_LIMIT = 10;

interface ListAttendanceResult {
  data: AttendanceRecordSummary[];
  page: number;
  limit: number;
  total: number;
}

/**
 * Opaque, unforgeable token - random bytes with no encoded meaning. It only
 * becomes meaningful through the server-side lookup row.
 */
function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

function qrDataPayload(event: Pick<AttendanceEventRow, "event_id" | "token">): string {
  return `qadam://attendance/${event.event_id}/${event.token}`;
}

/** Loads the caller's project row: 404 when missing, 403 when not the owner. */
async function loadOwnedProject(identity: RequestIdentity, projectId: string): Promise<ProjectRow> {
  if (identity.role !== "ngo") {
    throw new AuthorizationError("Only NGO accounts can manage attendance events");
  }
  const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (error) {
    throw new AppError(`Failed to load project: ${error.message}`, 500);
  }
  if (!data) {
    throw new NotFoundError("Project not found");
  }
  const row = data as unknown as ProjectRow;
  if (row.ngo_id !== identity.domainId) {
    throw new AuthorizationError("Only the organization that owns this project can manage its attendance");
  }
  return row;
}

async function loadProjectRow(projectId: string): Promise<ProjectRow> {
  const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (error) {
    throw new AppError(`Failed to load project: ${error.message}`, 500);
  }
  if (!data) {
    throw new AppError("The project for this attendance event no longer exists", 400, "PROJECT_NOT_FOUND");
  }
  return data as unknown as ProjectRow;
}

/**
 * Indexed lookup by the pair encoded in the QR - a token alone is never
 * scanned. An unknown pair (invalid QR, deleted event, typo'd manual entry)
 * reads as 400 per api-contracts.md.
 */
async function loadEventByToken(eventId: string, token: string): Promise<AttendanceEventRow> {
  const { data, error } = await supabase
    .from("attendance_tokens")
    .select("*")
    .eq("event_id", eventId)
    .eq("token", token)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to look up attendance event: ${error.message}`, 500);
  }
  if (!data) {
    throw new AppError("Invalid or unknown attendance code", 400, "INVALID_ATTENDANCE_CODE");
  }
  return data as unknown as AttendanceEventRow;
}

/** Loads an event plus its project ownership check for NGO-side actions. */
async function loadOwnedEvent(identity: RequestIdentity, eventId: string): Promise<AttendanceEventRow> {
  if (identity.role !== "ngo") {
    throw new AuthorizationError("Only NGO accounts can manage attendance events");
  }
  const { data, error } = await supabase
    .from("attendance_tokens")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to load attendance event: ${error.message}`, 500);
  }
  if (!data) {
    throw new NotFoundError("Attendance event not found");
  }
  const event = data as unknown as AttendanceEventRow;
  const project = await loadProjectRow(event.project_id);
  if (project.ngo_id !== identity.domainId) {
    throw new AuthorizationError("Only the organization that owns this project can manage its attendance");
  }
  return event;
}

/**
 * POST /api/attendance/events - creates a session with a fresh short-lived
 * token. Windows may start in the past (a session already underway), but must
 * end after they start (validated in attendance.validator.ts).
 */
export async function createAttendanceEvent(
  identity: RequestIdentity,
  input: CreateAttendanceEventBody
): Promise<AttendanceEventCreated> {
  const project = await loadOwnedProject(identity, input.project_id);

  if (!ATTENDANCE_PROJECT_STATUSES.includes(project.status)) {
    throw new AppError(
      `Attendance events can only be created for upcoming or active projects (this project is '${project.status}')`,
      400,
      "PROJECT_NOT_OPEN"
    );
  }

  const { data, error } = await supabase
    .from("attendance_tokens")
    .insert({
      // event_id is the public identifier encoded in the QR; id stays internal.
      event_id: randomUUID(),
      project_id: input.project_id,
      token: generateToken(),
      event_name: input.event_name ?? null,
      event_date: input.event_date,
      window_start: input.window_start,
      window_end: input.window_end,
      created_by: identity.domainId,
    })
    .select("event_id, token, event_name, event_date, window_start, window_end")
    .single();
  if (error) {
    throw new AppError(`Failed to create attendance event: ${error.message}`, 500);
  }

  return data as AttendanceEventCreated;
}

/**
 * GET /api/attendance/events?project_id= - the owning NGO's sessions with a
 * per-event checked-in count (every attendance row has check_in set).
 */
export async function listAttendanceEvents(
  identity: RequestIdentity,
  projectId: string
): Promise<AttendanceEventSummary[]> {
  await loadOwnedProject(identity, projectId);

  const { data, error } = await supabase
    .from("attendance_tokens")
    .select("event_id, event_name, event_date, window_start, window_end")
    .eq("project_id", projectId)
    .order("window_start", { ascending: false });
  if (error) {
    throw new AppError(`Failed to list attendance events: ${error.message}`, 500);
  }
  const events = (data ?? []) as unknown as AttendanceEventSummary[];

  if (events.length === 0) return events;

  const { data: attendanceRows, error: attendanceError } = await supabase
    .from("attendance")
    .select("event_id")
    .in("event_id", events.map((event) => event.event_id));
  if (attendanceError) {
    throw new AppError(`Failed to count attendance: ${attendanceError.message}`, 500);
  }
  const counts = new Map<string, number>();
  for (const row of (attendanceRows ?? []) as { event_id: string }[]) {
    counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
  }

  return events.map((event) => ({ ...event, checked_in_count: counts.get(event.event_id) ?? 0 }));
}

/**
 * GET /api/attendance/events/:eventId/qr - the QR data string the NGO
 * renders for volunteers to scan. The token stays server-generated; the NGO
 * can re-fetch it any time (it is only useful inside the active window).
 */
export async function getEventQr(identity: RequestIdentity, eventId: string): Promise<AttendanceEventQr> {
  const event = await loadOwnedEvent(identity, eventId);
  return { event_id: event.event_id, token: event.token, qr_data: qrDataPayload(event) };
}

/**
 * POST /api/attendance/events/:eventId/stop - closes the attendance window
 * early (window_end = now). Idempotent: an already-ended event is returned
 * unchanged. All future check-ins are rejected as outside the window; an
 * already open check-in can still be checked out (see checkOut).
 */
export async function stopAttendanceEvent(
  identity: RequestIdentity,
  eventId: string
): Promise<{ event_id: string; window_end: string }> {
  const event = await loadOwnedEvent(identity, eventId);

  const now = new Date();
  if (now.getTime() >= new Date(event.window_end).getTime()) {
    return { event_id: event.event_id, window_end: event.window_end };
  }

  const windowEnd = now.toISOString();
  const { error } = await supabase
    .from("attendance_tokens")
    .update({ window_end: windowEnd })
    .eq("event_id", eventId);
  if (error) {
    throw new AppError(`Failed to stop attendance event: ${error.message}`, 500);
  }

  return { event_id: event.event_id, window_end: windowEnd };
}

/** Finds the volunteer's confirmed registration on the event's project. */
async function findConfirmedRegistration(
  volunteerId: string,
  projectId: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("registrations")
    .select("id")
    .eq("volunteer_id", volunteerId)
    .eq("project_id", projectId)
    .eq("status", "confirmed")
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to verify registration: ${error.message}`, 500);
  }
  return (data as { id: string } | null) ?? null;
}

/**
 * POST /api/attendance/check-in - volunteer scans the QR. Full server-side
 * validation chain; the server stamps check_in itself, so the client can
 * never mark attendance as verified on its own.
 */
export async function checkIn(identity: RequestIdentity, input: AttendanceScanBody): Promise<CheckInResult> {
  if (identity.role !== "volunteer") {
    throw new AuthorizationError("Only volunteers can check in via QR");
  }

  const event = await loadEventByToken(input.event_id, input.token);

  const now = Date.now();
  if (now < new Date(event.window_start).getTime()) {
    throw new AppError("Attendance for this event has not opened yet", 400, "EVENT_NOT_STARTED");
  }
  if (now > new Date(event.window_end).getTime()) {
    throw new AppError("The attendance window for this event has closed", 400, "EVENT_WINDOW_CLOSED");
  }

  const project = await loadProjectRow(event.project_id);
  if (!ATTENDANCE_PROJECT_STATUSES.includes(project.status)) {
    throw new AppError("Attendance is not open for this project anymore", 400, "PROJECT_NOT_OPEN");
  }

  const registration = await findConfirmedRegistration(identity.domainId, event.project_id);
  if (!registration) {
    throw new AppError(
      "You need a confirmed registration for this project before checking in",
      400,
      "NOT_REGISTERED"
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("attendance")
    .select("id")
    .eq("event_id", event.event_id)
    .eq("volunteer_id", identity.domainId)
    .maybeSingle();
  if (existingError) {
    throw new AppError(`Failed to verify previous attendance: ${existingError.message}`, 500);
  }
  if (existing) {
    throw new AppError("You have already checked in for this event", 409, "ALREADY_CHECKED_IN");
  }

  const checkInAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("attendance")
    .insert({
      registration_id: registration.id,
      volunteer_id: identity.domainId,
      project_id: event.project_id,
      event_id: event.event_id,
      check_in: checkInAt,
    })
    .select("id, check_in")
    .single();
  if (error) {
    // Lost race against the UNIQUE(volunteer_id, event_id) constraint.
    if (error.code === "23505") {
      throw new AppError("You have already checked in for this event", 409, "ALREADY_CHECKED_IN");
    }
    throw new AppError(`Failed to record check-in: ${error.message}`, 500);
  }

  return { attendance_id: data.id, event_id: event.event_id, check_in: data.check_in };
}

/**
 * POST /api/attendance/check-out - the same scan again. The open check-in
 * row is the proof that all check-in validations already passed, so check-out
 * deliberately does NOT re-require the window end: a volunteer mid-session
 * must be able to check out even after the window closed or the NGO stopped
 * attendance, otherwise those sessions (and their hours) would be orphaned.
 */
export async function checkOut(identity: RequestIdentity, input: AttendanceScanBody): Promise<CheckOutResult> {
  if (identity.role !== "volunteer") {
    throw new AuthorizationError("Only volunteers can check out via QR");
  }

  const event = await loadEventByToken(input.event_id, input.token);

  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("event_id", event.event_id)
    .eq("volunteer_id", identity.domainId)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to load attendance record: ${error.message}`, 500);
  }
  if (!data || !data.check_in) {
    throw new AppError("No check-in found for this event - check in first", 400, "NO_OPEN_CHECK_IN");
  }
  const record = data as AttendanceRow;
  if (record.check_out) {
    throw new AppError("You have already checked out for this event", 409, "ALREADY_CHECKED_OUT");
  }
  const checkInIso = record.check_in as string;

  const now = new Date();
  if (now.getTime() < new Date(event.window_start).getTime()) {
    throw new AppError("Attendance for this event has not opened yet", 400, "EVENT_NOT_STARTED");
  }

  const checkOutAt = now.toISOString();
  const hours = Math.round(((now.getTime() - new Date(checkInIso).getTime()) / 3_600_000) * 100) / 100;

  const { data: updated, error: updateError } = await supabase
    .from("attendance")
    .update({ check_out: checkOutAt, hours })
    .eq("id", record.id)
    .select("id, check_in, check_out, hours")
    .single();
  if (updateError) {
    throw new AppError(`Failed to record check-out: ${updateError.message}`, 500);
  }

  return {
    attendance_id: updated.id,
    check_in: updated.check_in,
    check_out: updated.check_out,
    hours: updated.hours,
  };
}

/**
 * GET /api/attendance - role-scoped verified attendance records. Volunteers
 * see their own history (with computed durations); NGOs see records across
 * their own projects. PostgREST cannot filter on embedded columns, so the
 * NGO scope resolves owned project ids first and then filters on
 * project_id. event_name is stitched in a second query because attendance
 * has no FK to attendance_tokens (migration 005) and therefore can't embed it.
 */
export async function listAttendanceRecords(
  identity: RequestIdentity,
  query: ListAttendanceQuery
): Promise<ListAttendanceResult> {
  const { page, limit } = query;

  let dbQuery = supabase
    .from("attendance")
    .select("*, volunteer:volunteers(full_name), project:projects(title, ngo_id)", { count: "exact" });

  if (identity.role === "ngo") {
    const { data: ownProjects, error } = await supabase
      .from("projects")
      .select("id")
      .eq("ngo_id", identity.domainId);
    if (error) {
      throw new AppError(`Failed to list attendance: ${error.message}`, 500);
    }
    const scopedProjectIds = ((ownProjects ?? []) as { id: string }[]).map((p) => p.id);
    if (scopedProjectIds.length === 0) {
      return { data: [], page, limit, total: 0 };
    }
    dbQuery = dbQuery.in("project_id", scopedProjectIds);
  } else {
    dbQuery = dbQuery.eq("volunteer_id", identity.domainId);
  }

  if (query.project_id) {
    dbQuery = dbQuery.eq("project_id", query.project_id);
  }
  if (query.event_id) {
    dbQuery = dbQuery.eq("event_id", query.event_id);
  }

  const { data, error, count } = await dbQuery
    .order("check_in", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (error) {
    throw new AppError(`Failed to list attendance: ${error.message}`, 500);
  }
  const rows = (data ?? []) as unknown as AttendanceRow[];

  const eventIds = [...new Set(rows.map((row) => row.event_id))];
  const eventNames = new Map<string, string | null>();
  if (eventIds.length > 0) {
    const { data: events, error: eventsError } = await supabase
      .from("attendance_tokens")
      .select("event_id, event_name")
      .in("event_id", eventIds);
    if (eventsError) {
      throw new AppError(`Failed to list attendance: ${eventsError.message}`, 500);
    }
    for (const event of (events ?? []) as { event_id: string; event_name: string | null }[]) {
      eventNames.set(event.event_id, event.event_name);
    }
  }

  return {
    data: rows.map((row) => ({
      id: row.id,
      volunteer_id: row.volunteer_id,
      volunteer_name: row.volunteer?.full_name ?? "",
      project_id: row.project_id,
      project_title: row.project?.title ?? "",
      event_id: row.event_id,
      event_name: eventNames.get(row.event_id) ?? null,
      check_in: row.check_in,
      check_out: row.check_out,
      hours: row.hours,
    })),
    page,
    limit,
    total: count ?? 0,
  };
}

/** Event columns the history view needs from attendance_tokens. */
interface HistoryEvent {
  event_id: string;
  event_name: string | null;
  event_date: string;
  window_end: string;
}

/**
 * GET /api/attendance/history - the volunteer's latest completed events, a
 * read-only view over existing attendance data (no history table). A session
 * enters history only once BOTH conditions hold:
 *   - the event has finished: window_end is in the past. Upcoming and
 *     still-running events never appear; events have no cancelled state (an
 *     NGO "stopping" an event just ends its window sooner), so a past
 *     window_end is exactly "finished".
 *   - the volunteer's attendance is complete: check_out is set (check-in is
 *     implied by the check-out flow), i.e. the row carries verified hours.
 *     A check-in without check-out is unfinished and stays out of history.
 *
 * A later-cancelled registration or project never removes attendance that
 * was already verified - attendance is the source of truth for participation
 * (AGENTS.md). Latest HISTORY_LIMIT events are returned, newest first. Event
 * details are stitched in a second query, same as listAttendanceRecords,
 * because attendance has no FK to attendance_tokens (migration 005).
 */
export async function getVolunteerHistory(
  identity: RequestIdentity
): Promise<VolunteerAttendanceHistoryItem[]> {
  if (identity.role !== "volunteer") {
    throw new AuthorizationError("Only volunteer accounts can view their attendance history");
  }

  const { data, error } = await supabase
    .from("attendance")
    .select("*, project:projects(title, location_name, ngo:ngos(name))")
    .eq("volunteer_id", identity.domainId)
    .not("check_out", "is", null)
    .order("check_out", { ascending: false });
  if (error) {
    throw new AppError(`Failed to load attendance history: ${error.message}`, 500);
  }
  const rows = (data ?? []) as unknown as AttendanceHistoryRow[];
  if (rows.length === 0) return [];

  const eventIds = [...new Set(rows.map((row) => row.event_id))];
  const { data: events, error: eventsError } = await supabase
    .from("attendance_tokens")
    .select("event_id, event_name, event_date, window_end")
    .in("event_id", eventIds);
  if (eventsError) {
    throw new AppError(`Failed to load attendance history: ${eventsError.message}`, 500);
  }
  const eventsById = new Map(
    ((events ?? []) as HistoryEvent[]).map((event) => [event.event_id, event])
  );

  const now = Date.now();
  const finished = rows.flatMap((row) => {
    const event = eventsById.get(row.event_id);
    if (!event || new Date(event.window_end).getTime() >= now) {
      return []; // event not found or not finished yet - never history material
    }
    return [{ row, event }];
  });

  // Newest first: by when the event finished, check-out breaking exact ties.
  finished.sort(
    (a, b) =>
      new Date(b.event.window_end).getTime() - new Date(a.event.window_end).getTime() ||
      new Date(b.row.check_out ?? 0).getTime() - new Date(a.row.check_out ?? 0).getTime()
  );

  return finished.slice(0, HISTORY_LIMIT).map(({ row, event }) => ({
    id: row.id,
    project_id: row.project_id,
    project_title: row.project?.title ?? "",
    ngo_name: row.project?.ngo?.name ?? "",
    event_id: row.event_id,
    event_name: event.event_name,
    event_date: event.event_date,
    location_name: row.project?.location_name ?? null,
    check_in: row.check_in ?? "",
    check_out: row.check_out ?? "",
    hours: row.hours ?? 0,
  }));
}
