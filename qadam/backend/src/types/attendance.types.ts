/**
 * Domain and DTO types for the attendance module (api-contracts.md
 * "Attendance Module"). attendance_tokens carries a public event_id (encoded
 * in the QR) distinct from its surrogate id; attendance rows reference the
 * event_id. hours is only counted once check_out is set.
 */

export interface AttendanceEventRow {
  id: string;
  event_id: string;
  project_id: string;
  token: string;
  event_name: string | null;
  event_date: string;
  window_start: string;
  window_end: string;
  created_by: string;
  created_at: string;
}

export interface AttendanceEventCreated {
  event_id: string;
  token: string;
  event_name: string | null;
  event_date: string;
  window_start: string;
  window_end: string;
}

export interface AttendanceEventSummary {
  event_id: string;
  event_name: string | null;
  event_date: string;
  window_start: string;
  window_end: string;
  checked_in_count: number;
}

export interface AttendanceEventQr {
  event_id: string;
  token: string;
  qr_data: string;
}

export interface AttendanceRow {
  id: string;
  registration_id: string;
  volunteer_id: string;
  project_id: string;
  event_id: string;
  check_in: string | null;
  check_out: string | null;
  hours: number | null;
  created_at: string;
  volunteer?: { full_name: string } | null;
  project?: { title: string; ngo_id: string } | null;
}

export interface AttendanceRecordSummary {
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

/** attendance row with the project/ngo join used by the history view. */
export interface AttendanceHistoryRow {
  id: string;
  volunteer_id: string;
  project_id: string;
  event_id: string;
  check_in: string | null;
  check_out: string | null;
  hours: number | null;
  created_at: string;
  project?: { title: string; location_name: string | null; ngo?: { name: string } | null } | null;
}

/**
 * One entry of the volunteer's history: a FINISHED event the volunteer both
 * attended (checked in) and completed (checked out), with the verified hours
 * from the attendance row.
 */
export interface VolunteerAttendanceHistoryItem {
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
