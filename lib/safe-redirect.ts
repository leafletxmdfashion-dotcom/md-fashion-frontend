export const DEFAULT_AUTHENTICATED_PATH = "/dashboard";

const AUTH_PAGES = ["/login", "/forgot-password", "/reset-password", "/accept-invitation"];

/**
 * Accepts only same-origin relative paths, so `?next=` cannot become an open
 * redirect (rejects absolute URLs, protocol-relative `//host`, `/\host`, schemes).
 */
export function getSafeRedirect(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_AUTHENTICATED_PATH;
  }
  try {
    const base = "http://internal.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return DEFAULT_AUTHENTICATED_PATH;
    if (AUTH_PAGES.some((page) => url.pathname === page || url.pathname.startsWith(`${page}/`))) {
      return DEFAULT_AUTHENTICATED_PATH;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTHENTICATED_PATH;
  }
}

/** Login URL that returns to `currentPath` afterwards, optionally explaining why (`reason`). */
export function loginPathFor(currentPath: string, reason?: string): string {
  const params = new URLSearchParams();
  const next = getSafeRedirect(currentPath);
  if (next !== DEFAULT_AUTHENTICATED_PATH) params.set("next", next);
  if (reason) params.set("reason", reason);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}
