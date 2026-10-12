import type { Metadata } from "next";

import { Page } from "@/components/page-header";
import { AccountProfile } from "@/features/auth/components/account-profile";

// Rendered only after AuthGuard confirms the session, so it is intentionally absent
// from the prerendered shell; opt out of instant-navigation validation.
export const instant = false;

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <>
      <Page title="Account" description="Your profile and how you sign in.">
        <div className="rounded-lg border bg-card p-5 sm:p-7">
          <AccountProfile />
        </div>
      </Page>
    </>
  );
}
