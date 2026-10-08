import type { Permission, UserStatus } from "@/features/auth/types/auth.types";

export interface RoleRef {
  key: string;
  name: string;
  rank: number;
}

export interface Role extends RoleRef {
  permissions: Permission[];
  /** Whether the current user may assign this role (UX hint; the API re-checks). */
  assignable: boolean;
}

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  role: RoleRef;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  activeSessionCount: number;
  invitation: { id: string; expiresAt: string; expired: boolean } | null;
}

export interface IssuedInvitation {
  userId: string;
  invitationId: string;
  expiresAt: string;
  inviteUrl: string;
}
