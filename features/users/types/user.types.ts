import type { Permission, UserStatus } from "@/features/auth/types/auth.types";

export interface RoleRef {
  key: string;
  name: string;
  rank: number;
}

export interface Role extends RoleRef {
  permissions: Permission[];
  /** One of the five seeded roles: its name is fixed and it cannot be deleted. */
  builtIn: boolean;
  userCount: number;
  /** Whether the current user may assign this role (UX hint; the API re-checks). */
  assignable: boolean;
  /** Whether the current user may change this role (UX hint; the API re-checks). */
  editable: boolean;
}

/** The API's permission catalog, grouped by module, with what each right allows. */
export interface PermissionGroup {
  module: string;
  permissions: { key: Permission; label: string; description: string }[];
}

export interface ManagedUser {
  id: string;
  email: string | null;
  phone: string | null;
  /** An admin set the password; the user must change it at the next sign-in. */
  mustChangePassword: boolean;
  name: string;
  status: UserStatus;
  role: RoleRef;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  activeSessionCount: number;
  /** The staff / karigar record this login belongs to, if any. */
  linkedTo: { id: string; name: string } | null;
  invitation: { id: string; expiresAt: string; expired: boolean } | null;
}

export interface IssuedInvitation {
  userId: string;
  invitationId: string;
  expiresAt: string;
  inviteUrl: string;
}

/** A login just created: by invitation (link returned once) or with an admin-set password. */
export interface CreatedLogin {
  userId: string;
  mode: "INVITE" | "PASSWORD";
  invitation: IssuedInvitation | null;
}
