"use client";

import { ShieldOff } from "lucide-react";

import { useCurrentUser } from "../hooks/use-current-user";
import { hasPermission } from "../lib/permissions";
import type { Permission } from "../types/auth.types";

/** Hides a page's UI from users without the permission. The API still enforces it. */
export function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { data: user } = useCurrentUser();
  if (hasPermission(user, permission)) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      <ShieldOff className="size-5 text-muted-foreground" aria-hidden />
      <h2 className="text-sm font-medium">You don&apos;t have access to this page</h2>
      <p className="max-w-xs text-[13px] text-muted-foreground">Ask an administrator if you need access.</p>
    </div>
  );
}
