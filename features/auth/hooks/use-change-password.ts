"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authApi } from "../api/auth.api";
import { authKeys } from "../api/auth.keys";

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: (user) => {
      // The API rotated this browser's session and revoked all others.
      queryClient.setQueryData(authKeys.me(), user);
      void queryClient.invalidateQueries({ queryKey: authKeys.sessions() });
    },
  });
}
