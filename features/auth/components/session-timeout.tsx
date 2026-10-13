"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { lastServerActivity } from "@/lib/api-client";

import { authKeys } from "../api/auth.keys";
import { signOut } from "../lib/sign-out";
import type { CurrentUser } from "../types/auth.types";

// The server refreshes a session's idle clock at most once a minute, so act a
// minute early rather than let the next click hit an already-dead session.
const IDLE_MARGIN_MS = 60_000;
// Warn this long before an inactivity sign-out, and before the absolute expiry.
const WARNING_MS = 2 * 60_000;

function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Mirrors the server's session limits so the user is warned and signed out at the
 * right moment instead of discovering a dead session on their next click:
 * - inactivity (no API request in any tab for the idle timeout): a warning with
 *   "Stay signed in" two minutes before, then sign-out;
 * - absolute expiry (cannot be extended): a heads-up toast, then sign-out.
 */
export function SessionTimeout({ session }: { session: CurrentUser["session"] }) {
  const queryClient = useQueryClient();
  const [idleLeft, setIdleLeft] = useState<number | null>(null);
  const [extending, setExtending] = useState(false);
  const expiryWarned = useRef(false);

  useEffect(() => {
    const expiresAt = Date.parse(session.expiresAt);
    const idleMs = session.idleTimeoutMinutes * 60_000 - IDLE_MARGIN_MS;
    const check = () => {
      const now = Date.now();
      if (now >= expiresAt) {
        void signOut("expired");
        return;
      }
      if (!expiryWarned.current && expiresAt - now <= WARNING_MS) {
        expiryWarned.current = true;
        toast.warning("Your session ends in 2 minutes. Save your work; you will need to log in again.");
      }
      const left = lastServerActivity() + idleMs - now;
      if (left <= 0) void signOut("idle", { revoke: true });
      else setIdleLeft(left <= WARNING_MS ? left : null);
    };
    check();
    // Background tabs throttle timers, so also check the moment the tab is visible again.
    const timer = window.setInterval(check, 1_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [session.expiresAt, session.idleTimeoutMinutes]);

  // Any authenticated request resets the server's idle clock; /auth/me is the cheapest.
  const staySignedIn = async () => {
    setExtending(true);
    try {
      await queryClient.refetchQueries({ queryKey: authKeys.me() });
    } finally {
      setExtending(false);
    }
  };

  return (
    <Dialog open={idleLeft !== null}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Are you still there?</DialogTitle>
          <DialogDescription>
            For security, you will be logged out in{" "}
            <span className="font-medium text-foreground tabular-nums">{formatCountdown(idleLeft ?? 0)}</span> because
            of inactivity.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => void signOut("signed-out", { revoke: true })}>
            Log out
          </Button>
          <Button onClick={() => void staySignedIn()} disabled={extending} autoFocus>
            Stay signed in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
