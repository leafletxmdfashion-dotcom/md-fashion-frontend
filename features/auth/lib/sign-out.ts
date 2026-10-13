import { authApi } from "../api/auth.api";
import { loginPathFor } from "@/lib/safe-redirect";

/** Why the user landed on the login page; the login form explains it. */
export type SignOutReason = "signed-out" | "expired" | "idle" | "elsewhere";

type SessionMessage = "signed-in" | "signed-out";

// Tabs of the same browser share one session cookie, so a sign-in or sign-out in
// one tab is announced to the others.
let channel: BroadcastChannel | null | undefined;
function sessionChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel("md-session") : null;
  }
  return channel;
}

export function announceSession(message: SessionMessage): void {
  sessionChannel()?.postMessage(message);
}

export function onSessionMessage(listener: (message: SessionMessage) => void): () => void {
  const target = sessionChannel();
  if (!target) return () => {};
  const handle = (event: MessageEvent) => {
    if (event.data === "signed-in" || event.data === "signed-out") listener(event.data);
  };
  target.addEventListener("message", handle);
  return () => target.removeEventListener("message", handle);
}

/** Clears the session cookie without the API (it may be down); see app/session/end/route.ts. */
async function clearSessionCookie(): Promise<void> {
  await fetch("/session/end", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
}

let signingOut = false;

/**
 * The single way out of the app: ends the session (server first when asked, the
 * local cookie always), tells other tabs, and reloads into /login so no cached
 * data, CSRF token or timer survives. Concurrent callers (a burst of 401s) collapse
 * into one.
 */
export async function signOut(reason: SignOutReason, { revoke = false }: { revoke?: boolean } = {}): Promise<void> {
  if (signingOut) return;
  signingOut = true;
  const revoked = revoke && (await authApi.logout().then(() => true, () => false));
  if (!revoked) await clearSessionCookie();
  if (reason !== "elsewhere") announceSession("signed-out");
  // A deliberate sign-out starts fresh; an interrupted session returns to where it was.
  const here = reason === "signed-out" ? "" : window.location.pathname + window.location.search;
  window.location.replace(loginPathFor(here, reason));
}
