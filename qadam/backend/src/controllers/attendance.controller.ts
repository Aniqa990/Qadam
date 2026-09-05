import type { NextFunction, Request, Response } from "express";
import type { RequestIdentity } from "../types/auth.types";
import type { CreateAttendanceEventBody } from "../validators/attendance.validator";
import * as attendanceService from "../services/attendance.service";
import * as certificateService from "../services/certificate.service";
import { AuthenticationError } from "../utils/errors";
import { sendPaginated, sendSuccess } from "../utils/response";

/**
 * Thin HTTP handlers for the attendance module. Controllers only read
 * validated request data, call the service, and shape the response - all
 * validation chains and authorization live in attendance.service.ts.
 */

function identity(req: Request): RequestIdentity {
  if (!req.identity) {
    throw new AuthenticationError();
  }
  return req.identity;
}

export async function createEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await attendanceService.createAttendanceEvent(
      identity(req),
      req.body as CreateAttendanceEventBody
    );
    return sendSuccess(res, event, 201);
  } catch (err) {
    next(err);
  }
}

export async function listEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await attendanceService.listAttendanceEvents(identity(req), String(req.query.project_id));
    return sendSuccess(res, events);
  } catch (err) {
    next(err);
  }
}

export async function getEventQr(req: Request, res: Response, next: NextFunction) {
  try {
    const qr = await attendanceService.getEventQr(identity(req), req.params.eventId as string);
    return sendSuccess(res, qr);
  } catch (err) {
    next(err);
  }
}

export async function stopEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await attendanceService.stopAttendanceEvent(identity(req), req.params.eventId as string);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function checkIn(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await attendanceService.checkIn(identity(req), req.body);
    return sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function checkOut(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await attendanceService.checkOut(identity(req), req.body);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/attendance/scan - unified check-in/check-out endpoint. The
 * server determines which action applies based on the existing attendance
 * row; the client just relays the scanned (event_id, token) pair. This
 * handler is a thin wrapper around recordAttendance() which is designed
 * to be callable from other flows (NGO manual marking) too.
 */
export async function scan(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await attendanceService.recordAttendance(
      identity(req),
      req.body
    );
    return sendSuccess(res, result, result.action === "checked-in" ? 201 : 200);
  } catch (err) {
    next(err);
  }
}

export async function listRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, project_id, event_id } = req.query as unknown as {
      page: number;
      limit: number;
      project_id?: string;
      event_id?: string;
    };
    const result = await attendanceService.listAttendanceRecords(identity(req), {
      page,
      limit,
      project_id,
      event_id,
    });
    return sendPaginated(res, result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
}

export async function history(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await attendanceService.getVolunteerHistory(identity(req));
    return sendSuccess(res, items);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/attendance/:attendanceId/certificate — on-demand PDF. Streams the
 * generated buffer with Content-Disposition attachment; never stores it.
 */
export async function downloadCertificate(req: Request, res: Response, next: NextFunction) {
  try {
    const { buffer, filename } = await certificateService.generateVolunteerCertificate(
      identity(req),
      req.params.attendanceId as string
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    // Avoid caching personalized certificates on shared proxies.
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buffer);
  } catch (err) {
    next(err);
  }
}
