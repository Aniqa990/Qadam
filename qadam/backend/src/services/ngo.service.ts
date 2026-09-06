import type { RequestIdentity } from "../types/auth.types";
import type { NgoProfile, NgoRow } from "../types/profile.types";
import type { CreateNgoProfileBody, UpdateNgoProfileBody } from "../validators/ngo.validator";
import { supabase } from "../lib/supabase";
import { logger } from "../utils/logger";
import { AppError, AuthorizationError, NotFoundError } from "../utils/errors";

/**
 * NGO profile business logic (api-contracts.md "NGOs Module"). The ngos row
 * is created by the Clerk user.created webhook, so this service only reads
 * and updates it - the NGO identity ALWAYS comes from req.identity.domainId.
 * onboarding_complete flips true once the merged row has both a name and a
 * description, and never un-sets.
 */

type NgoProfileInput = CreateNgoProfileBody | UpdateNgoProfileBody;

// -- Logo upload ----------------------------------------------------------------

/**
 * Public Supabase Storage bucket for NGO logo images. Public on purpose:
 * brand marks are shown to every visitor (project cards, detail pages), so
 * the objects are served through public URLs - unlike the private
 * "knowledge" bucket, which never leaks document content.
 */
const LOGO_BUCKET = "ngo-logos";

/** Max logo upload size (2 MB) - logos are small brand images. */
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** Allowed logo MIME types mapped to their file extension. */
const LOGO_MIME_TYPES = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

/**
 * Ensure the "ngo-logos" storage bucket exists in Supabase. Creates it
 * (public, 2 MB file limit) if missing. Called once at server startup so
 * logo uploads never fail with "Bucket not found" - mirrors
 * knowledge.service.ensureStorageBucket.
 */
export async function ensureLogoBucket(): Promise<void> {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    logger.warn("Could not list storage buckets", { error: error.message });
    return;
  }
  if (buckets?.some((b) => b.name === LOGO_BUCKET)) {
    return;
  }
  const { error: createError } = await supabase.storage.createBucket(LOGO_BUCKET, {
    public: true,
    fileSizeLimit: LOGO_MAX_BYTES,
  });
  if (createError) {
    logger.warn("Could not auto-create storage bucket", {
      bucket: LOGO_BUCKET,
      error: createError.message,
    });
  } else {
    logger.info("Created Supabase storage bucket", { bucket: LOGO_BUCKET });
  }
}

/**
 * Best-effort: extract the storage path of a previous logo that lives in our
 * public bucket (…/object/public/ngo-logos/<path>) so the replaced object can
 * be removed. Returns null for external URLs, which we never touch.
 */
function logoStoragePath(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  const marker = `/object/public/${LOGO_BUCKET}/`;
  const idx = logoUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(logoUrl.slice(idx + marker.length));
}

/**
 * POST /api/ngos/profile/logo - store an uploaded logo image in the public
 * "ngo-logos" bucket and point ngos.logo_url at its public URL, replacing
 * any previous logo. The NGO id always comes from req.identity.domainId,
 * never the request body.
 */
export async function uploadLogo(
  identity: RequestIdentity,
  file: { buffer: Buffer; mimetype: string; size: number }
): Promise<{ logo_url: string }> {
  const row = await loadNgoRow(identity); // enforces the NGO role + row existence

  const extension = LOGO_MIME_TYPES.get(file.mimetype);
  if (!extension) {
    throw new AppError(
      `Unsupported file type: ${file.mimetype}. Allowed: PNG, JPEG, WebP`,
      400,
      "UNSUPPORTED_FILE_TYPE"
    );
  }
  if (file.size > LOGO_MAX_BYTES) {
    throw new AppError("File size exceeds the 2 MB limit", 400, "FILE_TOO_LARGE");
  }

  const storagePath = `${identity.domainId}/logo-${Date.now()}.${extension}`;
  const { error: storageError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });
  if (storageError) {
    throw new AppError(`Failed to upload logo: ${storageError.message}`, 500);
  }

  const publicUrl = supabase.storage.from(LOGO_BUCKET).getPublicUrl(storagePath).data.publicUrl;

  const { error: updateError } = await supabase
    .from("ngos")
    .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", identity.domainId);
  if (updateError) {
    throw new AppError(`Failed to save logo URL: ${updateError.message}`, 500);
  }

  // Best-effort cleanup of the replaced logo's object - external URLs (and
  // a failed removal) are simply ignored; the new logo is already live.
  const oldPath = logoStoragePath(row.logo_url);
  if (oldPath && oldPath !== storagePath) {
    supabase.storage
      .from(LOGO_BUCKET)
      .remove([oldPath])
      .catch((err: unknown) => {
        logger.warn("Failed to remove replaced logo from storage", {
          ngoId: identity.domainId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  return { logo_url: publicUrl };
}

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
