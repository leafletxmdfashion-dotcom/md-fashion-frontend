import type { Metadata } from "next";
import { Suspense } from "react";

import { FabricLedger } from "@/features/fabric/components/fabric-ledger";

// Rendered only after AuthGuard confirms the session; see app/(dashboard)/users/page.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Stock & Ledger" };

// The view owns its header (its primary action needs client state) and reads
// filters from the query string, hence the Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <FabricLedger />
    </Suspense>
  );
}
