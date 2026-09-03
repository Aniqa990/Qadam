import type { NextFunction, Request, Response } from "express";
import type { RequestIdentity } from "../types/auth.types";
import type { CreateVolunteerProfileBody, UpdateVolunteerProfileBody } from "../validators/volunteer.validator";
import * as volunteerService from "../services/volunteer.service";
import { AuthenticationError } from "../utils/errors";
import { sendSuccess } from "../utils/response";

/**
 * Thin HTTP handlers for the volunteer profile module. Controllers only read
 * validated request data, call the service, and shape the response - all
 * business logic and authorization live in volunteer.service.ts.
 */

function identity(req: Request): RequestIdentity {
  if (!req.identity) {
    throw new AuthenticationError();
  }
  return req.identity;
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await volunteerService.getProfile(identity(req));
    return sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
}

export async function createProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await volunteerService.updateProfile(
      identity(req),
      req.body as CreateVolunteerProfileBody
    );
    return sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await volunteerService.updateProfile(
      identity(req),
      req.body as UpdateVolunteerProfileBody
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
