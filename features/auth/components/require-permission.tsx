"use client";

import { ShieldOff } from "lucide-react";

import { Page } from "@/components/page-header";

import { useCurrentUser } from "../hooks/use-current-user";
import { hasPermission } from "../lib/permissions";
import type { Permission } from "../types/auth.types";

function Denied() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-card px-4 py-20 text-center">
      <span className="mb-1 flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <ShieldOff className="size-5" aria-hidden />
      </span>
      <h2 className="text-[15px] font-semibold">You don&apos;t have access to this page</h2>
      <p className="max-w-xs text-[13px] text-muted-foreground">
        Your role does not include it. Ask an administrator if you need access.
      </p>
    </div>
  );
}

/**
 * Hides a page's UI from users without the permission (the API still enforces it).
 * With `title`, the denial keeps the normal page frame around it.
 */
export function RequirePermission({
  permission,
  title,
  children,
}: {
  permission: Permission;
  title?: string;
  children: React.ReactNode;
}) {
  const { data: user } = useCurrentUser();
  if (hasPermission(user, permission)) return <>{children}</>;
  return title ? (
    <Page title={title}>
      <Denied />
    </Page>
  ) : (
    <Denied />
  );
}
