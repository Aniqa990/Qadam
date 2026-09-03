import type { RequestIdentity } from "../types/auth.types";
import type { VolunteerProfile, VolunteerRow } from "../types/profile.types";
import type { CreateVolunteerProfileBody, UpdateVolunteerProfileBody } from "../validators/volunteer.validator";
import { supabase } from "../lib/supabase";
import { reverseGeocode } from "./geocoding.service";
import { regenerateVolunteerEmbedding } from "./ai/embedding.service";
import { logger } from "../utils/logger";
import { AppError, AuthorizationError, NotFoundError } from "../utils/errors";

/**
 * Volunteer profile business logic (api-contracts.md "Volunteers Module").
 * The volunteers row is created by the Clerk user.created webhook, so this
 * service only reads and updates it - the volunteer identity ALWAYS comes
 * from req.identity.domainId, never from the request body. onboarding_complete
 * flips true once the merged row has at least full_name + skills + interests,
 * and never un-sets (clearing fields later can't lock a volunteer out of the
 * app they already onboarded into).
 */

/** Fire-and-forget: an embedding failure must never fail a core write. */
function triggerVolunteerEmbedding(volunteerId: string): void {
  regenerateVolunteerEmbedding(volunteerId).catch((err) => {
    logger.error("Volunteer embedding regeneration failed", {
      volunteerId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

type VolunteerProfileInput = CreateVolunteerProfileBody | UpdateVolunteerProfileBody;

async function loadVolunteerRow(identity: RequestIdentity): Promise<VolunteerRow> {
  if (identity.role !== "volunteer") {
    throw new AuthorizationError("Only volunteer accounts can access this resource");
  }
  const { data, error } = await supabase.from("volunteers").select("*").eq("id", identity.domainId).maybeSingle();
  if (error) {
    throw new AppError(`Failed to load volunteer profile: ${error.message}`, 500);
  }
  if (!data) {
    throw new NotFoundError("Volunteer profile not found - please try again in a few seconds");
  }
  return data as unknown as VolunteerRow;
}

function toProfile(row: VolunteerRow): VolunteerProfile {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    skills: row.skills ?? [],
    interests: row.interests ?? [],
    experience: row.experience,
    location_lat: row.location_lat,
    location_lng: row.location_lng,
    location_name: row.location_name,
    age: row.age,
    onboarding_complete: row.onboarding_complete,
    created_at: row.created_at,
  };
}

/** GET /api/volunteers/profile - the caller's own full profile. */
export async function getProfile(identity: RequestIdentity): Promise<VolunteerProfile> {
  return toProfile(await loadVolunteerRow(identity));
}

/**
 * POST/PUT /api/volunteers/profile - update the caller's own profile
 * (POST = onboarding payload, PUT = partial edit). A moved pin re-resolves
 * its "City, Country" label server-side; the label is cached, never trusted
 * from the client.
 */
export async function updateProfile(
  identity: RequestIdentity,
  input: VolunteerProfileInput
): Promise<{ id: string; onboarding_complete: boolean }> {
  const row = await loadVolunteerRow(identity);

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.full_name !== undefined) update.full_name = input.full_name;
  if (input.phone !== undefined) update.phone = input.phone;
  if (input.skills !== undefined) update.skills = input.skills;
  if (input.interests !== undefined) update.interests = input.interests;
  if (input.experience !== undefined) update.experience = input.experience;
  if (input.age !== undefined) update.age = input.age;

  const latChanged = input.location_lat !== undefined && input.location_lat !== row.location_lat;
  const lngChanged = input.location_lng !== undefined && input.location_lng !== row.location_lng;
  const locationProvided = input.location_lat !== undefined && input.location_lng !== undefined;
  if (latChanged || lngChanged) {
    const lat = input.location_lat as number;
    const lng = input.location_lng as number;
    update.location_lat = lat;
    update.location_lng = lng;
    // Re-resolve the display label only when the pin actually moved, or when
    // the same pin was re-saved but a previous geocode failure left it null.
    update.location_name = await reverseGeocode(lat, lng);
  } else if (locationProvided && row.location_name == null) {
    update.location_name = await reverseGeocode(input.location_lat as number, input.location_lng as number);
  }

  // onboarding_complete is computed from the merged row so a single POST
  // carrying name + skills + interests finishes onboarding in one call.
  const merged = { ...row, ...update } as VolunteerRow;
  const complete =
    row.onboarding_complete ||
    (merged.full_name.trim().length > 0 && (merged.skills?.length ?? 0) > 0 && (merged.interests?.length ?? 0) > 0);
  update.onboarding_complete = complete;

  const { error } = await supabase.from("volunteers").update(update).eq("id", identity.domainId);
  if (error) {
    throw new AppError(`Failed to update volunteer profile: ${error.message}`, 500);
  }

  // Embedding input is skills + interests + experience (database-schema.md
  // "volunteer_embeddings") — regenerate whenever any of them changed.
  const embeddingContentChanged =
    (input.skills !== undefined && JSON.stringify(input.skills) !== JSON.stringify(row.skills ?? [])) ||
    (input.interests !== undefined && JSON.stringify(input.interests) !== JSON.stringify(row.interests ?? [])) ||
    (input.experience !== undefined && input.experience !== row.experience);
  if (embeddingContentChanged) {
    triggerVolunteerEmbedding(row.id);
  }

  return { id: row.id, onboarding_complete: complete };
}
