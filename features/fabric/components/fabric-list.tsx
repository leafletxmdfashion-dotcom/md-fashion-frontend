"use client";

import { AlertTriangle, Archive, ArchiveRestore, Layers, PackageX, Plus, Upload, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { StatCard, StatCardSkeleton } from "@/components/stat-card";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { ApiError } from "@/lib/api-client";
import { downloadServerCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

import { useBulkFabricStatus, useFabricList, useUpdateFabric } from "../hooks/use-fabric";
import { formatMoney, formatQty, stockState, UNIT_LABEL } from "../lib/format";
import type { Fabric } from "../types/fabric.types";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { FabricFormDialog } from "./fabric-form-dialog";
import { FabricImportDialog } from "./fabric-import-dialog";
import { FabricPage } from "./fabric-page";
import { InwardFormDialog } from "./inward-form-dialog";

type Dialog =
  | { kind: "form"; fabric?: Fabric; key: number }
  | { kind: "adjust" | "purchase"; fabric: Fabric; key: number }
  | { kind: "import"; key: number }
  | null;

const errorMessage = (fallback: string) => (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : fallback);

function StockCell({ fabric }: { fabric: Fabric }) {
  const state = stockState(fabric);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        state === "low" && "text-warning",
        state === "out" && "text-destructive",
      )}
    >
      {state !== "ok" ? (
        <AlertTriangle className="size-3.5" aria-label={state === "out" ? "Out of stock" : "Low stock"} />
      ) : null}
      {formatQty(fabric.balance, fabric.unit)}
    </span>
  );
}

const COLUMNS: DataColumn<Fabric>[] = [
  {
    id: "fabric",
    header: "Fabric",
    sortable: true,
    hideable: false,
    filter: { type: "text", placeholder: "Name or code contains…" },
    skeleton: { sub: true, width: "w-28" },
    csv: (fabric) => `${fabric.name} (${fabric.code})`,
    cell: (fabric) => (
      <>
        <Link
          href={`/fabric/ledger?fabric=${fabric.id}`}
          onClick={(event) => event.stopPropagation()}
          className="font-medium text-foreground hover:underline"
        >
          {fabric.name}
        </Link>
        <p className="text-xs text-muted-foreground">
          {fabric.code}
          {fabric.category ? <span className="md:hidden"> · {fabric.category}</span> : null}
        </p>
      </>
    ),
  },
  {
    id: "category",
    header: "Category",
    className: "hidden md:table-cell",
    sortable: true,
    filter: { type: "text", placeholder: "Category contains…" },
    skeleton: { width: "w-14" },
    csv: (fabric) => fabric.category,
    cell: (fabric) => <span className="text-muted-foreground">{fabric.category ?? "—"}</span>,
  },
  {
    id: "balance",
    header: "In stock",
    align: "right",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-16" },
    csv: (fabric) => `${fabric.balance} ${UNIT_LABEL[fabric.unit]}`,
    cell: (fabric) => <StockCell fabric={fabric} />,
  },
  {
    id: "threshold",
    header: "Reorder at",
    align: "right",
    className: "hidden lg:table-cell",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-12" },
    csv: (fabric) => fabric.lowStockThreshold,
    cell: (fabric) => (
      <span className="text-muted-foreground">
        {fabric.lowStockThreshold === null ? "—" : formatQty(fabric.lowStockThreshold, fabric.unit)}
      </span>
    ),
  },
  {
    id: "avgRate",
    header: "Avg rate",
    align: "right",
    className: "hidden lg:table-cell",
    sortable: true,
    filter: { type: "number", unit: "Rs" },
    skeleton: { width: "w-20" },
    csv: (fabric) => (fabric.avgRate === null ? null : Math.round(fabric.avgRate * 100) / 100),
    cell: (fabric) => (
      <span className="text-muted-foreground">
        {fabric.avgRate === null ? "—" : `${formatMoney(fabric.avgRate)}/${UNIT_LABEL[fabric.unit]}`}
      </span>
    ),
  },
  {
    id: "stockValue",
    header: "Stock value",
    align: "right",
    className: "hidden sm:table-cell",
    sortable: true,
    filter: { type: "number", unit: "Rs" },
    skeleton: { width: "w-24" },
    csv: (fabric) => fabric.stockValue,
    cell: (fabric) => <span className="font-medium">{formatMoney(fabric.stockValue)}</span>,
  },
  {
    id: "status",
    header: "Status",
    className: "hidden md:table-cell",
    sortable: true,
    filter: {
      type: "enum",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    },
    skeleton: { width: "w-14" },
    csv: (fabric) => (fabric.isActive ? "Active" : "Inactive"),
    cell: (fabric) => (
      <StatusChip tone={fabric.isActive ? "success" : "neutral"}>{fabric.isActive ? "Active" : "Inactive"}</StatusChip>
    ),
  },
];

const STOCK_LABEL: Record<string, string> = { low: "Needs reorder", out: "Out of stock" };

export function FabricList() {
  const { data: user } = useCurrentUser();
  const update = useUpdateFabric();
  const bulkStatus = useBulkFabricStatus();
  const table = useDataTableState(COLUMNS, ["stock"]);
  // Filtering, search, sorting and paging all run in the database; one page is loaded.
  const list = useFabricList({ ...table.params, page: table.page, pageSize: table.pageSize });
  const [dialog, setDialog] = useState<Dialog>(null);
  const open = (next: NonNullable<Dialog>) => setDialog(next);
  const close = (isOpen: boolean) => {
    if (!isOpen) setDialog(null);
  };

  const can = {
    manage: hasPermission(user, "fabric.manage"),
    inward: hasPermission(user, "fabric.inward"),
    adjust: hasPermission(user, "fabric.adjust"),
  };

  const data = list.data;
  const summary = data?.summary;
  const noFabricsAtAll = summary !== undefined && summary.active + summary.inactive === 0;

  const toggleActive = (fabric: Fabric) =>
    update.mutate(
      {
        id: fabric.id,
        code: fabric.code,
        name: fabric.name,
        unit: fabric.unit,
        category: fabric.category,
        lowStockThreshold: fabric.lowStockThreshold,
        description: fabric.description,
        isActive: !fabric.isActive,
      },
      {
        onSuccess: () => toast.success(`${fabric.name} ${fabric.isActive ? "deactivated" : "reactivated"}.`),
        onError: errorMessage("Could not update the fabric."),
      },
    );

  const setStatus = (rows: Fabric[], isActive: boolean, clear: () => void) =>
    bulkStatus.mutate(
      { ids: rows.map((row) => row.id), isActive },
      {
        onSuccess: (count) => {
          toast.success(
            count === 0
              ? `Already ${isActive ? "active" : "inactive"}.`
              : `${count} fabric${count === 1 ? "" : "s"} ${isActive ? "reactivated" : "deactivated"}.`,
          );
          clear();
        },
        onError: errorMessage("Could not update the fabrics."),
      },
    );

  const showOnly = (patch: Record<string, string>) =>
    table.setFilters({ stock: "", status: "", category: "", fabric: "", q: "", ...patch });

  return (
    <FabricPage title="Fabric Master" description="Every fabric you buy, with live stock, reorder levels and value.">
      <div className="grid gap-4">
        {!summary ? (
          list.isError ? null : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
              {Array.from({ length: 4 }, (_, index) => (
                <StatCardSkeleton key={index} />
              ))}
            </div>
          )
        ) : noFabricsAtAll ? null : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Stock value"
              icon={Wallet}
              value={formatMoney(summary.stockValue)}
              context="Active fabrics, at average purchase rate"
            />
            <StatCard
              label="Active fabrics"
              icon={Layers}
              value={String(summary.active)}
              context={`${summary.inStock} in stock`}
              onClick={() => showOnly({})}
            />
            <StatCard
              label="Need reorder"
              icon={PackageX}
              value={String(summary.reorder)}
              tone={summary.reorder > 0 ? "warning" : "default"}
              context={summary.reorder > 0 ? "At or below reorder level" : "All above reorder level"}
              onClick={summary.reorder > 0 ? () => showOnly({ stock: "low" }) : undefined}
            />
            <StatCard
              label="Inactive"
              icon={Archive}
              value={String(summary.inactive)}
              context="Hidden from new purchases"
              onClick={summary.inactive > 0 ? () => showOnly({ status: "inactive" }) : undefined}
            />
          </div>
        )}

        <DataTable
          id="fabrics"
          columns={COLUMNS}
          rows={data?.fabrics}
          rowId={(fabric) => fabric.id}
          total={data?.total}
          state={table}
          isFetching={list.isFetching}
          isPlaceholderData={list.isPlaceholderData}
          error={list.error}
          onRetry={() => void list.refetch()}
          searchLabel="Search fabrics"
          searchPlaceholder="Search name or code…"
          isEmpty={noFabricsAtAll}
          empty={{
            icon: Layers,
            title: "No fabrics yet",
            description:
              "Add the fabrics you buy, or import a list. Each keeps its own stock ledger, starting at zero until a purchase is posted.",
          }}
          extraFilters={
            table.filters.stock
              ? [
                  {
                    label: "Stock",
                    value: STOCK_LABEL[table.filters.stock] ?? table.filters.stock,
                    onClear: () => table.setFilters({ stock: "" }),
                  },
                ]
              : []
          }
          onExport={() => downloadServerCsv("/fabrics/export", table.params)}
          exportName="fabrics"
          toolbarEnd={
            can.manage ? (
              <>
                <Button
                  variant="secondary"
                  aria-label="Import"
                  title="Import fabrics from CSV"
                  onClick={() => open({ kind: "import", key: Date.now() })}
                >
                  <Upload aria-hidden />
                  <span className="hidden sm:inline">Import</span>
                </Button>
                <Button onClick={() => open({ kind: "form", key: Date.now() })}>
                  <Plus aria-hidden />
                  New fabric
                </Button>
              </>
            ) : null
          }
          bulkActions={(rows, clear) =>
            can.manage ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setStatus(rows, false, clear)}>
                  <Archive aria-hidden />
                  Deactivate
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setStatus(rows, true, clear)}>
                  <ArchiveRestore aria-hidden />
                  Reactivate
                </Button>
              </>
            ) : null
          }
          rowActions={(fabric) => (
            <>
              <DropdownMenuItem render={<Link href={`/fabric/ledger?fabric=${fabric.id}`} />}>
                View ledger
              </DropdownMenuItem>
              {can.inward && fabric.isActive ? (
                <DropdownMenuItem onClick={() => open({ kind: "purchase", fabric, key: Date.now() })}>
                  Record purchase
                </DropdownMenuItem>
              ) : null}
              {can.adjust ? (
                <DropdownMenuItem onClick={() => open({ kind: "adjust", fabric, key: Date.now() })}>
                  Adjust stock
                </DropdownMenuItem>
              ) : null}
              {can.manage ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => open({ kind: "form", fabric, key: Date.now() })}>
                    Edit details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleActive(fabric)}>
                    {fabric.isActive ? "Deactivate" : "Reactivate"}
                  </DropdownMenuItem>
                </>
              ) : null}
            </>
          )}
          footer={(rows) => (
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
              <span className="text-muted-foreground">
                {data?.total.toLocaleString("en-IN")} fabric{data?.total === 1 ? "" : "s"}
              </span>
              <span className="font-semibold tabular-nums">
                {(data?.total ?? 0) > rows.length ? "This page " : "Total "}
                {formatMoney(rows.reduce((sum, fabric) => sum + fabric.stockValue, 0))}
              </span>
            </div>
          )}
        />

        {dialog?.kind === "form" ? (
          <FabricFormDialog key={dialog.key} fabric={dialog.fabric} open onOpenChange={close} />
        ) : null}
        {dialog?.kind === "adjust" ? (
          <AdjustStockDialog key={dialog.key} fabric={dialog.fabric} open onOpenChange={close} />
        ) : null}
        {dialog?.kind === "purchase" ? (
          <InwardFormDialog key={dialog.key} defaultFabricId={dialog.fabric.id} open onOpenChange={close} />
        ) : null}
        {dialog?.kind === "import" ? <FabricImportDialog key={dialog.key} open onOpenChange={close} /> : null}
      </div>
    </FabricPage>
  );
}
