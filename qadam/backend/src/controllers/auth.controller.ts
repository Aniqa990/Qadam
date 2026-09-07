import type { NextFunction, Request, Response } from "express";
import { clerkClient } from "../lib/clerk";
import * as authService from "../services/auth.service";
import { AuthenticationError } from "../utils/errors";
import { sendSuccess } from "../utils/response";
import type { EstablishRoleBody } from "../validators/auth.validator";

/**
 * GET /api/auth/me - see api-contracts.md. Uses authMiddleware only (not
 * resolveUser) so a brand-new signup whose webhook has not finished yet
 * gets a 200 with status "pending_role" instead of a 401. When
 * unsafeMetadata.role is present, ensureProfileForClerkUser self-heals
 * the DB row + publicMetadata before responding.
 */
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) {
      throw new AuthenticationError();
    }

    const clerkUser = await clerkClient.users.getUser(req.auth.clerkUserId);
    const resolved = await authService.ensureProfileForClerkUser(clerkUser);

    if (!resolved) {
      const email =
        clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
          ?.emailAddress ??
        clerkUser.emailAddresses[0]?.emailAddress ??
        "";
      return sendSuccess(res, {
        id: req.auth.clerkUserId,
        email,
        role: null,
        profile: null,
        status: "pending_role" as const,
      });
    }

    return sendSuccess(res, {
      id: req.auth.clerkUserId,
      email: resolved.email,
      role: resolved.role,
      profile: resolved.profile,
      status: "ready" as const,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/establish-role - one-time role claim when SignUp did not
 * carry unsafeMetadata.role (or the user landed via a path that skipped
 * /register). Rejects once publicMetadata.role is already set.
 */
export async function establishRole(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) {
      throw new AuthenticationError();
    }
    const { role } = req.body as EstablishRoleBody;
    const resolved = await authService.establishRoleForClerkUser(req.auth.clerkUserId, role);
    return sendSuccess(res, {
      id: req.auth.clerkUserId,
      email: resolved.email,
      role: resolved.role,
      profile: resolved.profile,
      status: "ready" as const,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/webhook - Clerk calls this directly (not a user session),
 * so it's intentionally NOT behind authMiddleware. Trust is established via
 * svix signature verification instead (see auth.service.verifyWebhook).
 */
export async function handleClerkWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const event = authService.verifyWebhook(req);

    if (event.type === "user.created") {
      await authService.createProfileForNewUser(event.data);
    }
    // Other event types (user.updated, session.created, etc.) are
    // intentionally ignored for the MVP - add cases here only when a
    // concrete requirement needs them.

    res.status(200).json({ success: true, data: { received: true } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout - client-side logout hook. Clerk session
 * invalidation happens in the browser (signOut()), so this endpoint is
 * intentionally thin: it just acknowledges the request so the frontend
 * has a consistent API round-trip for logging out.
 */
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, { message: "Logged out" });
  } catch (err) {
    next(err);
  }
}
