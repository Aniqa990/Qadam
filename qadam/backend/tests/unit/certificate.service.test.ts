import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestIdentity } from "../../src/types/auth.types";
import type { SupabaseMockAccess } from "./helpers/supabase-mock";

/**
 * Unit tests for certificate.service — on-demand PDF generation from
 * authoritative attendance data (no storage). Covers ownership, eligibility
 * (check-out + finished event), and successful PDF rendering.
 */

vi.mock("../../src/lib/supabase", async () => {
  const { createSupabaseMock } = await import("./helpers/supabase-mock");
  return createSupabaseMock();
});

import * as supabaseModule from "../../src/lib/supabase";
import {
  generateVolunteerCertificate,
  renderCertificatePdf,
} from "../../src/services/certificate.service";
import { AuthorizationError, NotFoundError } from "../../src/utils/errors";

const mock = (supabaseModule as unknown as { __mock: SupabaseMockAccess }).__mock;

const NOW = new Date("2026-09-21T10:00:00Z");

function volunteerIdentity(overrides: Partial<RequestIdentity> = {}): RequestIdentity {
  return {
    clerkUserId: "user_volunteer",
    role: "volunteer",
    email: "vol@example.com",
    domainId: "vol-1",
    profile: { id: "vol-1", onboarding_complete: true },
    ...overrides,
  };
}

function attendanceFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    volunteer_id: "vol-1",
    project_id: "proj-1",
    event_id: "evt-1",
    check_out: "2026-09-20T11:00:00Z",
    hours: 2.95,
    volunteer: { full_name: "Jane Doe" },
    project: {
      title: "After-School Tutoring",
      ngo: { name: "Education For All" },
    },
    ...overrides,
  };
}

function eventFixture(overrides: Record<string, unknown> = {}) {
  return {
    event_id: "evt-1",
    event_name: "Day 1 Morning Session",
    event_date: "2026-09-20",
    window_end: "2026-09-20T12:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  mock.reset();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("renderCertificatePdf", () => {
  it("returns a non-empty PDF buffer starting with %PDF", async () => {
    const buffer = await renderCertificatePdf({
      volunteerName: "Jane Doe",
      ngoName: "Education For All",
      projectTitle: "After-School Tutoring",
      eventName: "Day 1 Morning Session",
      eventDate: "2026-09-20",
      hours: 2.95,
    });

    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });
});

describe("generateVolunteerCertificate", () => {
  it("rejects NGO callers", async () => {
    await expect(
      generateVolunteerCertificate(
        {
          clerkUserId: "user_ngo",
          role: "ngo",
          email: "ngo@example.com",
          domainId: "ngo-1",
          profile: { id: "ngo-1" },
        },
        "att-1"
      )
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("returns 404 when attendance is missing", async () => {
    mock.queue("attendance", [{ data: null, error: null }]);
    await expect(generateVolunteerCertificate(volunteerIdentity(), "att-missing")).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("rejects certificates for another volunteer's attendance", async () => {
    mock.queue("attendance", [
      { data: attendanceFixture({ volunteer_id: "vol-other" }), error: null },
    ]);
    await expect(generateVolunteerCertificate(volunteerIdentity(), "att-1")).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });

  it("rejects when check-out is missing", async () => {
    mock.queue("attendance", [
      { data: attendanceFixture({ check_out: null, hours: 0 }), error: null },
    ]);
    await expect(generateVolunteerCertificate(volunteerIdentity(), "att-1")).rejects.toMatchObject({
      statusCode: 400,
      code: "ATTENDANCE_INCOMPLETE",
    });
  });

  it("rejects when the event has not finished", async () => {
    mock.queue("attendance", [{ data: attendanceFixture(), error: null }]);
    mock.queue("attendance_tokens", [
      {
        data: eventFixture({ window_end: "2026-09-21T18:00:00Z" }),
        error: null,
      },
    ]);
    await expect(generateVolunteerCertificate(volunteerIdentity(), "att-1")).rejects.toMatchObject({
      statusCode: 400,
      code: "EVENT_NOT_FINISHED",
    });
  });

  it("generates a PDF from authoritative rows for an eligible attendance", async () => {
    mock.queue("attendance", [{ data: attendanceFixture(), error: null }]);
    mock.queue("attendance_tokens", [{ data: eventFixture(), error: null }]);

    const result = await generateVolunteerCertificate(volunteerIdentity(), "att-1");

    expect(result.payload).toEqual({
      volunteerName: "Jane Doe",
      ngoName: "Education For All",
      projectTitle: "After-School Tutoring",
      eventName: "Day 1 Morning Session",
      eventDate: "2026-09-20",
      hours: 2.95,
    });
    expect(result.filename).toMatch(/^qadam-certificate-After-School-Tutoring-2026-09-20\.pdf$/);
    expect(result.buffer.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(result.buffer.length).toBeGreaterThan(500);
  });
});
