import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestIdentity } from "../../src/types/auth.types";
import type { ProjectStatus } from "../../src/types/project.types";
import type { SupabaseMockAccess } from "./helpers/supabase-mock";

/**
 * Unit tests for registration.service's deterministic guard chain
 * (api-contracts.md POST /api/registrations "Server-side validation").
 * The Supabase client is module-mocked with the shared queue-based builder
 * (tests/unit/helpers/supabase-mock.ts): every terminal call
 * (.single/.maybeSingle/direct await) consumes the next queued result for
 * that table, in call order.
 */

vi.mock("../../src/lib/supabase", async () => {
  const { createSupabaseMock } = await import("./helpers/supabase-mock");
  return createSupabaseMock();
});

import * as supabaseModule from "../../src/lib/supabase";
import { register, cancelRegistration } from "../../src/services/registration.service";
import { AuthorizationError, ConflictError, NotFoundError } from "../../src/utils/errors";

const mock = (supabaseModule as unknown as { __mock: SupabaseMockAccess }).__mock;

// -- fixtures ----------------------------------------------------------------

function volunteerIdentity(profile: Record<string, unknown> = {}): RequestIdentity {
  return {
    clerkUserId: "user_volunteer",
    role: "volunteer",
    email: "vol@example.com",
    domainId: "vol-1",
    profile: { id: "vol-1", onboarding_complete: true, age: 25, ...profile },
  };
}

const ngoIdentity = (): RequestIdentity => ({
  clerkUserId: "user_ngo",
  role: "ngo",
  email: "ngo@example.com",
  domainId: "ngo-1",
  profile: { id: "ngo-1" },
});

function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "proj-1",
    ngo_id: "ngo-1",
    title: "After-School Tutoring",
    status: "published" as ProjectStatus,
    capacity: 10,
    eligibility: {},
    ...overrides,
  };
}

/** project fetch + registration lookups needed by a happy-path register(). */
function queueSuccessfulRegister() {
  mock.queue("projects", [{ data: projectRow(), error: null }]);
  mock.queue("registrations", [
    { data: null, error: null }, // duplicate lookup (maybeSingle)
    { count: 3, error: null }, // confirmed count (head:true await)
    { data: { id: "reg-1", registered_at: "2026-09-03T10:00:00Z" }, error: null }, // insert
  ]);
}

// -- register -----------------------------------------------------------------

describe("register", () => {
  beforeEach(() => mock.reset());

  it("registers successfully using the authenticated volunteer's identity", async () => {
    queueSuccessfulRegister();

    const result = await register(volunteerIdentity(), { project_id: "proj-1" });

    expect(result).toEqual({
      id: "reg-1",
      status: "confirmed",
      registered_at: "2026-09-03T10:00:00Z",
    });
    // volunteer_id comes from identity.domainId, never from the client payload
    expect(mock.calls.inserts["registrations"]).toEqual([
      { volunteer_id: "vol-1", project_id: "proj-1" },
    ]);
  });

  it("rejects a duplicate (confirmed) registration with 409", async () => {
    mock.queue("projects", [{ data: projectRow(), error: null }]);
    mock.queue("registrations", [
      { data: { id: "reg-1", status: "confirmed" }, error: null },
    ]);

    const rejection = register(volunteerIdentity(), { project_id: "proj-1" });

    await expect(rejection).rejects.toBeInstanceOf(ConflictError);
    await expect(rejection).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
    expect(mock.calls.inserts["registrations"]).toBeUndefined();
  });

  it("rejects registration when the project is at capacity", async () => {
    mock.queue("projects", [{ data: projectRow({ capacity: 5 }), error: null }]);
    mock.queue("registrations", [
      { data: null, error: null }, // no existing registration
      { count: 5, error: null }, // 5 confirmed >= capacity 5
    ]);

    const rejection = register(volunteerIdentity(), { project_id: "proj-1" });

    await expect(rejection).rejects.toMatchObject({
      statusCode: 400,
      code: "PROJECT_AT_CAPACITY",
    });
    expect(mock.calls.inserts["registrations"]).toBeUndefined();
  });

  it("rejects registration on a cancelled project", async () => {
    mock.queue("projects", [{ data: projectRow({ status: "cancelled" }), error: null }]);

    await expect(register(volunteerIdentity(), { project_id: "proj-1" })).rejects.toMatchObject({
      statusCode: 400,
      code: "PROJECT_NOT_OPEN",
    });
  });

  it("rejects registration on a completed project", async () => {
    mock.queue("projects", [{ data: projectRow({ status: "completed" }), error: null }]);

    await expect(register(volunteerIdentity(), { project_id: "proj-1" })).rejects.toMatchObject({
      statusCode: 400,
      code: "PROJECT_NOT_OPEN",
    });
  });

  it("reads drafts as 404 so their existence is never leaked", async () => {
    mock.queue("projects", [{ data: projectRow({ status: "draft" }), error: null }]);

    await expect(register(volunteerIdentity(), { project_id: "proj-1" })).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("rejects NGO callers with 403 before any data access", async () => {
    await expect(register(ngoIdentity(), { project_id: "proj-1" })).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });

  it("rejects volunteers whose onboarding is incomplete", async () => {
    const identity = volunteerIdentity({ onboarding_complete: false });

    await expect(register(identity, { project_id: "proj-1" })).rejects.toMatchObject({
      statusCode: 400,
      code: "ONBOARDING_INCOMPLETE",
    });
  });

  it("enforces min_age eligibility against the volunteer profile", async () => {
    mock.queue("projects", [
      { data: projectRow({ eligibility: { min_age: 18 } }), error: null },
    ]);
    const identity = volunteerIdentity({ age: 16 });

    await expect(register(identity, { project_id: "proj-1" })).rejects.toMatchObject({
      statusCode: 400,
      code: "ELIGIBILITY_NOT_MET",
    });
  });

  it("reactivates a previously cancelled registration in place", async () => {
    mock.queue("projects", [{ data: projectRow(), error: null }]);
    mock.queue("registrations", [
      { data: { id: "reg-1", status: "cancelled" }, error: null }, // duplicate lookup
      { count: 2, error: null }, // capacity check
      { data: { id: "reg-1", registered_at: "2026-09-03T11:00:00Z" }, error: null }, // update
    ]);

    const result = await register(volunteerIdentity(), { project_id: "proj-1" });

    expect(result).toEqual({
      id: "reg-1",
      status: "confirmed",
      registered_at: "2026-09-03T11:00:00Z",
    });
    expect(mock.calls.updates["registrations"]).toEqual([
      expect.objectContaining({ status: "confirmed", cancelled_at: null }),
    ]);
    expect(mock.calls.inserts["registrations"]).toBeUndefined();
  });

  it("maps a unique-constraint race on insert to 409", async () => {
    mock.queue("projects", [{ data: projectRow(), error: null }]);
    mock.queue("registrations", [
      { data: null, error: null }, // duplicate lookup missed it...
      { count: 3, error: null },
      { data: null, error: { code: "23505", message: "duplicate key" } }, // ...insert lost the race
    ]);

    const rejection = register(volunteerIdentity(), { project_id: "proj-1" });

    await expect(rejection).rejects.toBeInstanceOf(ConflictError);
  });
});

// -- cancelRegistration --------------------------------------------------------

describe("cancelRegistration", () => {
  beforeEach(() => mock.reset());

  function registrationRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "reg-1",
      volunteer_id: "vol-1",
      project_id: "proj-1",
      status: "confirmed",
      registered_at: "2026-09-03T10:00:00Z",
      cancelled_at: null,
      volunteer: { full_name: "Jane Doe" },
      project: {
        title: "After-School Tutoring",
        status: "published",
        start_date: "2026-09-15",
        end_date: "2026-12-15",
        location_name: "Jeddah, Saudi Arabia",
        ngo_id: "ngo-1",
      },
      ...overrides,
    };
  }

  it("cancels the volunteer's own registration", async () => {
    mock.queue("registrations", [{ data: registrationRow(), error: null }]);

    const result = await cancelRegistration(volunteerIdentity(), "reg-1");

    expect(result).toMatchObject({ id: "reg-1", status: "cancelled" });
    expect(mock.calls.updates["registrations"]).toEqual([
      expect.objectContaining({ status: "cancelled" }),
    ]);
  });

  it("lets the owning NGO cancel a registration on its project", async () => {
    mock.queue("registrations", [{ data: registrationRow(), error: null }]);

    const result = await cancelRegistration(ngoIdentity(), "reg-1");

    expect(result).toMatchObject({ id: "reg-1", status: "cancelled" });
  });

  it("is idempotent: cancelling an already-cancelled registration is a no-op", async () => {
    mock.queue("registrations", [
      { data: registrationRow({ status: "cancelled", cancelled_at: "2026-09-03T12:00:00Z" }), error: null },
    ]);

    const result = await cancelRegistration(volunteerIdentity(), "reg-1");

    expect(result).toEqual({
      id: "reg-1",
      status: "cancelled",
      cancelled_at: "2026-09-03T12:00:00Z",
    });
    expect(mock.calls.updates["registrations"]).toBeUndefined();
  });

  it("hides other volunteers' registrations as 404", async () => {
    mock.queue("registrations", [
      { data: registrationRow({ volunteer_id: "vol-2" }), error: null },
    ]);

    await expect(cancelRegistration(volunteerIdentity(), "reg-1")).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("hides registrations on projects the NGO does not own as 404", async () => {
    mock.queue("registrations", [
      { data: registrationRow({ project: { ngo_id: "ngo-2", title: "x", status: "active", start_date: "2026-01-01", end_date: "2026-02-01", location_name: null } }), error: null },
    ]);

    await expect(cancelRegistration(ngoIdentity(), "reg-1")).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
