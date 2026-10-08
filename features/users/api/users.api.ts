import { api, unwrap, type ApiSuccess } from "@/lib/api-client";

import type { IssuedInvitation, ManagedUser, Role } from "../types/user.types";

export const usersKeys = {
  all: ["users"] as const,
  list: () => [...usersKeys.all, "list"] as const,
  roles: () => ["roles"] as const,
};

export const usersApi = {
  async list(): Promise<ManagedUser[]> {
    return (await unwrap(api.get<ApiSuccess<{ users: ManagedUser[] }>>("/users"))).users;
  },

  async roles(): Promise<Role[]> {
    return (await unwrap(api.get<ApiSuccess<{ roles: Role[] }>>("/roles"))).roles;
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
