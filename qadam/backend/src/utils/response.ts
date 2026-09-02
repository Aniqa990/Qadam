import type { Response } from "express";

/**
 * Shared response envelope: { success, data } for 2xx,
 * { success: false, error } for errors (see error.middleware.ts).
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export type Pagination = { page: number; limit: number; total: number; totalPages: number };

/**
 * List-endpoint envelope per api-contracts.md:
 *   { "success": true, "data": [...], "pagination": { page, limit, total, totalPages } }
 * `limit` is capped at 100 and defaults to 20 (see api-contracts.md "General
 * Conventions" - Pagination). Compute totalPages here so every list endpoint
 * derives it the same way instead of each controller reimplementing it.
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  params: { page: number; limit: number; total: number }
) {
  const pagination: Pagination = {
    page: params.page,
    limit: params.limit,
    total: params.total,
    totalPages: Math.max(1, Math.ceil(params.total / params.limit)),
  };
  return res.status(200).json({ success: true, data, pagination });
}
