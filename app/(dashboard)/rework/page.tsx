import type { Metadata } from "next";
import { Suspense } from "react";

import { ReworkPage } from "@/features/stitching/components/rework-page";

// Rendered only after AuthGuard confirms the session; see app/(dashboard)/users/page.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Rework & Reject" };

// The view reads filters from the query string, hence the Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <ReworkPage />
    </Suspense>
  );
}
