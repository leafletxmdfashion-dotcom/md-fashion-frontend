import type { Metadata } from "next";
import { Suspense } from "react";

import { RolesPage } from "@/features/users/components/roles-page";

// Rendered only after AuthGuard confirms the session; see app/(dashboard)/users/page.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Roles & Permissions" };

// The selected role lives in the query string, hence the Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <RolesPage />
    </Suspense>
  );
}
