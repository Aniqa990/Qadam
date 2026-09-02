import { env } from "./env";

/**
 * Central place for Clerk-related config values. The actual verifyToken /
 * webhook client instances live in lib/clerk.ts (Phase 2) - this file just
 * exposes typed config so nothing reaches into process.env directly.
 */
export const clerkConfig = {
  publishableKey: env.CLERK_PUBLISHABLE_KEY,
  secretKey: env.CLERK_SECRET_KEY,
  webhookSecret: env.CLERK_WEBHOOK_SECRET,
};
