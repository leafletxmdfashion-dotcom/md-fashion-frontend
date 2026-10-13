"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authApi } from "../api/auth.api";
import { authKeys } from "../api/auth.keys";
import { announceSession } from "../lib/sign-out";

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (user) => {
      // Drop anything cached under a previous identity before seeding the new user.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== authKeys.all[0] });
      queryClient.setQueryData(authKeys.me(), user);
      announceSession("signed-in");
    },
  });
}
