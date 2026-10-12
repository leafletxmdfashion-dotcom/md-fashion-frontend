"use client";

import { formatDistanceToNow } from "date-fns";
import { Laptop, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-client";

import { useRevokeSession, useSessions } from "../hooks/use-account";
import { useLogoutAll } from "../hooks/use-logout";
import { describeUserAgent } from "../lib/user-agent";

export function SessionsList() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const logoutAll = useLogoutAll();

  const onRevoke = (sessionId: string) =>
    revoke.mutate(sessionId, {
      onSuccess: () => toast.success("Session revoked."),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not revoke session."),
    });

  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-lg border">
        {sessions.isPending ? (
          <ul className="divide-y" aria-hidden>
            {Array.from({ length: 2 }, (_, index) => (
              <li key={index} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="size-4 shrink-0" />
                <div className="grid flex-1 gap-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56 max-w-full opacity-70" />
                </div>
                <Skeleton className="h-6 w-14" />
              </li>
            ))}
          </ul>
        ) : sessions.isError ? (
          <ErrorState title="Could not load sessions" error={sessions.error} onRetry={() => void sessions.refetch()} />
        ) : (
          <ul className="divide-y">
            {sessions.data.map((session) => (
              <li key={session.id} className="flex items-center gap-3 px-3 py-2.5">
                <Laptop className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    <span className="truncate">{describeUserAgent(session.userAgent)}</span>
                    {session.current ? <Badge variant="secondary">This device</Badge> : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {session.ipAddress ?? "Unknown IP"} · Active{" "}
                    {formatDistanceToNow(new Date(session.lastSeenAt), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={revoke.isPending && revoke.variables === session.id}
                  onClick={() => onRevoke(session.id)}
                >
                  {session.current ? "Sign out" : "Revoke"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 px-3 py-3">
        <div>
          <p className="text-[13px] font-medium">Sign out of all devices</p>
          <p className="text-xs text-muted-foreground">Ends every session, including this one.</p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={logoutAll.isPending}
          onClick={() =>
            logoutAll.mutate(undefined, {
              onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not sign out."),
            })
          }
        >
          {logoutAll.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Sign out everywhere
        </Button>
      </div>
    </div>
  );
}
