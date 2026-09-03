/**
 * Role lives in Clerk's publicMetadata, never trusted from the client
 * (AGENTS.md "Clerk Auth Migration"). This union is the single source of
 * truth for it across the backend.
 */
export type AppRole = "volunteer" | "ngo";

/** Populated by auth.middleware.ts once the Clerk session token is verified. */
export interface AuthContext {
  clerkUserId: string;
}

/**
 * Populated by resolveUser.middleware.ts. `profile` is the full row from
 * `volunteers` or `ngos` (shape depends on `role`) - see database-schema.md.
 * `domainId` is the profile's own UUID, used for ownership checks
 * (e.g. "does this NGO own this project") in later phases.
 */
export interface RequestIdentity {
  clerkUserId: string;
  role: AppRole;
  email: string;
  profile: Record<string, unknown>;
  domainId: string;
}
