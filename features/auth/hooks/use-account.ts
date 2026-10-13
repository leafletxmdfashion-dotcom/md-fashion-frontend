"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authApi } from "../api/auth.api";
import { authKeys } from "../api/auth.keys";
import { signOut } from "../lib/sign-out";

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (user) => queryClient.setQueryData(authKeys.me(), user),
  });
}

export function useSessions() {
  return useQuery({ queryKey: authKeys.sessions(), queryFn: authApi.listSessions });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: ({ current }) => {
      if (current) {
        void signOut("signed-out");
        return;
      }
      void queryClient.invalidateQueries({ queryKey: authKeys.sessions() });
    },
  });
}
