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

export function loginPathFor(currentPath: string): string {
  const next = getSafeRedirect(currentPath);
  return next === DEFAULT_AUTHENTICATED_PATH ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}
