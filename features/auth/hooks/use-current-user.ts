"use client";

import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-client";

import { authApi } from "../api/auth.api";
import { authKeys } from "../api/auth.keys";

/**
 * TanStack Query owns authentication state. `data === null` means signed out;
 * refetching on focus picks up server-side revocation (logout elsewhere, disable).
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: authApi.getCurrentUser,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    // One quick retry for a dropped connection. A server error surfaces at once: AuthGuard
    // then shows a reconnecting screen (first load) or keeps the cached user (mid-use).
    retry: (failureCount, error) => failureCount < 1 && error instanceof ApiError && error.code === "NETWORK_ERROR",
    retryDelay: 500,
  });
}
