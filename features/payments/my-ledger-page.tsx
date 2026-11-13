"use client";

import { UserRound } from "lucide-react";

import { Page } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { karigarCode } from "@/features/production/lib/format";

import { AccountCards, LedgerTable } from "./ledger";
import { useMyAccount, useMyLedger } from "./payments.api";

/** A staff member's or karigar's own account, read-only, for the login linked to them. */
export function MyLedgerPage() {
  const account = useMyAccount();
  const person = account.data?.person;

  return (
    <Page title="My ledger" description="What you earned, what you were paid, advances, expenses and your balance.">
      {account.error ? (
        <ErrorState title="Could not load your ledger" error={account.error} onRetry={() => void account.refetch()} />
      ) : account.isLoading ? (
        <Skeleton className="h-48" />
      ) : !person ? (
        <EmptyState
          icon={UserRound}
          title="Your login is not linked to a staff or karigar record"
          description="Ask the admin to link your login in Staff & Karigar. Your earnings and payments will then show here."
        />
      ) : (
        <div className="grid gap-5">
          <p className="text-[13px] text-muted-foreground">
            {person.name} · {karigarCode(person.number)}. Green means money due to you; red means you owe.
          </p>
          <AccountCards totals={account.data?.summary} self />
          <LedgerTable
            id="my-ledger"
            useEntries={useMyLedger}
            showPerson={false}
            exportPath="/payments/me/ledger/export"
          />
        </div>
      )}
    </Page>
  );
}
