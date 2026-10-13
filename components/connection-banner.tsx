"use client";

import { onlineManager } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

/**
 * A connection drop is not a sign-out. React Query pauses requests while the
 * browser is offline and resumes them when it is back; this tells the user why
 * nothing is loading meanwhile.
 */
export function ConnectionBanner() {
  const online = useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b bg-warning-soft px-4 py-1.5 text-[13px] text-foreground"
    >
      <WifiOff className="size-3.5 text-warning" aria-hidden />
      You&apos;re offline. Changes will load when the connection is back.
    </div>
  );
}
