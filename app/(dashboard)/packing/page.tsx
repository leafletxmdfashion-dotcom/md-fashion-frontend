import type { Metadata } from "next";
import { Suspense } from "react";

import { PackingPage } from "@/features/packing/packing-page";

// Rendered only after AuthGuard confirms the session; see app/(dashboard)/users/page.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Packing" };

// The view reads its tab from the query string, hence the Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <PackingPage />
    </Suspense>
  );
}
