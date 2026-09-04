import type {
  AttendanceEvent,
  AttendanceEventCreated,
  AttendanceEventQr,
  AttendanceHistoryItem,
  AttendanceRecord,
  CheckInResult,
  CheckOutResult,
} from "@/types/attendance";
import type { ApiFetcher, ApiListFetcher } from "./projects";

/**
 * Typed wrappers for the attendance REST API (api-contracts.md "Attendance
 * Module"). The client only ever submits the scanned (event_id, token) pair -
 * the server does all validation and is the sole writer of attendance rows.
 */

export interface AttendanceEventInput {
  event_name: string | null;
  event_date: string;
  window_start: string;
  window_end: string;
}

export interface AttendanceRecordParams {
  page?: number;
  limit?: number;
  project_id?: string;
  event_id?: string;
}

export function createAttendanceEvent(
  api: ApiFetcher,
  projectId: string,
  input: AttendanceEventInput
): Promise<AttendanceEventCreated> {
  return api<AttendanceEventCreated>("/attendance/events", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, ...input }),
  });
}

export function listAttendanceEvents(api: ApiFetcher, projectId: string): Promise<AttendanceEvent[]> {
  return api<AttendanceEvent[]>(`/attendance/events?project_id=${encodeURIComponent(projectId)}`);
}

export function getEventQr(api: ApiFetcher, eventId: string): Promise<AttendanceEventQr> {
  return api<AttendanceEventQr>(`/attendance/events/${encodeURIComponent(eventId)}/qr`);
}

export function stopAttendanceEvent(
  api: ApiFetcher,
  eventId: string
): Promise<{ event_id: string; window_end: string }> {
  return api(`/attendance/events/${encodeURIComponent(eventId)}/stop`, { method: "POST" });
}

export function checkIn(
  api: ApiFetcher,
  scan: { event_id: string; token: string }
): Promise<CheckInResult> {
  return api<CheckInResult>("/attendance/check-in", {
    method: "POST",
    body: JSON.stringify(scan),
  });
}

export function checkOut(
  api: ApiFetcher,
  scan: { event_id: string; token: string }
): Promise<CheckOutResult> {
  return api<CheckOutResult>("/attendance/check-out", {
    method: "POST",
    body: JSON.stringify(scan),
  });
}

export function listAttendanceRecords(api: ApiListFetcher, params: AttendanceRecordParams = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.project_id) search.set("project_id", params.project_id);
  if (params.event_id) search.set("event_id", params.event_id);
  const qs = search.toString();
  return api<AttendanceRecord>(`/attendance${qs ? `?${qs}` : ""}`);
}

/**
 * The caller's latest completed events (finished event + checked-out
 * attendance), newest first, capped at 10 server-side. Read-only - history
 * never writes attendance data.
 */
export function listAttendanceHistory(api: ApiFetcher): Promise<AttendanceHistoryItem[]> {
  return api<AttendanceHistoryItem[]>("/attendance/history");
}
