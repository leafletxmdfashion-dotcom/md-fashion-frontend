"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { authApi } from "../api/auth.api";
import { authKeys } from "../api/auth.keys";

function useSignedOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return () => {
    queryClient.setQueryData(authKeys.me(), null);
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== authKeys.all[0] });
    router.replace("/login");
  };
}

export function useLogout() {
  const signedOut = useSignedOut();
  // Even if the request fails (e.g. session already expired) the user ends up signed out locally.
  return useMutation({ mutationFn: authApi.logout, onSettled: signedOut });
}

export function useLogoutAll() {
  const signedOut = useSignedOut();
  return useMutation({ mutationFn: authApi.logoutAll, onSuccess: signedOut });
}
