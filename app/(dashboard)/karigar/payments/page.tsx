import type { Metadata } from "next";
import { Suspense } from "react";

import { PaymentsPage } from "@/features/payments/payments-page";

// Rendered only after AuthGuard confirms the session; see app/(dashboard)/users/page.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Payments" };

// The view reads its filters from the query string, hence the Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <PaymentsPage />
    </Suspense>
  );
}
