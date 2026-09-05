/**
 * Attendance DTOs mirroring api-contracts.md "Attendance Module". The QR
 * payload encodes `qadam://attendance/{event_id}/{token}` (AGENTS.md).
 */

export interface AttendanceEvent {
  event_id: string;
  event_name: string | null;
  event_date: string;
  window_start: string;
  window_end: string;
  checked_in_count: number;
}

export interface AttendanceEventCreated {
  event_id: string;
  token: string;
  event_name: string | null;
  event_date: string;
  window_start: string;
  window_end: string;
}

export interface AttendanceEventQr {
  event_id: string;
  token: string;
  qr_data: string;
}

export interface AttendanceRecord {
  id: string;
  volunteer_id: string;
  volunteer_name: string;
  project_id: string;
  project_title: string;
  event_id: string;
  event_name: string | null;
  check_in: string | null;
  check_out: string | null;
  hours: number | null;
}

/**
 * One entry of the volunteer's history (GET /api/attendance/history): a
 * finished event the volunteer attended and completed, with the verified
 * hours from the attendance record. Mirrors the backend's
 * VolunteerAttendanceHistoryItem - keep both in sync.
 */
export interface AttendanceHistoryItem {
  id: string;
  project_id: string;
  project_title: string;
  ngo_name: string;
  event_id: string;
  event_name: string | null;
  event_date: string;
  location_name: string | null;
  check_in: string;
  check_out: string;
  hours: number;
}

export interface CheckInResult {
  attendance_id: string;
  event_id: string;
  check_in: string;
}

export interface CheckOutResult {
  attendance_id: string;
  check_in: string;
  check_out: string;
  hours: number;
}

/**
 * Unified scan response (POST /api/attendance/scan). The server decides
 * whether the scan was a check-in or a check-out based on the existing
 * attendance row, so the frontend just renders `action` directly.
 */
export interface ScanResult {
  action: "checked-in" | "checked-out";
  attendance_id: string;
  event_id: string;
  check_in: string;
  check_out: string | null;
  hours: number | null;
}

/** `qadam://attendance/{event_id}/{token}` or null when the text isn't one. */
export function parseAttendancePayload(text: string): { event_id: string; token: string } | null {
  const match = text.trim().match(/^qadam:\/\/attendance\/([0-9a-fA-F-]{36})\/([A-Za-z0-9_-]{10,256})$/);
  if (!match) return null;
  return { event_id: match[1], token: match[2] };
}
