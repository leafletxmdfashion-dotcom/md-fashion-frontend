"use client";

import { Loader2, RefreshCw, ServerCrash } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShellSkeleton } from "@/components/app-shell-skeleton";
import { Button } from "@/components/ui/button";

import { useCurrentUser } from "../hooks/use-current-user";
import { signOut } from "../lib/sign-out";
import { SessionTimeout } from "./session-timeout";

function FullPageStatus({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-svh items-center justify-center bg-background p-6">{children}</div>;
}

// Back-off between automatic re-checks while the server cannot be reached.
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 30_000];

/** Shown when the session cannot be checked at all: the server is down, not the session. */
function ServerUnavailable({ retry, retrying }: { retry: () => void; retrying: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (retrying) return;
    const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]!;
    const due = Date.now() + delay;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((due - Date.now()) / 1000)));
    const first = window.setTimeout(tick, 0);
    const countdown = window.setInterval(tick, 1000);
    const timer = window.setTimeout(() => {
      setAttempt((value) => value + 1);
      retry();
    }, delay);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(countdown);
      window.clearTimeout(timer);
    };
  }, [attempt, retry, retrying]);

  return (
    <FullPageStatus>
      <div className="grid max-w-sm justify-items-center gap-3 text-center">
        <ServerCrash className="size-8 text-muted-foreground" aria-hidden />
        <h1 className="text-base font-semibold">Can&apos;t reach the server</h1>
        <p role="status" className="text-[13px] leading-5 text-muted-foreground">
          You are still signed in. We&apos;ll keep trying to reconnect
          {retrying ? "…" : ` (next attempt in ${secondsLeft}s).`}
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={retry} disabled={retrying}>
            {retrying ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
            Try again
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void signOut("signed-out")}>
            Log out
          </Button>
        </div>
      </div>
    </FullPageStatus>
  );
}

/**
 * Renders protected UI only after /auth/me confirms a session, so protected
 * content never flashes for signed-out visitors. This is UX, not security:
 * the API authorizes every request on its own.
 *
 * Only a session problem signs the user out: /auth/me answering "no session"
 * (expired, revoked, disabled), any API 401 (see app/providers.tsx), or the
 * session's own expiry and idle limits (SessionTimeout). A server or network
 * failure never does: a signed-in user keeps working with cached data, and a
 * first load that cannot reach the server shows a reconnecting screen.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isPending, isError, isFetching, refetch } = useCurrentUser();
  const sessionEnded = !isPending && !isError && !user;

  useEffect(() => {
    if (sessionEnded) void signOut("expired");
  }, [sessionEnded]);

  if (user) {
    return (
      <>
        <SessionTimeout session={user.session} />
        {children}
      </>
    );
  }

  if (isPending) return <AppShellSkeleton />;

  if (isError) return <ServerUnavailable retry={() => void refetch()} retrying={isFetching} />;

  return (
    <FullPageStatus>
      <div role="status" className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Redirecting to log in…
      </div>
    </FullPageStatus>
  );
}
