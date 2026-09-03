import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestIdentity } from "../../src/types/auth.types";
import type { ProjectStatus } from "../../src/types/project.types";
import type { SupabaseMockAccess } from "./helpers/supabase-mock";

/**
 * Unit tests for attendance.service (api-contracts.md "Attendance Module",
 * AGENTS.md "Attendance"). Covers the required cases - successful check-in,
 * duplicate check-in, invalid/expired QR token, unregistered volunteer,
 * successful check-out, duplicate check-out - plus ownership, stop, and the
 * check-out-after-window rule. The Supabase client is module-mocked with the
 * shared queue-based builder (tests/unit/helpers/supabase-mock.ts); time is
 * pinned so window checks and duration math are deterministic.
 */

vi.mock("../../src/lib/supabase", async () => {
  const { createSupabaseMock } = await import("./helpers/supabase-mock");
  return createSupabaseMock();
});

import * as supabaseModule from "../../src/lib/supabase";
import {
  checkIn,
  checkOut,
  createAttendanceEvent,
  getEventQr,
  stopAttendanceEvent,
} from "../../src/services/attendance.service";
import { AuthorizationError } from "../../src/utils/errors";

const mock = (supabaseModule as unknown as { __mock: SupabaseMockAccess }).__mock;

const NOW = new Date("2026-09-20T10:00:00Z");
const SCAN = { event_id: "evt-1", token: "tok-abc123" };

// -- fixtures ----------------------------------------------------------------

function volunteerIdentity(): RequestIdentity {
  return {
    clerkUserId: "user_volunteer",
    role: "volunteer",
    email: "vol@example.com",
    domainId: "vol-1",
    profile: { id: "vol-1", onboarding_complete: true },
  };
}

function ngoIdentity(): RequestIdentity {
  return {
    clerkUserId: "user_ngo",
    role: "ngo",
    email: "ngo@example.com",
    domainId: "ngo-1",
    profile: { id: "ngo-1" },
  };
}

function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "proj-1",
    ngo_id: "ngo-1",
    title: "After-School Tutoring",
    status: "active" as ProjectStatus,
    capacity: 10,
    ...overrides,
  };
}

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "token-row-1",
    event_id: "evt-1",
    project_id: "proj-1",
    token: "tok-abc123",
    event_name: "Day 1 Morning Session",
    event_date: "2026-09-20",
    window_start: "2026-09-20T08:00:00Z",
    window_end: "2026-09-20T12:00:00Z",
    created_by: "ngo-1",
    created_at: "2026-09-19T09:00:00Z",
    ...overrides,
  };
}

function attendanceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    registration_id: "reg-1",
    volunteer_id: "vol-1",
    project_id: "proj-1",
    event_id: "evt-1",
    check_in: "2026-09-20T08:00:00Z",
    check_out: null,
    hours: 0,
    created_at: "2026-09-20T08:00:00Z",
    ...overrides,
  };
}

/** Queue for a fully valid check-in up to (and including) the insert. */
function queueSuccessfulCheckIn(eventOverrides: Record<string, unknown> = {}) {
  mock.queue("attendance_tokens", [{ data: eventRow(eventOverrides), error: null }]);
  mock.queue("projects", [{ data: projectRow(), error: null }]);
  mock.queue("registrations", [{ data: { id: "reg-1" }, error: null }]);
  mock.queue("attendance", [
    { data: null, error: null }, // duplicate check (maybeSingle)
    { data: { id: "att-1", check_in: NOW.toISOString() }, error: null }, // insert
  ]);
}

beforeEach(() => {
  mock.reset();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// -- checkIn -------------------------------------------------------------------

describe("checkIn", () => {
  it("checks in successfully after the full validation chain", async () => {
    queueSuccessfulCheckIn();

    const result = await checkIn(volunteerIdentity(), SCAN);

    expect(result).toEqual({
      attendance_id: "att-1",
      event_id: "evt-1",
      check_in: NOW.toISOString(),
    });
    // The row is written by the server from the resolved identity + token row,
    // never from client-supplied volunteer/project ids.
    expect(mock.calls.inserts["attendance"]).toEqual([
      {
        registration_id: "reg-1",
        volunteer_id: "vol-1",
        project_id: "proj-1",
        event_id: "evt-1",
        check_in: NOW.toISOString(),
      },
    ]);
  });

  it("rejects a duplicate check-in with 409 ALREADY_CHECKED_IN", async () => {
    mock.queue("attendance_tokens", [{ data: eventRow(), error: null }]);
    mock.queue("projects", [{ data: projectRow(), error: null }]);
    mock.queue("registrations", [{ data: { id: "reg-1" }, error: null }]);
    mock.queue("attendance", [{ data: { id: "att-1" }, error: null }]); // already checked in

    const rejection = checkIn(volunteerIdentity(), SCAN);

    await expect(rejection).rejects.toMatchObject({
      statusCode: 409,
      code: "ALREADY_CHECKED_IN",
    });
    expect(mock.calls.inserts["attendance"]).toBeUndefined();
  });

  it("rejects an invalid/unknown token pair with 400 INVALID_ATTENDANCE_CODE", async () => {
    mock.queue("attendance_tokens", [{ data: null, error: null }]);

    await expect(checkIn(volunteerIdentity(), SCAN)).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_ATTENDANCE_CODE",
    });
  });

  it("rejects an expired QR token (closed window) with 400 EVENT_WINDOW_CLOSED", async () => {
    mock.queue("attendance_tokens", [
      { data: eventRow({ window_start: "2026-09-20T08:00:00Z", window_end: "2026-09-20T09:00:00Z" }), error: null },
    ]);

    await expect(checkIn(volunteerIdentity(), SCAN)).rejects.toMatchObject({
      statusCode: 400,
      code: "EVENT_WINDOW_CLOSED",
    });
  });

  it("rejects a check-in before the window opens with 400 EVENT_NOT_STARTED", async () => {
    mock.queue("attendance_tokens", [
      { data: eventRow({ window_start: "2026-09-20T11:00:00Z", window_end: "2026-09-20T13:00:00Z" }), error: null },
    ]);

    await expect(checkIn(volunteerIdentity(), SCAN)).rejects.toMatchObject({
      statusCode: 400,
      code: "EVENT_NOT_STARTED",
    });
  });

  it("rejects an unregistered volunteer with 400 NOT_REGISTERED", async () => {
    mock.queue("attendance_tokens", [{ data: eventRow(), error: null }]);
    mock.queue("projects", [{ data: projectRow(), error: null }]);
    mock.queue("registrations", [{ data: null, error: null }]); // no confirmed registration

    await expect(checkIn(volunteerIdentity(), SCAN)).rejects.toMatchObject({
      statusCode: 400,
      code: "NOT_REGISTERED",
    });
    expect(mock.calls.inserts["attendance"]).toBeUndefined();
  });

  it("rejects check-in when the project is no longer open", async () => {
    mock.queue("attendance_tokens", [{ data: eventRow(), error: null }]);
    mock.queue("projects", [{ data: projectRow({ status: "completed" }), error: null }]);

    await expect(checkIn(volunteerIdentity(), SCAN)).rejects.toMatchObject({
      statusCode: 400,
      code: "PROJECT_NOT_OPEN",
    });
  });

  it("maps a unique-constraint race on insert to 409 ALREADY_CHECKED_IN", async () => {
    mock.queue("attendance_tokens", [{ data: eventRow(), error: null }]);
    mock.queue("projects", [{ data: projectRow(), error: null }]);
    mock.queue("registrations", [{ data: { id: "reg-1" }, error: null }]);
    mock.queue("attendance", [
      { data: null, error: null }, // duplicate pre-check missed it
      { data: null, error: { code: "23505", message: "duplicate key" } }, // insert lost the race
    ]);

    await expect(checkIn(volunteerIdentity(), SCAN)).rejects.toMatchObject({
      statusCode: 409,
      code: "ALREADY_CHECKED_IN",
    });
  });

  it("rejects NGO callers with 403 before any data access", async () => {
    await expect(checkIn(ngoIdentity(), SCAN)).rejects.toBeInstanceOf(AuthorizationError);
  });
});

// -- checkOut ------------------------------------------------------------------

describe("checkOut", () => {
  it("checks out successfully and computes the duration", async () => {
    mock.queue("attendance_tokens", [{ data: eventRow(), error: null }]);
    mock.queue("attendance", [
      { data: attendanceRow({ check_in: "2026-09-20T08:00:00Z" }), error: null },
      { data: { id: "att-1", check_in: "2026-09-20T08:00:00Z", check_out: NOW.toISOString(), hours: 2 }, error: null },
    ]);

    const result = await checkOut(volunteerIdentity(), SCAN);

    expect(result).toEqual({
      attendance_id: "att-1",
      check_in: "2026-09-20T08:00:00Z",
      check_out: NOW.toISOString(),
      hours: 2,
    });
    expect(mock.calls.updates["attendance"]).toEqual([
      { check_out: NOW.toISOString(), hours: 2 },
    ]);
  });

  it("rounds the computed duration to 2 decimal places", async () => {
    vi.setSystemTime(new Date("2026-09-20T10:02:00Z"));
    mock.queue("attendance_tokens", [{ data: eventRow(), error: null }]);
    mock.queue("attendance", [
      { data: attendanceRow({ check_in: "2026-09-20T08:00:00Z" }), error: null },
      { data: { id: "att-1", check_in: "2026-09-20T08:00:00Z", check_out: "2026-09-20T10:02:00Z", hours: 2.03 }, error: null },
    ]);

    const result = await checkOut(volunteerIdentity(), SCAN);

    expect(result.hours).toBe(2.03);
    expect(mock.calls.updates["attendance"]).toEqual([
      { check_out: "2026-09-20T10:02:00.000Z", hours: 2.03 },
    ]);
  });

  it("rejects a duplicate check-out with 409 ALREADY_CHECKED_OUT", async () => {
    mock.queue("attendance_tokens", [{ data: eventRow(), error: null }]);
    mock.queue("attendance", [
      { data: attendanceRow({ check_in: "2026-09-20T08:00:00Z", check_out: "2026-09-20T09:30:00Z", hours: 1.5 }), error: null },
    ]);

    const rejection = checkOut(volunteerIdentity(), SCAN);

    await expect(rejection).rejects.toMatchObject({
      statusCode: 409,
      code: "ALREADY_CHECKED_OUT",
    });
    expect(mock.calls.updates["attendance"]).toBeUndefined();
  });

  it("rejects check-out without a prior check-in with 400 NO_OPEN_CHECK_IN", async () => {
    mock.queue("attendance_tokens", [{ data: eventRow(), error: null }]);
    mock.queue("attendance", [{ data: null, error: null }]);

    await expect(checkOut(volunteerIdentity(), SCAN)).rejects.toMatchObject({
      statusCode: 400,
      code: "NO_OPEN_CHECK_IN",
    });
  });

  it("still allows check-out after the window closed so sessions are not orphaned", async () => {
    mock.queue("attendance_tokens", [
      { data: eventRow({ window_start: "2026-09-20T08:00:00Z", window_end: "2026-09-20T09:00:00Z" }), error: null },
    ]);
    mock.queue("attendance", [
      { data: attendanceRow({ check_in: "2026-09-20T08:00:00Z" }), error: null },
      { data: { id: "att-1", check_in: "2026-09-20T08:00:00Z", check_out: NOW.toISOString(), hours: 2 }, error: null },
    ]);

    const result = await checkOut(volunteerIdentity(), SCAN);

    expect(result.hours).toBe(2);
  });
});

// -- createAttendanceEvent -----------------------------------------------------

describe("createAttendanceEvent", () => {
  it("creates an event with a generated public event_id and opaque token", async () => {
    mock.queue("projects", [{ data: projectRow(), error: null }]);
    mock.queue("attendance_tokens", [
      {
        data: {
          event_id: "evt-new",
          token: "generated-token",
          event_name: "Day 1 Morning Session",
          event_date: "2026-09-20",
          window_start: "2026-09-20T08:00:00Z",
          window_end: "2026-09-20T12:00:00Z",
        },
        error: null,
      },
    ]);

    const result = await createAttendanceEvent(ngoIdentity(), {
      project_id: "proj-1",
      event_name: "Day 1 Morning Session",
      event_date: "2026-09-20",
      window_start: "2026-09-20T08:00:00Z",
      window_end: "2026-09-20T12:00:00Z",
    });

    expect(result.event_id).toBe("evt-new");
    expect(result.token).toBe("generated-token");

    const insert = mock.calls.inserts["attendance_tokens"][0] as Record<string, unknown>;
    expect(insert).toMatchObject({
      project_id: "proj-1",
      event_name: "Day 1 Morning Session",
      event_date: "2026-09-20",
      window_start: "2026-09-20T08:00:00Z",
      window_end: "2026-09-20T12:00:00Z",
      created_by: "ngo-1", // derived from the authenticated NGO, never the body
    });
    // The public event_id and token are generated server-side, not client input.
    expect(String(insert.event_id)).toMatch(/^[0-9a-f-]{36}$/);
    expect(String(insert.token).length).toBeGreaterThanOrEqual(30);
  });

  it("rejects event creation by a non-owner NGO with 403", async () => {
    mock.queue("projects", [{ data: projectRow({ ngo_id: "ngo-2" }), error: null }]);

    const rejection = createAttendanceEvent(ngoIdentity(), {
      project_id: "proj-1",
      event_name: "Day 1",
      event_date: "2026-09-20",
      window_start: "2026-09-20T08:00:00Z",
      window_end: "2026-09-20T12:00:00Z",
    });

    await expect(rejection).rejects.toBeInstanceOf(AuthorizationError);
    expect(mock.calls.inserts["attendance_tokens"]).toBeUndefined();
  });

  it("rejects event creation on a draft project with 400 PROJECT_NOT_OPEN", async () => {
    mock.queue("projects", [{ data: projectRow({ status: "draft" }), error: null }]);

    await expect(
      createAttendanceEvent(ngoIdentity(), {
        project_id: "proj-1",
        event_name: "Day 1",
        event_date: "2026-09-20",
        window_start: "2026-09-20T08:00:00Z",
        window_end: "2026-09-20T12:00:00Z",
      })
    ).rejects.toMatchObject({ statusCode: 400, code: "PROJECT_NOT_OPEN" });
  });
});

// -- getEventQr ----------------------------------------------------------------

describe("getEventQr", () => {
  it("returns the qadam:// QR payload to the owning NGO", async () => {
    mock.queue("attendance_tokens", [{ data: eventRow(), error: null }]);
    mock.queue("projects", [{ data: projectRow(), error: null }]);

    const qr = await getEventQr(ngoIdentity(), "evt-1");

    expect(qr).toEqual({
      event_id: "evt-1",
      token: "tok-abc123",
      qr_data: "qadam://attendance/evt-1/tok-abc123",
    });
  });

  it("rejects QR access by a non-owner NGO with 403", async () => {
    mock.queue("attendance_tokens", [{ data: eventRow(), error: null }]);
    mock.queue("projects", [{ data: projectRow({ ngo_id: "ngo-2" }), error: null }]);

    await expect(getEventQr(ngoIdentity(), "evt-1")).rejects.toBeInstanceOf(AuthorizationError);
  });
});

// -- stopAttendanceEvent -------------------------------------------------------

describe("stopAttendanceEvent", () => {
  it("closes the window early (window_end = now) for the owning NGO", async () => {
    mock.queue("attendance_tokens", [
      { data: eventRow(), error: null }, // loadOwnedEvent lookup
      { data: null, error: null }, // update await (thenable)
    ]);
    mock.queue("projects", [{ data: projectRow(), error: null }]);

    const result = await stopAttendanceEvent(ngoIdentity(), "evt-1");

    expect(result).toEqual({ event_id: "evt-1", window_end: NOW.toISOString() });
    expect(mock.calls.updates["attendance_tokens"]).toEqual([{ window_end: NOW.toISOString() }]);
  });

  it("is a no-op for an event whose window already ended", async () => {
    mock.queue("attendance_tokens", [
      { data: eventRow({ window_end: "2026-09-20T09:00:00Z" }), error: null },
    ]);
    mock.queue("projects", [{ data: projectRow(), error: null }]);

    const result = await stopAttendanceEvent(ngoIdentity(), "evt-1");

    expect(result).toEqual({ event_id: "evt-1", window_end: "2026-09-20T09:00:00Z" });
    expect(mock.calls.updates["attendance_tokens"]).toBeUndefined();
  });
});
