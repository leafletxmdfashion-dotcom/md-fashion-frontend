"use client";

import { formatDistanceToNow } from "date-fns";
import { Laptop, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          <div className="grid gap-2 p-3">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : sessions.isError ? (
          <p className="p-4 text-[13px] text-muted-foreground">Could not load sessions.</p>
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
