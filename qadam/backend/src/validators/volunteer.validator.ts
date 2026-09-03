import { z } from "zod";

/**
 * Zod schemas for the volunteer profile module (api-contracts.md
 * "Volunteers Module"). Same rule as projects: the client sends only the exact
 * pin (location_lat/location_lng) - location_name ("City, Country") is
 * resolved server-side via BigDataCloud and cached, so a client-supplied
 * location_name is stripped here rather than trusted. Skills and interests
 * are TEXT[] with GIN indexes (AGENTS.md), stored lowercase.
 */
const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .transform((v) => v.toLowerCase());

const volunteerProfileFields = {
  full_name: z.string().trim().min(1, "Full name is required").max(200),
  phone: z.string().trim().min(1).max(30).nullish(),
  skills: z.array(tagSchema).max(30, "A profile can list at most 30 skills"),
  interests: z.array(tagSchema).max(30, "A profile can list at most 30 interests"),
  experience: z.string().trim().max(2000).nullish(),
  /** DB CHECK: volunteers.age IS NULL OR age BETWEEN 15 AND 100. */
  age: z.number().int().min(15).max(100).nullish(),
  location_lat: z.number().min(-90).max(90),
  location_lng: z.number().min(-180).max(180),
};

/**
 * POST /api/volunteers/profile (onboarding). All fields except full_name are
 * optional; onboarding_complete flips true server-side once the merged row
 * has at least full_name + skills + interests (api-contracts.md).
 */
export const createVolunteerProfileSchema = z.object(volunteerProfileFields).superRefine((data, ctx) => {
  if ((data.location_lat === undefined) !== (data.location_lng === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["location_lat"],
      message: "location_lat and location_lng must be provided together",
    });
  }
});

/** PUT /api/volunteers/profile - partial update, omitted fields stay unchanged. */
export const updateVolunteerProfileSchema = z
  .object(volunteerProfileFields)
  .partial()
  .superRefine((data, ctx) => {
    if ((data.location_lat === undefined) !== (data.location_lng === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["location_lat"],
        message: "location_lat and location_lng must be provided together",
      });
    }
  });

export type CreateVolunteerProfileBody = z.infer<typeof createVolunteerProfileSchema>;
export type UpdateVolunteerProfileBody = z.infer<typeof updateVolunteerProfileSchema>;
