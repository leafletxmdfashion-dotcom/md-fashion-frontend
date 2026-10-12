"use client";

import { Page } from "@/components/page-header";
import { RequirePermission } from "@/features/auth/components/require-permission";

/** Page frame for fabric views: title, description and primary action, gated by fabric.view. */
export function FabricPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <RequirePermission permission="fabric.view" title={title}>
      <Page title={title} description={description} actions={actions}>
        {children}
      </Page>
    </RequirePermission>
  );
}
