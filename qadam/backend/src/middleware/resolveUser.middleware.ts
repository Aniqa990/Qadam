import type { NextFunction, Request, Response } from "express";
import { clerkClient } from "../lib/clerk";
import { ensureProfileForClerkUser } from "../services/auth.service";
import { AppError, AuthenticationError } from "../utils/errors";

/**
 * Second step of the auth pipeline - runs after authMiddleware. Resolves
 * the Clerk user to its volunteer/ngo row and attaches role + profile +
 * domainId to req.identity. Role is read from Clerk's publicMetadata
 * (server-only, set by the user.created webhook or reconcile path) - never
 * from anything client-supplied on the request body. If SignUp wrote
 * unsafeMetadata.role but the webhook has not run yet, we self-heal here.
 * Route handlers/authorization checks in later phases read
 * req.identity.role / req.identity.domainId, never req.body.
 */
export async function resolveUserMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.auth) {
      throw new AuthenticationError();
    }

    const clerkUser = await clerkClient.users.getUser(req.auth.clerkUserId);
    const resolved = await ensureProfileForClerkUser(clerkUser);
    if (!resolved) {
      // 403 (not 401): session is valid; role simply has not been chosen yet.
      throw new AppError(
        "Account role has not been established yet",
        403,
        "ROLE_PENDING"
      );
    }

    req.identity = {
      clerkUserId: req.auth.clerkUserId,
      role: resolved.role,
      email: resolved.email,
      profile: resolved.profile,
      domainId: resolved.profile.id as string,
    };
    next();
  } catch (err) {
    next(err);
  }
}
