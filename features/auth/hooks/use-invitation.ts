"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { authApi } from "../api/auth.api";

export function useInvitation(token: string | null) {
  return useQuery({
    queryKey: ["auth", "invitation", token],
    queryFn: () => authApi.inspectInvitation(token!),
    enabled: Boolean(token),
    retry: false,
    // Keep the token out of the persistent cache once the page is left.
    gcTime: 0,
  });
}

export function useAcceptInvitation() {
  return useMutation({ mutationFn: authApi.acceptInvitation });
}
