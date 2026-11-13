import type { Metadata } from "next";
import { Suspense } from "react";

import { FinishedGoodsPage } from "@/features/godown/finished-goods-page";

// Rendered only after AuthGuard confirms the session; see app/(dashboard)/users/page.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Finished Goods" };

// The view reads its tab and filters from the query string, hence the Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <FinishedGoodsPage />
    </Suspense>
  );
}
