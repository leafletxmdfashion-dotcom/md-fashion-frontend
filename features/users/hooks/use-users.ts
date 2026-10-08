"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { usersApi, usersKeys } from "../api/users.api";

export function useUsers() {
  return useQuery({ queryKey: usersKeys.list(), queryFn: usersApi.list });
}

export function useRoles() {
  return useQuery({ queryKey: usersKeys.roles(), queryFn: usersApi.roles, staleTime: 5 * 60_000 });
}

/** Every admin mutation refreshes the member list afterwards. */
function useUsersMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: usersKeys.list() }),
  });
}

export const useInviteUser = () => useUsersMutation(usersApi.invite);
export const useResendInvitation = () => useUsersMutation(usersApi.resendInvitation);
export const useRevokeInvitation = () => useUsersMutation(usersApi.revokeInvitation);
export const useChangeRole = () => useUsersMutation(usersApi.changeRole);
export const useDisableUser = () => useUsersMutation(usersApi.disable);
export const useEnableUser = () => useUsersMutation(usersApi.enable);
export const useRevokeUserSessions = () => useUsersMutation(usersApi.revokeSessions);
