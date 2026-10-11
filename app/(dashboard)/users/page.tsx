import type { Metadata } from "next";

import { PageBody, PageHeader } from "@/components/page-header";
import { RequirePermission } from "@/features/auth/components/require-permission";
import { UsersTable } from "@/features/users/components/users-table";

// Rendered only after AuthGuard confirms the session, so it is intentionally absent
// from the prerendered shell; opt out of instant-navigation validation.
export const instant = false;

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <>
      <PageHeader title="Users" />
      <PageBody>
        <RequirePermission permission="users.view">
          <UsersTable />
        </RequirePermission>
      </PageBody>
    </>
  );
}
