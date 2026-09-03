import type { RequestIdentity } from "../types/auth.types";
import type { NgoProfile, NgoRow } from "../types/profile.types";
import type { CreateNgoProfileBody, UpdateNgoProfileBody } from "../validators/ngo.validator";
import { supabase } from "../lib/supabase";
import { AppError, AuthorizationError, NotFoundError } from "../utils/errors";

/**
 * NGO profile business logic (api-contracts.md "NGOs Module"). The ngos row
 * is created by the Clerk user.created webhook, so this service only reads
 * and updates it - the NGO identity ALWAYS comes from req.identity.domainId.
 * onboarding_complete flips true once the merged row has both a name and a
 * description, and never un-sets.
 */

type NgoProfileInput = CreateNgoProfileBody | UpdateNgoProfileBody;

async function loadNgoRow(identity: RequestIdentity): Promise<NgoRow> {
  if (identity.role !== "ngo") {
    throw new AuthorizationError("Only NGO accounts can access this resource");
  }
  const { data, error } = await supabase.from("ngos").select("*").eq("id", identity.domainId).maybeSingle();
  if (error) {
    throw new AppError(`Failed to load organization profile: ${error.message}`, 500);
  }
  if (!data) {
    throw new NotFoundError("Organization profile not found - please try again in a few seconds");
  }
  return data as unknown as NgoRow;
}

function toProfile(row: NgoRow): NgoProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    description: row.description,
    logo_url: row.logo_url,
    mission: row.mission,
    website: row.website,
    phone: row.phone,
    categories: row.categories ?? [],
    registration_number: row.registration_number,
    onboarding_complete: row.onboarding_complete,
    created_at: row.created_at,
  };
}

/** GET /api/ngos/profile - the caller's own organization profile. */
export async function getProfile(identity: RequestIdentity): Promise<NgoProfile> {
  return toProfile(await loadNgoRow(identity));
}

/**
 * POST/PUT /api/ngos/profile - update the caller's own organization profile
 * (POST = onboarding payload, PUT = partial edit). A merged row carrying
 * both name and description completes onboarding.
 */
export async function updateProfile(
  identity: RequestIdentity,
  input: NgoProfileInput
): Promise<{ id: string; onboarding_complete: boolean }> {
  const row = await loadNgoRow(identity);

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) update.name = input.name;
  if (input.description !== undefined) update.description = input.description;
  if (input.logo_url !== undefined) update.logo_url = input.logo_url;
  if (input.mission !== undefined) update.mission = input.mission;
  if (input.website !== undefined) update.website = input.website;
  if (input.phone !== undefined) update.phone = input.phone;
  if (input.categories !== undefined) update.categories = input.categories;
  if (input.registration_number !== undefined) update.registration_number = input.registration_number;

  const merged = { ...row, ...update } as NgoRow;
  const complete =
    row.onboarding_complete || (merged.name.trim().length > 0 && (merged.description?.trim().length ?? 0) > 0);
  update.onboarding_complete = complete;

  const { error } = await supabase.from("ngos").update(update).eq("id", identity.domainId);
  if (error) {
    throw new AppError(`Failed to update organization profile: ${error.message}`, 500);
  }

  return { id: row.id, onboarding_complete: complete };
}
