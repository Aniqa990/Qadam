import { z } from "zod";

/**
 * Zod schemas for the registrations module (api-contracts.md "Registrations
 * Module"). The request body only ever carries project_id - the volunteer id
 * comes from req.identity in registration.service, never from the client.
 */
export const REGISTRATION_STATUSES = ["confirmed", "cancelled"] as const;

export const createRegistrationSchema = z.object({
  project_id: z.string().uuid("project_id must be a UUID"),
});

export const listRegistrationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  project_id: z.string().uuid("project_id must be a UUID").optional(),
  status: z.enum(REGISTRATION_STATUSES).optional(),
});

export const registrationIdParamsSchema = z.object({
  id: z.string().uuid("Registration id must be a UUID"),
});

export type CreateRegistrationBody = z.infer<typeof createRegistrationSchema>;
export type ListRegistrationsQuery = z.infer<typeof listRegistrationsQuerySchema>;
