import type { Metadata } from "next";

import { PageBody, PageHeader } from "@/components/page-header";
import { AccountProfile } from "@/features/auth/components/account-profile";

// Rendered only after AuthGuard confirms the session, so it is intentionally absent
// from the prerendered shell; opt out of instant-navigation validation.
export const instant = false;

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Account" />
      <PageBody>
        <AccountProfile />
      </PageBody>
    </>
  );
}
