"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppShellSkeleton } from "@/components/app-shell-skeleton";
import { Button } from "@/components/ui/button";
import { loginPathFor } from "@/lib/safe-redirect";

import { useCurrentUser } from "../hooks/use-current-user";

function FullPageStatus({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-svh items-center justify-center bg-background p-6">{children}</div>;
}

/**
 * Renders protected UI only after /auth/me confirms a session, so protected
 * content never flashes for signed-out visitors. This is UX, not security:
 * the API authorizes every request on its own.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isPending, isError, refetch } = useCurrentUser();

  useEffect(() => {
    if (!isPending && !isError && !user) {
      router.replace(loginPathFor(window.location.pathname + window.location.search));
    }
  }, [isPending, isError, user, router]);

  if (user) return <>{children}</>;

  if (isError) {
    return (
      <FullPageStatus>
        <div className="grid max-w-sm gap-3 text-center">
          <p className="text-sm font-medium">We could not verify your session.</p>
          <p className="text-[13px] text-muted-foreground">Check your connection and try again.</p>
          <Button variant="outline" size="sm" className="mx-auto" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      </FullPageStatus>
    );
  }

  if (isPending) return <AppShellSkeleton />;

  return (
    <FullPageStatus>
      <div role="status" className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Redirecting to log in…
      </div>
    </FullPageStatus>
  );
}
