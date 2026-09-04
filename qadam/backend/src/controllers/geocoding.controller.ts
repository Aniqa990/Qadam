import type { NextFunction, Request, Response } from "express";
import type { SearchQuery } from "../validators/geocoding.validator";
import * as geocodingService from "../services/geocoding.service";
import { sendSuccess } from "../utils/response";

/**
 * Thin HTTP layer for /api/geocoding (api-contracts.md "Geocoding Module").
 * Just reads the validated query and returns place suggestions - providers,
 * graceful degradation, and response mapping all live in the service.
 */
export async function searchLocations(req: Request, res: Response, next: NextFunction) {
  try {
    const { q } = req.query as unknown as SearchQuery;
    const suggestions = await geocodingService.searchLocations(q);
    return sendSuccess(res, suggestions);
  } catch (err) {
    next(err);
  }
}
