import { api, unwrap, type ApiSuccess } from "@/lib/api-client";

import type { Permission } from "@/features/auth/types/auth.types";

import type { IssuedInvitation, ManagedUser, PermissionGroup, Role } from "../types/user.types";

export const usersKeys = {
  all: ["users"] as const,
  list: () => [...usersKeys.all, "list"] as const,
  roles: () => ["roles"] as const,
};

export const usersApi = {
  async list(): Promise<ManagedUser[]> {
    return (await unwrap(api.get<ApiSuccess<{ users: ManagedUser[] }>>("/users"))).users;
  },

  async roles(): Promise<{ roles: Role[]; catalog: PermissionGroup[] }> {
    return unwrap(api.get<ApiSuccess<{ roles: Role[]; catalog: PermissionGroup[] }>>("/roles"));
  },

  async createRole(input: { name: string; permissions: Permission[] }): Promise<Role> {
    return (await unwrap(api.post<ApiSuccess<{ role: Role }>>("/roles", input))).role;
  },

  async updateRole({ key, ...input }: { key: string; name?: string; permissions: Permission[] }): Promise<Role> {
    return (await unwrap(api.put<ApiSuccess<{ role: Role }>>(`/roles/${key}`, input))).role;
  },

  async deleteRole(key: string): Promise<void> {
    await api.delete(`/roles/${key}`);
  },

  async invite(input: { email: string; name: string; roleKey: string }): Promise<IssuedInvitation> {
    return (await unwrap(api.post<ApiSuccess<{ invitation: IssuedInvitation }>>("/users/invitations", input)))
      .invitation;
  },

  async resendInvitation(userId: string): Promise<IssuedInvitation> {
    return (
      await unwrap(api.post<ApiSuccess<{ invitation: IssuedInvitation }>>(`/users/${userId}/invitation/resend`))
    ).invitation;
  },

  async revokeInvitation(userId: string): Promise<void> {
    await api.post(`/users/${userId}/invitation/revoke`);
  },

  async changeRole(input: { userId: string; roleKey: string }): Promise<void> {
    await api.put(`/users/${input.userId}/role`, { roleKey: input.roleKey });
  },

  async disable(userId: string): Promise<void> {
    await api.post(`/users/${userId}/disable`);
  },

  async enable(userId: string): Promise<void> {
    await api.post(`/users/${userId}/enable`);
  },

  async revokeSessions(userId: string): Promise<void> {
    await api.post(`/users/${userId}/sessions/revoke`);
  },
};
