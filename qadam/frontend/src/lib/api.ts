/**
 * Thin fetch wrapper for talking to the Express backend. Auth headers get
 * attached here once Clerk's useAuth().getToken() is wired in (Phase 2) -
 * components should call these helpers instead of using fetch directly, so
 * business/auth logic never leaks into React components (see AGENTS.md).
 */
const API_BASE_URL = "/api";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body = await res.json();
  if (!res.ok || body.success === false) {
    const error = new Error(body?.error?.message ?? `Request to ${path} failed`) as Error & {
      code?: string;
    };
    error.code = body?.error?.code;
    throw error;
  }
  return body.data as T;
}
