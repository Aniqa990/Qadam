import type { Request } from "express";
import { Webhook } from "svix";
import { clerkConfig } from "../config/clerk";
import { clerkClient } from "../lib/clerk";
import { supabase } from "../lib/supabase";
import { AppError, AuthenticationError, NotFoundError } from "../utils/errors";
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
  const role = data.unsafe_metadata?.role;
  if (role !== "volunteer" && role !== "ngo") {
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
    [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || email.split("@")[0];

  // const table = role === "volunteer" ? "volunteers" : "ngos";
  // const row =
  //   role === "volunteer"
  //     ? { auth_user_id: data.id, full_name: placeholderName, email, onboarding_complete: false }
  //     : { auth_user_id: data.id, name: placeholderName, email, onboarding_complete: false };

  // const { error: insertError } = await supabase.from(table).insert(row);
  // if (insertError) {
  //   throw new AppError(`Failed to create ${role} profile: ${insertError.message}`, 500);
  // }
  const { error: insertError } =
  role === "volunteer"
    ? await supabase
        .from("volunteers")
        .insert({ auth_user_id: data.id, full_name: placeholderName, email, onboarding_complete: false })
    : await supabase
        .from("ngos")
        .insert({ auth_user_id: data.id, name: placeholderName, email, onboarding_complete: false });

if (insertError) {
  throw new AppError(`Failed to create ${role} profile: ${insertError.message}`, 500);
}

  await clerkClient.users.updateUserMetadata(data.id, {
    publicMetadata: { role },
  });
}

/**
 * Looks up the volunteer/ngo row for an authenticated Clerk user.
 * Used by resolveUser.middleware.ts on every protected request.
 */
export async function findProfileByRole(
  role: AppRole,
  clerkUserId: string
): Promise<Record<string, unknown>> {
  const table = role === "volunteer" ? "volunteers" : "ngos";
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("auth_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to load ${role} profile: ${error.message}`, 500);
  }
  if (!data) {
    throw new NotFoundError(
      `No ${role} profile found for this account yet. If you just signed up, wait a few seconds and try again.`
    );
  }
  return data;
}
