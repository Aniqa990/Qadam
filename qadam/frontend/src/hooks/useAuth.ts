import { useAuth as useClerkAuth, useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useApi } from "./useApi";
import type { AppRole, AuthMe } from "@/types/auth";

const ROLE_RETRY_ATTEMPTS = 8;
const ROLE_RETRY_BASE_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Combines Clerk's session state with the backend's role/profile
 * resolution (GET /api/auth/me). This is the single source of truth route
 * guards read from - components should never read Clerk's publicMetadata
 * directly. Newly signed-up users may briefly return status
 * "pending_role" while the webhook/reconcile finishes; we retry with
 * backoff before surfacing that as a selectable role step.
 */
export function useAuth() {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { user } = useUser();
  const { api } = useApi();

  const [me, setMe] = useState<AuthMe | null>(null);
  const [isResolving, setIsResolving] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setMe(null);
      setError(null);
      setIsResolving(false);
      return;
    }

    let cancelled = false;
    setIsResolving(true);
    setError(null);

    (async () => {
      try {
        let last: AuthMe | null = null;
        for (let attempt = 0; attempt < ROLE_RETRY_ATTEMPTS; attempt++) {
          last = await api<AuthMe>("/auth/me");
          if (cancelled) return;
          if (last.status === "ready" && last.role) {
            setMe(last);
            return;
          }
          // Webhook / reconcile may still be in flight.
          await sleep(ROLE_RETRY_BASE_MS * Math.min(attempt + 1, 4));
          if (cancelled) return;
        }
        setMe(last);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load account");
          setMe(null);
        }
      } finally {
        if (!cancelled) setIsResolving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, user?.id, reloadKey]);

  async function establishRole(role: AppRole) {
    setIsResolving(true);
    setError(null);
    try {
      const data = await api<AuthMe>("/auth/establish-role", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      setMe(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to establish role");
      throw err;
    } finally {
      setIsResolving(false);
    }
  }

  function refresh() {
    setReloadKey((k) => k + 1);
  }

  return {
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    isResolving,
    role: me?.role ?? null,
    status: me?.status ?? null,
    onboardingComplete: me?.profile?.onboarding_complete ?? false,
    profile: me?.profile ?? null,
    error,
    establishRole,
    refresh,
  };
}
