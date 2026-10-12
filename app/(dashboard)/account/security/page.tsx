import type { Metadata } from "next";

import { Page, Section } from "@/components/page-header";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { SessionsList } from "@/features/auth/components/sessions-list";

// Rendered only after AuthGuard confirms the session, so it is intentionally absent
// from the prerendered shell; opt out of instant-navigation validation.
export const instant = false;

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <>
      <Page title="Security" description="Your password and the devices signed in to your account.">
        <div className="rounded-lg border bg-card p-5 sm:p-7">
          <Section
            title="Password"
            description="Changing your password signs out every other device and refreshes this session."
          >
            <ChangePasswordForm />
          </Section>
          <Section title="Active sessions" description="Devices currently signed in to your account.">
            <SessionsList />
          </Section>
        </div>
      </Page>
    </>
  );
}
