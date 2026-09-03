import type { NextFunction, Request, Response } from "express";
import type { RequestIdentity } from "../types/auth.types";
import type { MatchingQuery } from "../validators/matching.validator";
import * as matchingService from "../services/ai/matching.service";
import { AuthenticationError } from "../utils/errors";
import { sendSuccess } from "../utils/response";

/**
 * Thin HTTP layer for the matching endpoints:
 *   GET /api/matching/volunteers/:projectId (NGO-only)
 *   GET /api/matching/projects             (Volunteer-only)
 * Reads the resolved identity and validated params, delegates to
 * matching.service, returns the ranked results — no business logic.
 */

function identity(req: Request): RequestIdentity {
  if (!req.identity) {
    throw new AuthenticationError();
  }
  return req.identity;
}

export async function getVolunteerMatches(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { projectId } = req.params as { projectId: string };
    const { limit } = req.query as unknown as MatchingQuery;

    const matches = await matchingService.matchVolunteers(
      identity(req),
      projectId,
      limit
    );

    return sendSuccess(res, matches);
  } catch (err) {
    next(err);
  }
}

export async function getProjectRecommendations(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { limit } = req.query as unknown as MatchingQuery;

    const recommendations = await matchingService.matchProjects(
      identity(req),
      limit
    );

    return sendSuccess(res, recommendations);
  } catch (err) {
    next(err);
  }
}
