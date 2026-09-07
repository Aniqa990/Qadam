import { z } from "zod";

/** POST /api/auth/establish-role — one-time role claim while status is pending_role. */
export const establishRoleSchema = z.object({
  role: z.enum(["volunteer", "ngo"]),
});

export type EstablishRoleBody = z.infer<typeof establishRoleSchema>;
