"use client";

import { useQuery } from "@tanstack/react-query";

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
  });
}
