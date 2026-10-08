"use client";

import { useMutation } from "@tanstack/react-query";

import { authApi } from "../api/auth.api";

export function useResetPassword() {
  return useMutation({ mutationFn: authApi.resetPassword });
}
