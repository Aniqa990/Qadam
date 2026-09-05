import type { NextFunction, Request, Response } from "express";
import type { RequestIdentity } from "../types/auth.types";
import * as impactService from "../services/impact.service";
import { AuthenticationError } from "../utils/errors";
import { sendSuccess } from "../utils/response";

/**
 * Thin HTTP handlers for the impact module. Controllers only read
 * authenticated identity, call the service, and shape the response - all
 * metric computation lives in impact.service.ts / the database function.
 */

function identity(req: Request): RequestIdentity {
  if (!req.identity) {
    throw new AuthenticationError();
  }
  return req.identity;
}

export async function getNgoImpact(req: Request, res: Response, next: NextFunction) {
  try {
    const metrics = await impactService.getNgoImpactMetrics(identity(req));
    return sendSuccess(res, metrics);
  } catch (err) {
    next(err);
  }
}
