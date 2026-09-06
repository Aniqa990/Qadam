/** Envelope for list endpoints: api-contracts.md "Success (list)". */
export interface ApiListResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * Thin fetch wrapper for talking to the Express backend. `token` is a
 * Clerk session token from useAuth().getToken() - components should go
 * through the useApi() hook (hooks/useApi.ts) rather than calling this
 * directly, so auth/business logic never leaks into components (AGENTS.md).
 */
const API_BASE_URL = "/api";

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { token?: string | null }
): Promise<T> {
  const { token, ...rest } = init ?? {};
  const isFormData = rest.body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
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

/**
 * Same as apiFetch, but preserves the `pagination` envelope field that list
 * endpoints return alongside `data` (api-contracts.md "Success (list)").
 */
export async function apiFetchList<T>(
  path: string,
  init?: RequestInit & { token?: string | null }
): Promise<ApiListResponse<T>> {
  const { token, ...rest } = init ?? {};
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
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
  return {
    data: (body.data ?? []) as T[],
    pagination: body.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 },
  };
}

/**
 * Fetch a binary response (e.g. on-demand certificate PDF). Errors still
 * arrive as the JSON envelope; success returns the raw Blob plus optional
 * filename from Content-Disposition.
 */
export async function apiFetchBlob(
  path: string,
  init?: RequestInit & { token?: string | null }
): Promise<{ blob: Blob; filename: string | null }> {
  const { token, ...rest } = init ?? {};
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
    },
  });

  const contentType = res.headers.get("Content-Type") ?? "";
  if (!res.ok || contentType.includes("application/json")) {
    let message = `Request to ${path} failed`;
    let code: string | undefined;
    try {
      const body = await res.json();
      message = body?.error?.message ?? message;
      code = body?.error?.code;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    const error = new Error(message) as Error & { code?: string };
    error.code = code;
    throw error;
  }

  const disposition = res.headers.get("Content-Disposition");
  const filenameMatch = disposition?.match(/filename="([^"]+)"/i);
  return {
    blob: await res.blob(),
    filename: filenameMatch?.[1] ?? null,
  };
}
