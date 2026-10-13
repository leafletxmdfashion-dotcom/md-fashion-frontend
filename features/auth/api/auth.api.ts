import { api, ApiError, unwrap } from "@/lib/api-client";

import type { CurrentUser, InvitationDetails, SessionSummary } from "../types/auth.types";

export const authApi = {
  /** Resolves to null when signed out: an expected state, not an error. */
  async getCurrentUser(): Promise<CurrentUser | null> {
    try {
      // Short timeout: the whole app waits on this, and a failure signs the user out.
      return (await unwrap(api.get<{ success: true; data: { user: CurrentUser } }>("/auth/me", { timeout: 6_000 })))
        .user;
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_UNAUTHENTICATED") return null;
      throw error;
    }
  },

  async login(input: { email: string; password: string }): Promise<CurrentUser> {
    return (await unwrap(api.post<{ success: true; data: { user: CurrentUser } }>("/auth/login", input))).user;
  },

  async logout(): Promise<void> {
    await api.post("/auth/logout");
  },

  async logoutAll(): Promise<void> {
    await api.post("/auth/logout-all");
  },

  async updateProfile(input: { name: string }): Promise<CurrentUser> {
    return (await unwrap(api.patch<{ success: true; data: { user: CurrentUser } }>("/auth/me", input))).user;
  },

  async changePassword(input: { currentPassword: string; newPassword: string }): Promise<CurrentUser> {
    return (
      await unwrap(api.post<{ success: true; data: { user: CurrentUser } }>("/auth/change-password", input))
    ).user;
  },

  async forgotPassword(input: { email: string }): Promise<string> {
    return (await unwrap(api.post<{ success: true; data: { message: string } }>("/auth/forgot-password", input)))
      .message;
  },

  async resetPassword(input: { token: string; newPassword: string }): Promise<void> {
    await api.post("/auth/reset-password", input);
  },

  async inspectInvitation(token: string): Promise<InvitationDetails> {
    return (
      await unwrap(
        api.post<{ success: true; data: { invitation: InvitationDetails } }>("/auth/invitations/inspect", { token }),
      )
    ).invitation;
  },

  async acceptInvitation(input: { token: string; name: string; newPassword: string }): Promise<void> {
    await api.post("/auth/invitations/accept", input);
  },

  async listSessions(): Promise<SessionSummary[]> {
    return (await unwrap(api.get<{ success: true; data: { sessions: SessionSummary[] } }>("/auth/sessions")))
      .sessions;
  },

  async revokeSession(sessionId: string): Promise<{ current: boolean }> {
    return unwrap(api.delete<{ success: true; data: { current: boolean } }>(`/auth/sessions/${sessionId}`));
  },
};
