"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authKeys } from "@/features/auth/api/auth.keys";
import { ApiError, setUnauthenticatedHandler } from "@/lib/api-client";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Client errors (401/403/404/422) will not fix themselves; only retry transient failures.
        retry: (failureCount, error) =>
          failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
      // Never replay mutations automatically (logins, password changes, admin actions).
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    // Any API 401 means the session ended (expired, revoked, user disabled). Flip the
    // cached user to signed-out; AuthGuard then redirects. No retry, so no 401 loops.
    setUnauthenticatedHandler(() => queryClient.setQueryData(authKeys.me(), null));
    return () => setUnauthenticatedHandler(null);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider delay={300}>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
