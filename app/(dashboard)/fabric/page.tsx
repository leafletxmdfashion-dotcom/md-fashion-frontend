import type { Metadata } from "next";
import { Suspense } from "react";

import { FabricList } from "@/features/fabric/components/fabric-list";

// Rendered only after AuthGuard confirms the session; see app/(dashboard)/users/page.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Fabric Master" };

// The view owns its header (its primary action needs client state) and reads
// filters from the query string, hence the Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <FabricList />
    </Suspense>
  );
}
