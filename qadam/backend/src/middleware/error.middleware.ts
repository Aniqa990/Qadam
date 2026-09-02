import type { NextFunction, Request, Response } from "express";
import { AppError, ValidationError } from "../utils/errors";
import { logger } from "../utils/logger";

/**
 * Global error handler - must be registered LAST in app.ts, after all routes.
 * Maps typed AppError subclasses to their HTTP status codes; anything else
 * degrades to a generic 500 without leaking internals.
 */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  if (err instanceof AppError) {
    logger.warn("Handled error", {
      path: req.path,
      method: req.method,
      statusCode: err.statusCode,
      message: err.message,
    });

    const body: { success: false; error: { code: string; message: string; details?: unknown } } = {
      success: false,
      error: { code: err.code, message: err.message },
    };
    if (err instanceof ValidationError && err.details) {
      body.error.details = err.details;
    }
    return res.status(err.statusCode).json(body);
  }

  logger.error("Unhandled error", {
    path: req.path,
    method: req.method,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
}
