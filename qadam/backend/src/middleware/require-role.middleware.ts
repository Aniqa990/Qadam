import type { NextFunction, Request, Response } from "express";
import type { AppRole } from "../types/auth.types";
import { AuthenticationError, AuthorizationError } from "../utils/errors";

/**
 * Role-level authorization for a route (architecture.md "Request Lifecycle"
 * step 4). Runs after authMiddleware + resolveUserMiddleware so req.identity
 * is populated. Ownership checks (e.g. "does this NGO own this project") stay
 * in the services where the resource is loaded.
 */
export function requireRole(...roles: AppRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.identity) {
      return next(new AuthenticationError());
    }
    if (!roles.includes(req.identity.role)) {
      return next(
        new AuthorizationError(`This action is only available to ${roles.join(" or ")} accounts`)
      );
    }
    next();
  };
}
