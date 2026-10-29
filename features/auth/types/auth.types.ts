// Mirrors the API permission catalog. Used for UX only (hiding navigation and
// controls); the API authorizes every request independently.
export type Permission =
  | "dashboard.view"
  | "fabric.view"
  | "fabric.inward"
  | "fabric.manage"
  | "fabric.adjust"
  | "fabric.reverse"
  | "production.view"
  | "production.manage"
  | "cutting.issue"
  | "cutting.finalize"
  | "cutting.reverse"
  | "stitching.view"
  | "stitching.issue"
  | "stitching.receive"
  | "stitching.rework"
  | "stitching.reverse"
  | "karigar.view"
  | "karigar.manage"
  | "costing.view"
  | "users.view"
  | "users.manage"
  | "roles.manage";

export type UserStatus = "ACTIVE" | "INVITED" | "DISABLED" | "LOCKED";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  role: { key: string; name: string };
  permissions: Permission[];
  /** When the server stops accepting this session: at `expiresAt`, or after this many idle minutes. */
  session: { expiresAt: string; idleTimeoutMinutes: number };
}

export interface SessionSummary {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  current: boolean;
}

export interface InvitationDetails {
  email: string;
  name: string;
  roleName: string;
  expiresAt: string;
}
