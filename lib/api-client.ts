import axios, { type InternalAxiosRequestConfig } from "axios";

// Stable codes from the API. UI logic branches on these, never on message text.
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_UNAUTHENTICATED"
  | "AUTH_FORBIDDEN"
  | "AUTH_CURRENT_PASSWORD_INCORRECT"
  | "PASSWORD_TOO_WEAK"
  | "PASSWORD_REUSED"
  | "TOKEN_INVALID"
  | "CSRF_INVALID"
  | "NOT_FOUND"
  | "CONFLICT"
  | "LAST_OWNER"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiErrorBody {
  success: false;
  error: { code: ApiErrorCode; message: string; details?: Record<string, string[]> };
}

const CSRF_HEADER = "x-csrf-token";
const UNSAFE_METHODS = new Set(["post", "put", "patch", "delete"]);

// Same-origin path: Next.js rewrites /api/v1/* to the Express API, so the
// HttpOnly session cookie is first-party and never readable by scripts.
export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// The CSRF token lives in memory only (never localStorage). It is session-bound,
// so the API re-issues it via the X-CSRF-Token response header whenever the
// session changes (login, password change, logout).
let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

function fetchCsrfToken(): Promise<string> {
  csrfRequest ??= api
    .get<ApiSuccess<{ csrfToken: string }>>("/auth/csrf")
    .then((response) => {
      csrfToken = response.data.data.csrfToken;
      return csrfToken;
    })
    .finally(() => {
      csrfRequest = null;
    });
  return csrfRequest;
}

function captureRotatedToken(headers: unknown): void {
  if (typeof headers !== "object" || headers === null) return;
  const value: unknown = (headers as Record<string, unknown>)[CSRF_HEADER];
  if (typeof value === "string" && value) csrfToken = value;
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const body = error.response?.data;
    if (error.response && body && typeof body === "object" && body.error?.code) {
      return new ApiError(error.response.status, body.error.code, body.error.message, body.error.details);
    }
    if (!error.response) {
      return new ApiError(0, "NETWORK_ERROR", "Unable to reach the server. Check your connection and try again.");
    }
    return new ApiError(error.response.status, "UNKNOWN_ERROR", "Something went wrong. Please try again.");
  }
  return new ApiError(0, "UNKNOWN_ERROR", "Something went wrong. Please try again.");
}

// When the API last answered for this session. The server extends the idle window on
// every authenticated request, so this tells the client when the session lapses.
// Shared across tabs (one cookie, one session) through localStorage: a timestamp only.
const ACTIVITY_KEY = "md-session-activity";
let lastActivity = Date.now();
let lastShared = 0;

function markServerActivity(): void {
  lastActivity = Date.now();
  if (lastActivity - lastShared < 15_000) return;
  lastShared = lastActivity;
  try {
    localStorage.setItem(ACTIVITY_KEY, String(lastActivity));
  } catch {
    // Storage blocked (private mode): this tab's own clock still works.
  }
}

/** Latest API activity in any tab, as epoch milliseconds. */
export function lastServerActivity(): number {
  let shared = 0;
  try {
    shared = Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
  } catch {
    // Storage blocked: fall back to this tab.
  }
  return Math.max(lastActivity, shared);
}

let unauthenticatedHandler: (() => void) | null = null;

/** Registered once by the app providers; invoked when the API reports the session is gone. */
export function setUnauthenticatedHandler(handler: (() => void) | null): void {
  unauthenticatedHandler = handler;
}

api.interceptors.request.use(async (config) => {
  if (config.method && UNSAFE_METHODS.has(config.method.toLowerCase())) {
    config.headers.set(CSRF_HEADER, csrfToken ?? (await fetchCsrfToken()));
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    captureRotatedToken(response.headers);
    markServerActivity();
    return response;
  },
  async (error: unknown) => {
    // A request cancelled on purpose (superseded search, unmounted view) is not a failure.
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error)) captureRotatedToken(error.response?.headers);
    const apiError = toApiError(error);
    if (apiError.status !== 0 && apiError.status !== 401) markServerActivity();
    const config = axios.isAxiosError(error)
      ? (error.config as (InternalAxiosRequestConfig & { _csrfRetried?: boolean }) | undefined)
      : undefined;

    // A stale token (session expired or rotated in another tab) is rejected before the
    // server does any work, so one replay with a fresh token is safe. Never more than once.
    if (apiError.code === "CSRF_INVALID" && config && !config._csrfRetried) {
      config._csrfRetried = true;
      csrfToken = null;
      config.headers.set(CSRF_HEADER, await fetchCsrfToken());
      return api.request(config);
    }

    if (apiError.code === "AUTH_UNAUTHENTICATED") unauthenticatedHandler?.();
    throw apiError;
  },
);

export async function unwrap<T>(request: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return (await request).data.data;
}
