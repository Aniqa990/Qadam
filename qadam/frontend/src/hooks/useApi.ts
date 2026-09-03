import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useCallback } from "react";
import { apiFetch, apiFetchList, type ApiListResponse } from "@/lib/api";

/**
 * Returns fetchers pre-bound to the current Clerk session token, so
 * components never have to know or care how auth headers get attached.
 * `api` unwraps the response `data` field; `apiList` also keeps the
 * `pagination` envelope (api-contracts.md "Success (list)").
 * Usage:
 *   const { api, apiList } = useApi();
 *   await api<Profile>("/volunteers/profile")
 *   await apiList<Project>("/projects?page=1")
 */
export function useApi() {
  const { getToken } = useClerkAuth();

  const api = useCallback(
    async <T>(path: string, init?: RequestInit) => {
      const token = await getToken();
      return apiFetch<T>(path, { ...init, token });
    },
    [getToken]
  );

  const apiList = useCallback(
    async <T>(path: string, init?: RequestInit): Promise<ApiListResponse<T>> => {
      const token = await getToken();
      return apiFetchList<T>(path, { ...init, token });
    },
    [getToken]
  );

  return { api, apiList };
}
