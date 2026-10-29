"use client";

import { Layers, PackagePlus, Plus, SlidersHorizontal, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { StatCard, StatCardSkeleton } from "@/components/stat-card";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { downloadServerCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

import { useFabricOptions, useInwards } from "../hooks/use-fabric";
import { formatDate, formatMoney, formatQty, inwardNumber, UNIT_LABEL } from "../lib/format";
import type { FabricUnit, Inward } from "../types/fabric.types";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { EditFabricDialog } from "./edit-fabric-dialog";
import { FabricCombobox } from "./fabric-combobox";
import { FabricPage } from "./fabric-page";
import { InwardDetailSheet } from "./inward-detail-sheet";
import { InwardFormDialog } from "./inward-form-dialog";

const COLUMNS: DataColumn<Inward>[] = [
  {
    id: "date",
    header: "Date",
    className: "hidden sm:table-cell",
    sortable: true,
    filter: { type: "date" },
    skeleton: { width: "w-20" },
    csv: (inward) => inward.inwardDate,
    cell: (inward) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(inward.inwardDate)}</span>,
  },
  {
    id: "number",
    header: "No.",
    className: "hidden sm:table-cell",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-14" },
    csv: (inward) => inwardNumber(inward.number),
    cell: (inward) => <span className="font-mono text-xs">{inwardNumber(inward.number)}</span>,
  },
  {
    id: "fabric",
    header: "Fabric",
    sortable: true,
    hideable: false,
    filter: { type: "text", placeholder: "Name or code contains…" },
    skeleton: { sub: true, width: "w-28" },
    csv: (inward) => `${inward.fabric.name} (${inward.fabric.code})`,
    cell: (inward) => (
      <>
        <p className="font-medium">{inward.fabric.name}</p>
        <p className="text-xs text-muted-foreground md:hidden">
          <span className="sm:hidden">{formatDate(inward.inwardDate)} · </span>
          {formatQty(inward.quantity, inward.fabric.unit)}
        </p>
      </>
    ),
  },
  {
    id: "quantity",
    header: "Quantity",
    align: "right",
    className: "hidden md:table-cell",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-16" },
    csv: (inward) => `${inward.quantity} ${UNIT_LABEL[inward.fabric.unit]}`,
    cell: (inward) => formatQty(inward.quantity, inward.fabric.unit),
  },
  {
    id: "rate",
    header: "Rate",
    align: "right",
    className: "hidden lg:table-cell",
    sortable: true,
    filter: { type: "number", unit: "Rs" },
    skeleton: { width: "w-14" },
    csv: (inward) => inward.rate,
    cell: (inward) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {inward.rate != null ? `${formatMoney(inward.rate)}/${UNIT_LABEL[inward.fabric.unit]}` : "—"}
      </span>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    align: "right",
    sortable: true,
    filter: { type: "number", unit: "Rs" },
    skeleton: { width: "w-24" },
    csv: (inward) => inward.amount,
    cell: (inward) => (
      <span className={cn("font-medium whitespace-nowrap", inward.reversal && "text-muted-foreground line-through")}>
        {inward.amount != null ? formatMoney(inward.amount) : "—"}
      </span>
    ),
  },
  {
    id: "supplier",
    header: "Supplier / invoice",
    className: "hidden xl:table-cell",
    sortable: true,
    filter: { type: "text", placeholder: "Supplier or invoice contains…" },
    skeleton: { sub: true, width: "w-28" },
    csv: (inward) => [inward.supplier, inward.invoiceRef].filter(Boolean).join(" / "),
    cell: (inward) => (
      <>
        <p className="max-w-48 truncate">{inward.supplier ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{inward.invoiceRef ?? ""}</p>
      </>
    ),
  },
  {
    id: "status",
    header: "Status",
    sortable: true,
    filter: {
      type: "enum",
      options: [
        { value: "posted", label: "Posted" },
        { value: "reversed", label: "Reversed" },
      ],
    },
    skeleton: { width: "w-14" },
    csv: (inward) => (inward.reversal ? "Reversed" : "Posted"),
    cell: (inward) =>
      inward.reversal ? (
        <StatusChip tone="danger">Reversed</StatusChip>
      ) : (
        <StatusChip tone="success">Posted</StatusChip>
      ),
  },
];

// "Export selected" writes the same columns as the server export, so one spreadsheet template fits both.
const EXPORT: { header: string; value: (inward: Inward) => string | number | null; cost?: true }[] = [
  { header: "No.", value: (inward) => inwardNumber(inward.number) },
  { header: "Date", value: (inward) => inward.inwardDate },
  { header: "Fabric code", value: (inward) => inward.fabric.code },
  { header: "Fabric", value: (inward) => inward.fabric.name },
  { header: "Unit", value: (inward) => inward.fabric.unit },
  { header: "Quantity", value: (inward) => inward.quantity },
  { header: "Rate", value: (inward) => inward.rate, cost: true },
  { header: "Amount", value: (inward) => inward.amount, cost: true },
  { header: "Supplier", value: (inward) => inward.supplier },
  { header: "Invoice", value: (inward) => inward.invoiceRef },
  { header: "Status", value: (inward) => (inward.reversal ? "Reversed" : "Posted") },
  { header: "Notes", value: (inward) => inward.notes },
];

const EXPORT_WITHOUT_COST = EXPORT.filter((column) => !column.cost);

// Rate and amount come back null without costing.view, so those columns (and their filters) are dropped.
const COLUMNS_WITHOUT_COST = COLUMNS.filter((column) => column.id !== "rate" && column.id !== "amount");

export function InwardList() {
  const { data: user } = useCurrentUser();
  const table = useDataTableState(COLUMNS, ["fabricId"]);
  const inwards = useInwards({ ...table.params, page: table.page, pageSize: table.pageSize });
  const fabrics = useFabricOptions();
  // `key` remounts the dialog so each open starts fresh.
  const [dialog, setDialog] = useState<{ kind: "purchase" | "adjust" | "edit"; fabricId?: string; key: number } | null>(
    null,
  );
  const [selected, setSelected] = useState<Inward | null>(null);
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  const canPost = hasPermission(user, "fabric.inward");
  const canAdjust = hasPermission(user, "fabric.adjust");
  const canManage = hasPermission(user, "fabric.manage");
  const canSeeCost = hasPermission(user, "costing.view");
  const data = inwards.data;
  const quantities = Object.entries(data?.totalQuantity ?? {}) as [FabricUnit, number][];
  const pickedFabric = fabrics.data?.find((fabric) => fabric.id === table.filters.fabricId);
  const anyFilter = Object.keys(table.params).length > 0;

  return (
    <FabricPage
      title="Purchase / Inward"
      description="Fabric received from suppliers. Adding a purchase creates the fabric if it is new and adds it to stock through the ledger."
    >
      <div className="grid gap-4">
        {/* Totals follow the search and filters; reversed purchases do not count. */}
        {!data ? (
          inwards.isError ? null : (
            <div className={cn("grid gap-3", canSeeCost ? "sm:grid-cols-3" : "sm:grid-cols-2")} aria-hidden>
              {Array.from({ length: canSeeCost ? 3 : 2 }, (_, index) => (
                <StatCardSkeleton key={index} />
              ))}
            </div>
          )
        ) : (
          <section
            aria-label="Purchase totals"
            className={cn("grid gap-3", canSeeCost ? "sm:grid-cols-3" : "sm:grid-cols-2")}
          >
            <StatCard
              label="Purchases"
              icon={PackagePlus}
              value={data.total.toLocaleString("en-IN")}
              context={anyFilter ? "matching the filters" : "all time"}
            />
            <StatCard
              label="Quantity received"
              icon={Layers}
              value={quantities.length > 0 ? quantities.map(([unit, qty]) => formatQty(qty, unit)).join(" · ") : "—"}
              context="posted purchases"
            />
            {data.totalAmount != null ? (
              <StatCard
                label="Purchase value"
                icon={Wallet}
                value={formatMoney(data.totalAmount)}
                context="posted purchases"
              />
            ) : null}
          </section>
        )}
        <DataTable
          id="fabric-purchases"
          columns={canSeeCost ? COLUMNS : COLUMNS_WITHOUT_COST}
          exportColumns={canSeeCost ? EXPORT : EXPORT_WITHOUT_COST}
          rows={data?.inwards}
          rowId={(inward) => inward.id}
          total={data?.total}
          state={table}
          isFetching={inwards.isFetching}
          isPlaceholderData={inwards.isPlaceholderData}
          error={inwards.error}
          onRetry={() => void inwards.refetch()}
          searchLabel="Search purchases"
          searchPlaceholder="Search fabric, supplier, invoice, FI-no…"
          isEmpty={!anyFilter}
          empty={{
            icon: PackagePlus,
            title: "No purchases yet",
            description: canPost
              ? "Add a purchase to bring fabric into stock. Type the fabric name; new fabrics are created for you."
              : "Posted purchases appear here.",
          }}
          toolbarStart={
            <FabricCombobox
              aria-label="Filter by fabric"
              placeholder="All fabrics"
              fabrics={fabrics.data ?? []}
              value={table.filters.fabricId ?? ""}
              onChange={(fabricId) => table.setFilters({ fabricId })}
              clearable
              className="w-full sm:w-56"
            />
          }
          extraFilters={
            table.filters.fabricId
              ? [
                  {
                    label: "Fabric",
                    value: pickedFabric?.name ?? "Selected fabric",
                    onClear: () => table.setFilters({ fabricId: "" }),
                  },
                ]
              : []
          }
          onExport={() => downloadServerCsv("/fabrics/inwards/export", table.params)}
          exportName="fabric-purchases"
          toolbarEnd={
            <>
              {canAdjust ? (
                <Button
                  variant="outline"
                  onClick={() => setDialog({ kind: "adjust", fabricId: table.filters.fabricId, key: Date.now() })}
                >
                  <SlidersHorizontal aria-hidden />
                  Adjust stock
                </Button>
              ) : null}
              {canPost ? (
                <Button onClick={() => setDialog({ kind: "purchase", key: Date.now() })}>
                  <Plus aria-hidden />
                  Add purchase
                </Button>
              ) : null}
            </>
          }
          bulkActions={() => null}
          onRowClick={setSelected}
          rowActions={(inward) => (
            <>
              <DropdownMenuItem onClick={() => setSelected(inward)}>View details</DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`/fabric/ledger?fabric=${inward.fabric.id}`} />}>
                Open fabric ledger
              </DropdownMenuItem>
              {canAdjust ? (
                <DropdownMenuItem
                  onClick={() => setDialog({ kind: "adjust", fabricId: inward.fabric.id, key: Date.now() })}
                >
                  Adjust {inward.fabric.name} stock
                </DropdownMenuItem>
              ) : null}
              {canManage ? (
                <DropdownMenuItem
                  onClick={() => setDialog({ kind: "edit", fabricId: inward.fabric.id, key: Date.now() })}
                >
                  Edit fabric details
                </DropdownMenuItem>
              ) : null}
            </>
          )}
        />
      </div>

      {dialog?.kind === "purchase" ? (
        <InwardFormDialog key={dialog.key} open onOpenChange={close} defaultFabricName={pickedFabric?.name} />
      ) : null}
      {dialog?.kind === "edit" && dialog.fabricId ? (
        <EditFabricDialog key={dialog.key} open onOpenChange={close} fabricId={dialog.fabricId} />
      ) : null}
      {dialog?.kind === "adjust" ? (
        <AdjustStockDialog key={dialog.key} open onOpenChange={close} fabricId={dialog.fabricId} />
      ) : null}
      <InwardDetailSheet
        inward={selected}
        canReverse={hasPermission(user, "fabric.reverse")}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </FabricPage>
  );
}
