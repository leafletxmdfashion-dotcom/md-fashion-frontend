import type { Metadata } from "next";
import { Suspense } from "react";

import { SizeTemplates } from "@/features/production/components/size-templates";

// Rendered only after AuthGuard confirms the session; see app/(dashboard)/users/page.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Size Templates" };

// Client view: reads the URL (filters or id), hence the Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <SizeTemplates />
    </Suspense>
  );
}
