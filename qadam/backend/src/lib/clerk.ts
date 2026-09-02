import { createClerkClient } from "@clerk/backend";
import { clerkConfig } from "../config/clerk";

/**
 * Clerk backend client, used for session verification (Phase 2) and
 * webhook-driven profile creation. Kept as a single shared instance so
 * we are not re-instantiating it per request.
 */
export const clerkClient = createClerkClient({
  secretKey: clerkConfig.secretKey,
  publishableKey: clerkConfig.publishableKey,
});
