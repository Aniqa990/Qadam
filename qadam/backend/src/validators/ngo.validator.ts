import { z } from "zod";

/**
 * Zod schemas for the NGO profile module (api-contracts.md "NGOs Module").
 * The ngos row is created by the Clerk user.created webhook; these schemas
 * shape the onboarding/update payloads. onboarding_complete flips true
 * server-side once name + description are both present.
 */
const categorySchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .transform((v) => v.toLowerCase());

const ngoProfileFields = {
  name: z.string().trim().min(1, "Organization name is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(5000),
  logo_url: z.string().trim().url("logo_url must be a valid URL").max(500).nullish(),
  mission: z.string().trim().max(1000).nullish(),
  website: z.string().trim().url("website must be a valid URL").max(500).nullish(),
  phone: z.string().trim().min(1).max(30).nullish(),
  categories: z.array(categorySchema).max(10, "An organization can list at most 10 categories"),
  registration_number: z.string().trim().min(1).max(100).nullish(),
};

/** POST /api/ngos/profile (onboarding) - name and description are required. */
export const createNgoProfileSchema = z.object(ngoProfileFields);

/** PUT /api/ngos/profile - partial update, omitted fields stay unchanged. */
export const updateNgoProfileSchema = z.object(ngoProfileFields).partial();

export type CreateNgoProfileBody = z.infer<typeof createNgoProfileSchema>;
export type UpdateNgoProfileBody = z.infer<typeof updateNgoProfileSchema>;
