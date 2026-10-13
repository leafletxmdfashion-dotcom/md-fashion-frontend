"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authKeys } from "@/features/auth/api/auth.keys";
import { onSessionMessage, signOut } from "@/features/auth/lib/sign-out";
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
    const signedIn = () => Boolean(queryClient.getQueryData(authKeys.me()));
    // Any API 401 while signed in means the session ended (expired, revoked, user
    // disabled): sign out once. Signed-out pages (login) get 401s by design.
    setUnauthenticatedHandler(() => {
      if (signedIn()) void signOut("expired");
    });
    // Follow the other tabs: their sign-out ends this tab too; their sign-in
    // re-checks the session here (e.g. a login page left open).
    const stopListening = onSessionMessage((message) => {
      if (message === "signed-out" && signedIn()) void signOut("elsewhere");
      if (message === "signed-in") void queryClient.invalidateQueries({ queryKey: authKeys.me() });
    });
    return () => {
      setUnauthenticatedHandler(null);
      stopListening();
    };
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
