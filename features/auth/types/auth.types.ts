// Mirrors the API permission catalog. Used for UX only (hiding navigation and
// controls); the API authorizes every request independently.
export type Permission =
  | "dashboard.view"
  | "products.view"
  | "products.create"
  | "products.update"
  | "products.delete"
  | "garments.view"
  | "garments.create"
  | "garments.update"
  | "garments.delete"
  | "inventory.view"
  | "inventory.adjust"
  | "fabric.view"
  | "fabric.manage"
  | "fabric.inward"
  | "fabric.adjust"
  | "production.view"
  | "production.manage"
  | "cutting.issue"
  | "cutting.finalize"
  | "cutting.reverse"
  | "karigar.view"
  | "karigar.manage"
  | "costing.view"
  | "leftovers.view"
  | "leftovers.manage"
  | "orders.view"
  | "orders.create"
  | "orders.update"
  | "orders.cancel"
  | "customers.view"
  | "customers.manage"
  | "reports.view"
  | "users.view"
  | "users.manage"
  | "settings.manage";

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
