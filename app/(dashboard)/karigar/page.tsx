import type { Metadata } from "next";
import { Suspense } from "react";

import { KarigarList } from "@/features/production/components/karigar-list";

// Rendered only after AuthGuard confirms the session; see app/(dashboard)/users/page.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Karigar Master" };

// Client view: reads the URL (filters or id), hence the Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <KarigarList />
    </Suspense>
  );
}
