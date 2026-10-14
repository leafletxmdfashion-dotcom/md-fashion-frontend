import type { Metadata } from "next";
import { Suspense } from "react";

import { NewCutting } from "@/features/production/components/production-pages";

// Rendered only after AuthGuard confirms the session; see app/(dashboard)/users/page.tsx.
export const instant = false;

export const metadata: Metadata = { title: "New cutting" };

// Client view: reads the URL (filters or id), hence the Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <NewCutting />
    </Suspense>
  );
}
