import type { User } from "@clerk/backend";
import type { Request } from "express";
import { Webhook } from "svix";
import { clerkConfig } from "../config/clerk";
import { clerkClient } from "../lib/clerk";
import { supabase } from "../lib/supabase";
import { AppError, AuthenticationError, ConflictError, NotFoundError } from "../utils/errors";
import type { AppRole } from "../types/auth.types";

/**
 * Minimal shape we read off Clerk's `user.created` webhook payload.
 * Not the full Clerk User type - just what createProfileForNewUser needs.
 */
interface ClerkUserCreatedData {
  id: string;
  email_addresses: { email_address: string }[];
  first_name?: string | null;
  last_name?: string | null;
  unsafe_metadata?: Record<string, unknown>;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserCreatedData;
}

export type ResolvedAuthUser = {
  role: AppRole;
  profile: Record<string, unknown>;
  email: string;
};

function parseRole(value: unknown): AppRole | null {
  return value === "volunteer" || value === "ngo" ? value : null;
}

function primaryEmailFromClerkUser(clerkUser: User): string {
  return (
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    ""
  );
}

function placeholderNameFromClerkUser(clerkUser: User, email: string): string {
  return (
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    email.split("@")[0] ||
    "User"
  );
}

/**
 * Verifies the svix signature on an incoming Clerk webhook request.
 * Requires req.body to be the RAW request buffer (see app.ts - the
 * webhook route is mounted with express.raw() ahead of express.json()).
 */
export function verifyWebhook(req: Request): ClerkWebhookEvent {
  const payload = req.body as Buffer;
  const headers = {
    "svix-id": req.header("svix-id") ?? "",
    "svix-timestamp": req.header("svix-timestamp") ?? "",
    "svix-signature": req.header("svix-signature") ?? "",
  };

  const wh = new Webhook(clerkConfig.webhookSecret);
  try {
    return wh.verify(payload, headers) as unknown as ClerkWebhookEvent;
  } catch {
    throw new AuthenticationError("Invalid Clerk webhook signature");
  }
}

/**
 * Inserts the volunteers/ngos row if missing. Unique (auth_user_id) races
 * with the webhook are treated as success so reconcile and user.created
 * can both run safely.
 */
async function ensureProfileRow(
  role: AppRole,
  clerkUserId: string,
  email: string,
  placeholderName: string
): Promise<Record<string, unknown>> {
  const existing = await findProfileByRoleOptional(role, clerkUserId);
  if (existing) return existing;

  const { error: insertError } =
    role === "volunteer"
      ? await supabase.from("volunteers").insert({
          auth_user_id: clerkUserId,
          full_name: placeholderName,
          email,
          onboarding_complete: false,
        })
      : await supabase.from("ngos").insert({
          auth_user_id: clerkUserId,
          name: placeholderName,
          email,
          onboarding_complete: false,
        });

  if (insertError && insertError.code !== "23505") {
    throw new AppError(`Failed to create ${role} profile: ${insertError.message}`, 500);
  }

  const profile = await findProfileByRoleOptional(role, clerkUserId);
  if (!profile) {
    throw new AppError(`Failed to load ${role} profile after create`, 500);
  }
  return profile;
}

async function promotePublicRole(clerkUserId: string, role: AppRole, currentPublic?: unknown): Promise<void> {
  if (parseRole(currentPublic) === role) return;
  await clerkClient.users.updateUserMetadata(clerkUserId, {
    publicMetadata: { role },
  });
}

/**
 * user.created -> create the matching volunteers/ngos row, then promote
 * the role from Clerk's unsafeMetadata (client-writable at sign-up) to
 * publicMetadata (server-only) so every future request trusts a value the
 * client can no longer tamper with. See AGENTS.md "Clerk Auth Migration".
 *
 * full_name/name are NOT NULL in the schema but aren't known yet at
 * sign-up time - we seed a reasonable placeholder from Clerk's name
 * fields (or the email's local part) and onboarding_complete stays false
 * until the volunteer/NGO fills in the real onboarding form (Phase 3).
 */
export async function createProfileForNewUser(data: ClerkUserCreatedData): Promise<void> {
  const role = parseRole(data.unsafe_metadata?.role);
  if (!role) {
    throw new AppError(
      `Clerk user ${data.id} signed up without a valid role in unsafeMetadata`,
      400,
      "INVALID_ROLE"
    );
  }

  const email = data.email_addresses[0]?.email_address;
  if (!email) {
    throw new AppError(`Clerk user ${data.id} has no email address`, 400, "MISSING_EMAIL");
  }

  const placeholderName =
    [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
    email.split("@")[0] ||
    "User";

  await ensureProfileRow(role, data.id, email, placeholderName);
  await promotePublicRole(data.id, role);
}

/**
 * Self-heal path used by /auth/me and resolveUser. If the webhook was
 * delayed or missed but SignUp wrote unsafeMetadata.role, create the DB
 * row and promote the role to publicMetadata. Returns null when no role
 * exists in either metadata bag (frontend should show role selection).
 */
export async function ensureProfileForClerkUser(clerkUser: User): Promise<ResolvedAuthUser | null> {
  const role =
    parseRole(clerkUser.publicMetadata?.role) ?? parseRole(clerkUser.unsafeMetadata?.role);
  if (!role) return null;

  const email = primaryEmailFromClerkUser(clerkUser);
  if (!email) {
    throw new AppError(`Clerk user ${clerkUser.id} has no email address`, 400, "MISSING_EMAIL");
  }

  const profile = await ensureProfileRow(
    role,
    clerkUser.id,
    email,
    placeholderNameFromClerkUser(clerkUser, email)
  );
  await promotePublicRole(clerkUser.id, role, clerkUser.publicMetadata?.role);

  return { role, profile, email };
}

/**
 * One-time role claim for authenticated users who signed up without
 * unsafeMetadata (e.g. OAuth path that skipped /register role pick).
 * Rejects if publicMetadata.role is already set to a different value.
 */
export async function establishRoleForClerkUser(
  clerkUserId: string,
  role: AppRole
): Promise<ResolvedAuthUser> {
  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const existingPublic = parseRole(clerkUser.publicMetadata?.role);
  if (existingPublic && existingPublic !== role) {
    throw new ConflictError(`Account role is already set to ${existingPublic}`);
  }

  const existingUnsafe = parseRole(clerkUser.unsafeMetadata?.role);
  if (existingUnsafe && existingUnsafe !== role) {
    throw new ConflictError(`Account role was already chosen as ${existingUnsafe} at sign-up`);
  }

  const email = primaryEmailFromClerkUser(clerkUser);
  if (!email) {
    throw new AppError(`Clerk user ${clerkUserId} has no email address`, 400, "MISSING_EMAIL");
  }

  const profile = await ensureProfileRow(
    role,
    clerkUserId,
    email,
    placeholderNameFromClerkUser(clerkUser, email)
  );
  await promotePublicRole(clerkUserId, role, clerkUser.publicMetadata?.role);

  return { role, profile, email };
}

async function findProfileByRoleOptional(
  role: AppRole,
  clerkUserId: string
): Promise<Record<string, unknown> | null> {
  const table = role === "volunteer" ? "volunteers" : "ngos";
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("auth_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to load ${role} profile: ${error.message}`, 500);
  }
  return data;
}

/**
 * Looks up the volunteer/ngo row for an authenticated Clerk user.
 * Used by resolveUser.middleware.ts on every protected request.
 */
export async function findProfileByRole(
  role: AppRole,
  clerkUserId: string
): Promise<Record<string, unknown>> {
  const data = await findProfileByRoleOptional(role, clerkUserId);
  if (!data) {
    throw new NotFoundError(
      `No ${role} profile found for this account yet. If you just signed up, wait a few seconds and try again.`
    );
  }
  return data;
}
