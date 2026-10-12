"use client";

import { PackagePlus, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { downloadServerCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

import { useFabricOptions, useInwards } from "../hooks/use-fabric";
import { formatDate, formatMoney, formatNumber, formatQty, inwardNumber, UNIT_LABEL } from "../lib/format";
import type { FabricUnit, Inward } from "../types/fabric.types";
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
        <p className="text-xs text-muted-foreground">
          <span className="sm:hidden">{formatDate(inward.inwardDate)} · </span>
          {inward.fabric.code}
          <span className="md:hidden"> · {formatQty(inward.quantity, inward.fabric.unit)}</span>
        </p>
      </>
    ),
  },
  {
    id: "colorRoll",
    header: "Colour / roll",
    className: "hidden lg:table-cell",
    sortable: true,
    filter: { type: "text", placeholder: "Colour or roll contains…" },
    skeleton: { sub: true, width: "w-14" },
    csv: (inward) => [inward.color, inward.rollRef].filter(Boolean).join(" / "),
    cell: (inward) =>
      inward.color || inward.rollRef ? (
        <>
          <p>{inward.color ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{inward.rollRef ?? ""}</p>
        </>
      ) : (
        <span className="text-muted-foreground">—</span>
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
      <span className="text-muted-foreground">
        {formatNumber(inward.rate)}/{UNIT_LABEL[inward.fabric.unit]}
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
        {formatMoney(inward.amount)}
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

export function InwardList() {
  const { data: user } = useCurrentUser();
  const table = useDataTableState(COLUMNS, ["fabricId"]);
  const inwards = useInwards({ ...table.params, page: table.page, pageSize: table.pageSize });
  const fabrics = useFabricOptions();
  const [creating, setCreating] = useState(0);
  const [selected, setSelected] = useState<Inward | null>(null);

  const canPost = hasPermission(user, "fabric.inward");
  const data = inwards.data;
  const quantities = Object.entries(data?.totalQuantity ?? {}) as [FabricUnit, number][];
  const pickedFabric = fabrics.data?.find((fabric) => fabric.id === table.filters.fabricId);
  const anyFilter = Object.keys(table.params).length > 0;

  return (
    <FabricPage
      title="Purchase / Inward"
      description="Fabric received from suppliers. Posting a purchase adds it to stock through the ledger."
    >
      <DataTable
        id="fabric-purchases"
        columns={COLUMNS}
        rows={data?.inwards}
        rowId={(inward) => inward.id}
        total={data?.total}
        state={table}
        isFetching={inwards.isFetching}
        isPlaceholderData={inwards.isPlaceholderData}
        error={inwards.error}
        onRetry={() => void inwards.refetch()}
        searchLabel="Search purchases"
        searchPlaceholder="Search fabric, supplier, invoice, roll, FI-no…"
        isEmpty={!anyFilter}
        empty={{
          icon: PackagePlus,
          title: "No purchases yet",
          description: canPost
            ? "Record a purchase to bring fabric into stock. Each one is added to the fabric's ledger."
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
          canPost ? (
            <Button onClick={() => setCreating((count) => count + 1)}>
              <Plus aria-hidden />
              Record purchase
            </Button>
          ) : null
        }
        bulkActions={() => null}
        onRowClick={setSelected}
        rowActions={(inward) => (
          <>
            <DropdownMenuItem onClick={() => setSelected(inward)}>View details</DropdownMenuItem>
            <DropdownMenuItem render={<Link href={`/fabric/ledger?fabric=${inward.fabric.id}`} />}>
              Open fabric ledger
            </DropdownMenuItem>
          </>
        )}
        footer={() => (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
            <span className="text-muted-foreground">
              {data?.total.toLocaleString("en-IN")} purchase{data?.total === 1 ? "" : "s"}
              {quantities.length > 0 ? ` · ${quantities.map(([unit, qty]) => formatQty(qty, unit)).join(" · ")}` : null}
            </span>
            <span className="font-semibold tabular-nums">Total {formatMoney(data?.totalAmount ?? 0)}</span>
          </div>
        )}
      />

      {creating > 0 ? (
        <InwardFormDialog
          key={creating}
          open
          onOpenChange={(open) => {
            if (!open) setCreating(0);
          }}
          defaultFabricId={table.filters.fabricId || undefined}
        />
      ) : null}
      <InwardDetailSheet
        inward={selected}
        canReverse={hasPermission(user, "fabric.adjust")}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </FabricPage>
  );
}
