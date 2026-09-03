import { useAuth as useClerkAuth, useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useApi } from "./useApi";
import type { AuthMe } from "@/types/auth";

/**
 * Combines Clerk's session state with the backend's role/profile
 * resolution (GET /api/auth/me - api-contracts.md). This is the single
 * source of truth route guards (routes/ProtectedLayout.tsx etc.) read from
 * - components should never read Clerk's publicMetadata directly, since
 * role is only trustworthy once it's round-tripped through the backend.
 */
export function useAuth() {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { user } = useUser();
  const { api } = useApi();

  const [me, setMe] = useState<AuthMe | null>(null);
  const [isResolving, setIsResolving] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setMe(null);
      setIsResolving(false);
      return;
    }

    let cancelled = false;
    setIsResolving(true);
    api<AuthMe>("/auth/me")
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsResolving(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, user?.id]);

  return {
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    isResolving,
    role: me?.role ?? null,
    onboardingComplete: me?.profile.onboarding_complete ?? false,
    profile: me?.profile ?? null,
    error,
  };
}
