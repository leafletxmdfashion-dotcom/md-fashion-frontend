"use client";

import { ArrowDownLeft, ArrowUpRight, HandCoins, Receipt, ScrollText, Wallet } from "lucide-react";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { StatCard, StatCardSkeleton } from "@/components/stat-card";
import { StatusChip } from "@/components/status-chip";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/features/fabric/lib/format";
import { karigarCode, moneyText } from "@/features/production/lib/format";
import { cn } from "@/lib/utils";

import {
  KIND_LABEL,
  METHOD_LABEL,
  type EntryKind,
  type LedgerEntry,
  type LedgerPage,
  type Totals,
} from "./payments.api";

/** Positive (we owe them) green, negative (they owe us) red, zero muted. */
export function BalanceText({ value, className }: { value: string | number; className?: string }) {
  const amount = Number(value);

  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        amount > 0 ? "text-success" : amount < 0 ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {amount < 0 ? "−" : ""}
      {moneyText(Math.abs(amount))}
    </span>
  );
}

/** "To pay" / "To receive" / "Settled" next to a balance. */
export const balanceWord = (value: string | number) =>
  Number(value) > 0 ? "To pay" : Number(value) < 0 ? "To receive" : "Settled";

/** One person's account: balance first, then what it is made of. */
export function AccountCards({ totals, self = false }: { totals: Totals | null | undefined; self?: boolean }) {
  if (!totals) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  const balance = Number(totals.balance);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label={balance >= 0 ? "Balance · to pay" : "Balance · to receive"}
        icon={Wallet}
        value={`${balance < 0 ? "−" : ""}${moneyText(Math.abs(balance))}`}
        context={
          balance > 0
            ? self
              ? "Due to you"
              : "Owed to them"
            : balance < 0
              ? self
                ? "You owe"
                : "They owe"
              : "Fully settled"
        }
        tone={balance > 0 ? "success" : balance < 0 ? "danger" : "default"}
      />
      <StatCard
        label="Earned"
        icon={ArrowDownLeft}
        value={moneyText(totals.earned)}
        context={Number(totals.credits) ? `+ ${moneyText(totals.credits)} credits` : "From work done"}
      />
      <StatCard
        label="Paid"
        icon={ArrowUpRight}
        value={moneyText(totals.paid)}
        context={totals.lastDate ? `Last entry ${formatDate(totals.lastDate)}` : undefined}
      />
      <StatCard
        label="Advances & expenses"
        icon={HandCoins}
        value={moneyText(Number(totals.advances) + Number(totals.expenses))}
        context={`${moneyText(totals.advances)} lent · ${moneyText(totals.expenses)} spent${Number(totals.recovered) ? ` · ${moneyText(totals.recovered)} back` : ""}`}
      />
    </div>
  );
}

export function ledgerColumns(showPerson: boolean): DataColumn<LedgerEntry>[] {
  const person: DataColumn<LedgerEntry>[] = showPerson
    ? [
        {
          id: "person",
          header: "Person",
          sortable: true,
          filter: { type: "text", placeholder: "Name contains…" },
          skeleton: { sub: true, width: "w-24" },
          cell: (row) => (
            <>
              <p className="font-medium">{row.karigar.name}</p>
              <p className="text-xs text-muted-foreground">{karigarCode(row.karigar.number)}</p>
            </>
          ),
        },
      ]
    : [];

  return [
    {
      id: "date",
      header: "Date",
      sortable: true,
      filter: { type: "date" },
      skeleton: { width: "w-20" },
      cell: (row) => <span className="whitespace-nowrap">{formatDate(row.date)}</span>,
    },
    ...person,
    {
      id: "kind",
      header: "Entry",
      sortable: true,
      hideable: false,
      filter: {
        type: "enum",
        // SAFETY: KIND_LABEL is keyed by exactly the EntryKind values.
        options: (Object.keys(KIND_LABEL) as EntryKind[]).map((value) => ({
          value,
          label: KIND_LABEL[value],
        })),
      },
      skeleton: { sub: true, width: "w-32" },
      cell: (row) => (
        <>
          <p className="flex flex-wrap items-center gap-1.5 font-medium">
            {row.label}
            {row.reversed ? <StatusChip tone="danger">Reversed</StatusChip> : null}
          </p>
          <p className="text-xs text-muted-foreground">{row.description}</p>
        </>
      ),
    },
    {
      id: "method",
      header: "Paid by",
      className: "hidden lg:table-cell",
      sortable: true,
      filter: {
        type: "enum",
        options: Object.entries(METHOD_LABEL).map(([value, label]) => ({
          value,
          label,
        })),
      },
      skeleton: { sub: true, width: "w-16" },
      cell: (row) =>
        row.method || row.reference ? (
          <>
            <p>{row.method ? METHOD_LABEL[row.method] : ""}</p>
            <p className="font-mono text-xs text-muted-foreground">{row.reference}</p>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      filter: { type: "number", unit: "Rs" },
      skeleton: { width: "w-16" },
      cell: (row) => (
        <span
          className={cn(
            "font-semibold tabular-nums",
            Number(row.amount) >= 0 ? "text-success" : "text-destructive",
            row.reversed && "line-through opacity-60",
          )}
        >
          {Number(row.amount) >= 0 ? "+" : "−"}
          {moneyText(Math.abs(Number(row.amount)))}
        </span>
      ),
    },
    {
      id: "balance",
      header: "Balance after",
      align: "right",
      className: "hidden md:table-cell",
      skeleton: { width: "w-16" },
      cell: (row) => <BalanceText value={row.balance} className="font-medium" />,
    },
  ];
}

interface LedgerQuery {
  data?: LedgerPage | undefined;
  isFetching: boolean;
  isPlaceholderData: boolean;
  error: unknown;
  refetch: () => unknown;
}

/** A ledger with filters, a matching-total line and an optional reverse action. */
export function LedgerTable({
  id,
  useEntries,
  extra,
  showPerson,
  onReverse,
  exportPath,
}: {
  id: string;
  /** The query hook to read with (all entries, one person's, or the signed-in person's). */
  useEntries: (filters: Record<string, string | number | undefined>) => LedgerQuery;
  extra?: Record<string, string | undefined>;
  showPerson: boolean;
  onReverse?: ((entry: LedgerEntry) => void) | undefined;
  /** Server CSV export path; the export uses the same filters (and person) as the list. */
  exportPath: string;
}) {
  const columns = ledgerColumns(showPerson);
  const table = useDataTableState(columns);
  const ledger = useEntries({
    ...table.params,
    ...extra,
    page: table.page,
    pageSize: table.pageSize,
  });

  return (
    <div className="grid gap-2">
      <DataTable
        id={id}
        columns={columns}
        rows={ledger.data?.entries}
        rowId={(row) => row.id}
        total={ledger.data?.total}
        state={table}
        isFetching={ledger.isFetching}
        isPlaceholderData={ledger.isPlaceholderData}
        error={ledger.error}
        onRetry={() => void ledger.refetch()}
        searchLabel="Search ledger"
        searchPlaceholder="Search note, category, voucher, name…"
        isEmpty={Object.keys(table.params).length === 0}
        empty={{
          icon: ScrollText,
          title: "No entries yet",
          description: "Earnings from work, payments, advances, expenses and credits appear here.",
        }}
        exportPath={exportPath}
        exportParams={{ ...table.params, ...extra }}
        rowActions={
          onReverse
            ? (row) =>
                row.reversible ? (
                  <DropdownMenuItem onClick={() => onReverse(row)}>
                    <Receipt aria-hidden />
                    Reverse this entry
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled>
                    {row.sourceType === "MANUAL" ? "Already reversed" : "Reversed from its own document"}
                  </DropdownMenuItem>
                )
            : undefined
        }
      />
    </div>
  );
}
