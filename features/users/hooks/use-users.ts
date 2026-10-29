"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authKeys } from "@/features/auth/api/auth.keys";

import { usersApi, usersKeys } from "../api/users.api";

export function useUsers(enabled = true) {
  return useQuery({ queryKey: usersKeys.list(), queryFn: usersApi.list, enabled });
}

export function useRoleCatalog(enabled = true) {
  return useQuery({ queryKey: usersKeys.roles(), queryFn: usersApi.roles, staleTime: 5 * 60_000, enabled });
}

export function useRoles(enabled = true) {
  return useQuery({
    queryKey: usersKeys.roles(),
    queryFn: usersApi.roles,
    staleTime: 5 * 60_000,
    enabled,
    select: (data) => data.roles,
  });
}

/** Role changes refresh roles, users (their role names) and the signed-in user's own rights. */
function useRoleMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: usersKeys.roles() }),
        queryClient.invalidateQueries({ queryKey: usersKeys.list() }),
        queryClient.invalidateQueries({ queryKey: authKeys.me() }),
      ]),
  });
}

export const useCreateRole = () => useRoleMutation(usersApi.createRole);
export const useUpdateRole = () => useRoleMutation(usersApi.updateRole);
export const useDeleteRole = () => useRoleMutation(usersApi.deleteRole);

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
