import { z } from "zod";

/**
 * Zod schemas for the attendance module (api-contracts.md "Attendance
 * Module"). The QR payload encodes `qadam://attendance/{event_id}/{token}`
 * (AGENTS.md "Attendance") - both values arrive as a plain pair in the
 * scan body; the client-supplied event_id is only a lookup hint and is
 * never trusted for authorization. The same schema backs /check-in,
 * /check-out (legacy) and the unified /scan endpoint.
 */
export const createAttendanceEventSchema = z
  .object({
    project_id: z.string().uuid("project_id must be a UUID"),
    event_name: z.string().trim().min(1).max(200).optional(),
    event_date: z.string().date("event_date must be a YYYY-MM-DD date"),
    /** ISO 8601 with timezone - the frontend sends Date.toISOString(). */
    window_start: z.string().datetime({ offset: true, message: "window_start must be an ISO 8601 datetime" }),
    window_end: z.string().datetime({ offset: true, message: "window_end must be an ISO 8601 datetime" }),
  })
  .superRefine((data, ctx) => {
    if (new Date(data.window_end).getTime() <= new Date(data.window_start).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["window_end"],
        message: "window_end must be after window_start",
      });
    }
  });

/** Shared shape for the scanned QR payload (check-in and check-out). */
export const attendanceScanSchema = z.object({
  event_id: z.string().uuid("event_id must be a UUID"),
  token: z.string().trim().min(10, "Attendance token is missing or malformed").max(256),
});

export const listAttendanceEventsQuerySchema = z.object({
  project_id: z.string().uuid("project_id must be a UUID"),
});

export const listAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  project_id: z.string().uuid("project_id must be a UUID").optional(),
  event_id: z.string().uuid("event_id must be a UUID").optional(),
});

export const attendanceEventIdParamsSchema = z.object({
  eventId: z.string().uuid("Attendance event id must be a UUID"),
});

/** Path params for on-demand certificate download by attendance row id. */
export const attendanceIdParamsSchema = z.object({
  attendanceId: z.string().uuid("Attendance id must be a UUID"),
});

export type CreateAttendanceEventBody = z.infer<typeof createAttendanceEventSchema>;
export type AttendanceScanBody = z.infer<typeof attendanceScanSchema>;
export type ListAttendanceEventsQuery = z.infer<typeof listAttendanceEventsQuerySchema>;
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;
