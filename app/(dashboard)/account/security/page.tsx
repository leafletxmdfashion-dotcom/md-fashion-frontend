import type { Metadata } from "next";

import { PageBody, PageHeader, Section } from "@/components/page-header";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { SessionsList } from "@/features/auth/components/sessions-list";

// Rendered only after AuthGuard confirms the session, so it is intentionally absent
// from the prerendered shell; opt out of instant-navigation validation.
export const instant = false;

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <>
      <PageHeader title="Security" />
      <PageBody>
        <Section
          title="Password"
          description="Changing your password signs out every other device and refreshes this session."
        >
          <ChangePasswordForm />
        </Section>
        <Section title="Active sessions" description="Devices currently signed in to your account.">
          <SessionsList />
        </Section>
      </PageBody>
    </>
  );
}
