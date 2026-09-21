import type { AuthResponse } from "@/lib/types";

/**
 * Origin of the API. Empty in development, where Vite proxies /api to the server.
 * A value that already includes /api or /api/v1 is normalised, so setting
 * VITE_API_URL=https://example.com/api/v1 doesn't produce /api/v1/api/v1/posts.
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api(\/v1)?$/, "");

export const API_BASE = `${API_URL}/api/v1`;
const BASE = API_BASE;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Field-level messages from a 422, keyed by field name. */
  readonly details: Record<string, string>;

  constructor(status: number, code: string, message: string, details: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface Options {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  retried?: boolean;
}

// Codes that mean "this access token is unusable; try rotating it".
const REFRESHABLE = new Set(["token_expired", "token_revoked", "invalid_token"]);

export const AUTH_EVENTS = { refreshed: "auth:refreshed", ended: "auth:ended" } as const;

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Rotates the refresh token. Concurrent callers share one request — two parallel rotations
 * would look like a replayed token to the server and end the session.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" })
    .then(async (res) => {
      if (res.ok) {
        const data = (await res.json()) as AuthResponse;
        window.dispatchEvent(new CustomEvent(AUTH_EVENTS.refreshed, { detail: data }));
        return true;
      }
      window.dispatchEvent(new Event(AUTH_EVENTS.ended));
      return false;
    })
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

function buildUrl(path: string, query?: Query) {
  const url = `${BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function toApiError(res: Response): Promise<ApiError> {
  let payload: { error?: { code?: string; message?: string; details?: Record<string, string> } } | null = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON body */
  }
  const err = payload?.error;
  return new ApiError(
    res.status,
    err?.code ?? "error",
    err?.message ?? (res.status >= 500 ? "Something went wrong on the server. Try again." : res.statusText),
    err?.details ?? {},
  );
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body, query, signal, retried = false } = options;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      credentials: "include",
      signal,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "network_error", "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 401 && !retried && !path.startsWith("/auth/")) {
    const error = await toApiError(res.clone());
    if (REFRESHABLE.has(error.code)) {
      // Whether or not the refresh works, retry once: on failure the cookies are cleared and
      // public endpoints answer anonymously.
      await refreshSession();
      return api<T>(path, { ...options, retried: true });
    }
    throw error;
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
