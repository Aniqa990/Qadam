import type { NextFunction, Request, Response } from "express";
import type { RequestIdentity } from "../types/auth.types";
import type { CreateNgoProfileBody, UpdateNgoProfileBody } from "../validators/ngo.validator";
import * as ngoService from "../services/ngo.service";
import { AuthenticationError } from "../utils/errors";
import { sendSuccess } from "../utils/response";

/**
 * Thin HTTP handlers for the NGO profile module. Controllers only read
 * validated request data, call the service, and shape the response - all
 * business logic and authorization live in ngo.service.ts.
 */

function identity(req: Request): RequestIdentity {
  if (!req.identity) {
    throw new AuthenticationError();
  }
  return req.identity;
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await ngoService.getProfile(identity(req));
    return sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
}

export async function createProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await ngoService.updateProfile(identity(req), req.body as CreateNgoProfileBody);
    return sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await ngoService.updateProfile(identity(req), req.body as UpdateNgoProfileBody);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
