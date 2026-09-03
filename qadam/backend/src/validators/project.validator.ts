import { z } from "zod";

/**
 * Zod schemas for the projects module (api-contracts.md "Projects Module").
 * Note on location: the client sends only the exact pin
 * (location_lat/location_lng). location_name is resolved server-side via
 * BigDataCloud and cached in the row (AGENTS.md "Location fields" rule), so a
 * client-supplied location_name is deliberately stripped here rather than
 * trusted. ngo_id/status are likewise never accepted from the body - the
 * owner comes from req.identity and status only changes via transition
 * endpoints.
 */
export const PROJECT_STATUSES = ["draft", "published", "active", "completed", "cancelled"] as const;

const skillSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .transform((v) => v.toLowerCase());

const responsibilitySchema = z.string().trim().min(1).max(300);
const customRequirementSchema = z.string().trim().min(1).max(200);

export const projectEligibilitySchema = z.object({
  min_age: z.number().int().min(15).max(100).optional(),
  custom_requirements: z.array(customRequirementSchema).max(10).optional(),
});

/**
 * Shared field schemas. createProjectSchema requires the full set;
 * updateProjectSchema is partial (omitted fields stay unchanged).
 */
const projectFields = {
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(5000),
  category: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .transform((v) => v.toLowerCase()),
  required_skills: z.array(skillSchema).max(30).default([]),
  responsibilities: z.array(responsibilitySchema).max(20).default([]),
  eligibility: projectEligibilitySchema.default({}),
  capacity: z.number({ invalid_type_error: "Capacity must be a number" })
    .int("Capacity must be a whole number")
    .min(1)
    .max(10000),
  whatsapp_group_url: z.string().trim().url("whatsapp_group_url must be a valid URL").max(500).nullish(),
  start_date: z.string().date("start_date must be a YYYY-MM-DD date"),
  end_date: z.string().date("end_date must be a YYYY-MM-DD date"),
  event_date: z.string().date("event_date must be a YYYY-MM-DD date").nullish(),
  location_lat: z.number().min(-90).max(90),
  location_lng: z.number().min(-180).max(180),
  hours_per_session: z.number().min(0).max(24).optional(),
};

export const createProjectSchema = z.object(projectFields).superRefine((data, ctx) => {
  if (data.end_date < data.start_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["end_date"],
      message: "End date must be on or after start date",
    });
  }
});

export const updateProjectSchema = z.object(projectFields).partial().superRefine((data, ctx) => {
  // Only cross-check when both are provided; a lone end_date is compared
  // against the stored start_date in project.service.updateProject.
  if (data.start_date && data.end_date && data.end_date < data.start_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["end_date"],
      message: "End date must be on or after start date",
    });
  }
  if ((data.location_lat === undefined) !== (data.location_lng === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["location_lat"],
      message: "location_lat and location_lng must be provided together",
    });
  }
});

export const listProjectsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(PROJECT_STATUSES).optional(),
    category: z.string().trim().min(1).max(60).optional(),
    search: z.string().trim().min(1).max(100).optional(),
    /** Case-insensitive: skills are stored lowercase in required_skills. */
    skill: skillSchema.optional(),
    /** Substring match against the cached "City, Country" label. */
    location: z.string().trim().min(1).max(100).optional(),
    /** Overlap window: a project matches when it runs any time within it. */
    date_from: z.string().date("date_from must be a YYYY-MM-DD date").optional(),
    date_to: z.string().date("date_to must be a YYYY-MM-DD date").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.date_from && data.date_to && data.date_from > data.date_to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date_to"],
        message: "date_to must be on or after date_from",
      });
    }
  });

export const projectIdParamsSchema = z.object({
  id: z.string().uuid("Project id must be a UUID"),
});

export type CreateProjectBody = z.infer<typeof createProjectSchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
