import { Router } from "express";
import * as attendanceController from "../controllers/attendance.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { resolveUserMiddleware } from "../middleware/resolveUser.middleware";
import { requireRole } from "../middleware/require-role.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  attendanceEventIdParamsSchema,
  attendanceScanSchema,
  createAttendanceEventSchema,
  listAttendanceEventsQuerySchema,
  listAttendanceQuerySchema,
} from "../validators/attendance.validator";

const router = Router();

/**
 * Attendance routes (AGENTS.md "Attendance"). Event management is NGO-only
 * and ownership-checked in attendance.service; check-in/check-out are
 * volunteer-only and accept ONLY the scanned (event_id, token) pair - the
 * client can never mark attendance as verified itself.
 */
router.use(authMiddleware, resolveUserMiddleware);

router.post(
  "/events",
  requireRole("ngo"),
  validate(createAttendanceEventSchema),
  attendanceController.createEvent
);

router.get(
  "/events",
  requireRole("ngo"),
  validate(listAttendanceEventsQuerySchema, "query"),
  attendanceController.listEvents
);

router.get(
  "/events/:eventId/qr",
  requireRole("ngo"),
  validate(attendanceEventIdParamsSchema, "params"),
  attendanceController.getEventQr
);

router.post(
  "/events/:eventId/stop",
  requireRole("ngo"),
  validate(attendanceEventIdParamsSchema, "params"),
  attendanceController.stopEvent
);

router.post(
  "/check-in",
  requireRole("volunteer"),
  validate(attendanceScanSchema),
  attendanceController.checkIn
);

router.post(
  "/check-out",
  requireRole("volunteer"),
  validate(attendanceScanSchema),
  attendanceController.checkOut
);

// Both roles list attendance records (volunteers: own; NGOs: own projects).
router.get(
  "/",
  validate(listAttendanceQuerySchema, "query"),
  attendanceController.listRecords
);

export default router;
