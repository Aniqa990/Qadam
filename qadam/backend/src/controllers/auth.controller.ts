import type { NextFunction, Request, Response } from "express";
import * as authService from "../services/auth.service";
import { AuthenticationError } from "../utils/errors";
import { sendSuccess } from "../utils/response";

/**
 * GET /api/auth/me - see api-contracts.md. Controller stays thin: reads
 * req.identity (set by auth.middleware -> resolveUser.middleware) and
 * shapes the response. No business logic here.
 */
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.identity) {
      throw new AuthenticationError();
    }
    const { clerkUserId, email, role, profile } = req.identity;
    return sendSuccess(res, { id: clerkUserId, email, role, profile });
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
