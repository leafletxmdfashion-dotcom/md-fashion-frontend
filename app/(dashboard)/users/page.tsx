import type { Metadata } from "next";

import { UsersTable } from "@/features/users/components/users-table";

// Rendered only after AuthGuard confirms the session, so it is intentionally absent
// from the prerendered shell; opt out of instant-navigation validation.
export const instant = false;

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return <UsersTable />;
}
