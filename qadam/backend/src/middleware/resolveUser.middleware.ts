import type { NextFunction, Request, Response } from "express";
import { clerkClient } from "../lib/clerk";
import { findProfileByRole } from "../services/auth.service";
import { AuthenticationError } from "../utils/errors";
import type { AppRole } from "../types/auth.types";

/**
 * Second step of the auth pipeline - runs after authMiddleware. Resolves
 * the Clerk user to its volunteer/ngo row and attaches role + profile +
 * domainId to req.identity. Role is read from Clerk's publicMetadata
 * (server-only, set by the user.created webhook) - never from anything
 * client-supplied. Route handlers/authorization checks in later phases
 * read req.identity.role / req.identity.domainId, never req.body.
 */
export async function resolveUserMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.auth) {
      throw new AuthenticationError();
    }

    const clerkUser = await clerkClient.users.getUser(req.auth.clerkUserId);
    const role = clerkUser.publicMetadata?.role as AppRole | undefined;
    if (role !== "volunteer" && role !== "ngo") {
      throw new AuthenticationError("Account role has not been established yet");
    }

    const profile = await findProfileByRole(role, req.auth.clerkUserId);
    const primaryEmail =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      "";

    req.identity = {
      clerkUserId: req.auth.clerkUserId,
      role,
      email: primaryEmail,
      profile,
      domainId: profile.id as string,
    };
    next();
  } catch (err) {
    next(err);
  }
}
