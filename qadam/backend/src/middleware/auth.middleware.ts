import { verifyToken } from "@clerk/backend";
import type { NextFunction, Request, Response } from "express";
import { clerkConfig } from "../config/clerk";
import { AuthenticationError } from "../utils/errors";

/**
 * First step of the auth pipeline (architecture.md "Request Lifecycle" /
 * implementation-plan.md Phase 2): verifies the Clerk session token and
 * attaches { clerkUserId } to req.auth. Does NOT resolve role/profile -
 * that's resolveUser.middleware.ts's job, so routes that only need "is this
 * a real logged-in user" (e.g. the future POST /api/knowledge upload) can
 * use this alone.
 */
export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AuthenticationError("Missing or malformed Authorization header");
    }
    const token = header.slice("Bearer ".length);

    const verified = await verifyToken(token, { secretKey: clerkConfig.secretKey });
    req.auth = { clerkUserId: verified.sub };
    next();
  } catch (err) {
    next(err instanceof AuthenticationError ? err : new AuthenticationError("Invalid or expired session token"));
  }
}
