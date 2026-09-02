import type { NextFunction, Request, Response } from "express";

export function notFoundMiddleware(req: Request, res: Response, _next: NextFunction) {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` },
  });
}
