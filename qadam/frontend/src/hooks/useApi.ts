import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useCallback } from "react";
import { apiFetch } from "@/lib/api";

/**
 * Returns a fetcher pre-bound to the current Clerk session token, so
 * components never have to know or care how auth headers get attached.
 * Usage: const api = useApi(); await api<Profile>("/volunteers/profile")
 */
export function useApi() {
  const { getToken } = useClerkAuth();

  return useCallback(
    async <T>(path: string, init?: RequestInit) => {
      const token = await getToken();
      return apiFetch<T>(path, { ...init, token });
    },
    [getToken]
  );
}
