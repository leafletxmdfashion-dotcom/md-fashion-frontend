import { SearchX } from "lucide-react";
import Link from "next/link";

import { Page } from "@/components/page-header";
import { EmptyState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";

// Unknown addresses inside the app keep the app shell, so there is a way back.
export default function NotFound() {
  return (
    <Page title="Page not found">
      <div className="rounded-lg border bg-card">
        <EmptyState
          icon={SearchX}
          title="This page could not be found"
          description="The address may be mistyped, or the page has moved. Use the menu, or go back to the dashboard."
          action={
            <Link href="/dashboard" className={buttonVariants()}>
              Back to dashboard
            </Link>
          }
        />
      </div>
    </Page>
  );
}
