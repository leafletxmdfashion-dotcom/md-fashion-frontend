"use client";

import { useMutation } from "@tanstack/react-query";

import { authApi } from "../api/auth.api";
import { signOut } from "../lib/sign-out";

export function useLogout() {
  // Even if the request fails (API down, session already gone) the user ends up signed out.
  return useMutation({ mutationFn: authApi.logout, onSettled: () => signOut("signed-out") });
}

export function useLogoutAll() {
  return useMutation({ mutationFn: authApi.logoutAll, onSuccess: () => signOut("signed-out") });
}
