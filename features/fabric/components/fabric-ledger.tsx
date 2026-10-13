"use client";

import { ScrollText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/states";
import { StatusChip, type StatusTone } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { ApiError } from "@/lib/api-client";
import { downloadServerCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

import { useFabric, useFabricOptions, useMovements } from "../hooks/use-fabric";
import {
  formatDate,
  formatMoney,
  formatNumber,
  formatQty,
  inwardNumber,
  MOVEMENT_LABEL,
  stockState,
  UNIT_LABEL,
  UNIT_NAME,
} from "../lib/format";
import type { Fabric, Movement, MovementType } from "../types/fabric.types";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { FabricCombobox } from "./fabric-combobox";
import { FabricPage } from "./fabric-page";
import { InwardFormDialog } from "./inward-form-dialog";

const TYPE_TONE: Record<MovementType, StatusTone> = {
  PURCHASE_IN: "success",
  PURCHASE_REVERSAL: "danger",
  ADJUSTMENT_IN: "info",
  ADJUSTMENT_OUT: "warning",
};

function Reference({ movement }: { movement: Movement }) {
  const { inward } = movement;
  if (!inward) return <span className="line-clamp-2 whitespace-normal">{movement.reason ?? "—"}</span>;
  const number = inwardNumber(inward.number);
  return (
    <>
      <Link
        href={`/fabric/purchases?q=${number}`}
        onClick={(event) => event.stopPropagation()}
        className="font-mono text-xs text-link hover:underline"
      >
        {number}
      </Link>
      <p className="line-clamp-1 text-xs whitespace-normal text-muted-foreground">
        {movement.type === "PURCHASE_REVERSAL"
          ? movement.reason
          : [inward.invoiceRef, inward.supplier].filter(Boolean).join(" · ") || "Purchase"}
      </p>
    </>
  );
}

const COLUMNS: DataColumn<Movement>[] = [
  {
    id: "date",
    header: "Date",
    className: "hidden sm:table-cell",
    sortable: true,
    filter: { type: "date" },
    skeleton: { width: "w-20" },
    csv: (movement) => movement.date,
    cell: (movement) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(movement.date)}</span>,
  },
  {
    id: "type",
    header: "Movement",
    sortable: true,
    hideable: false,
    filter: {
      type: "enum",
      options: (Object.keys(MOVEMENT_LABEL) as MovementType[]).map((value) => ({
        value,
        label: MOVEMENT_LABEL[value],
      })),
    },
    skeleton: { width: "w-20" },
    csv: (movement) => MOVEMENT_LABEL[movement.type],
    cell: (movement) => (
      <>
        <StatusChip tone={TYPE_TONE[movement.type]}>{MOVEMENT_LABEL[movement.type]}</StatusChip>
        <p className="mt-1 text-xs text-muted-foreground sm:hidden">{formatDate(movement.date)}</p>
      </>
    ),
  },
  {
    id: "fabricName",
    header: "Fabric",
    sortable: true,
    filter: { type: "text", placeholder: "Name or code contains…" },
    skeleton: { sub: true, width: "w-24" },
    csv: (movement) => `${movement.fabric.name} (${movement.fabric.code})`,
    cell: (movement) => (
      <>
        <p className="font-medium">{movement.fabric.name}</p>
        <p className="text-xs text-muted-foreground">{movement.fabric.code}</p>
      </>
    ),
  },
  {
    id: "reference",
    header: "Reference",
    className: "hidden max-w-64 md:table-cell",
    skeleton: { sub: true, width: "w-16" },
    csv: (movement) => (movement.inward ? inwardNumber(movement.inward.number) : movement.reason),
    cell: (movement) => <Reference movement={movement} />,
  },
  {
    id: "colorRoll",
    header: "Colour / roll",
    className: "hidden lg:table-cell",
    sortable: true,
    filter: { type: "text", placeholder: "Colour or roll contains…" },
    skeleton: { sub: true, width: "w-14" },
    csv: (movement) => [movement.color, movement.rollRef].filter(Boolean).join(" / "),
    cell: (movement) =>
      movement.color || movement.rollRef ? (
        <>
          <p>{movement.color ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{movement.rollRef ?? ""}</p>
        </>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "qtyIn",
    header: "In",
    align: "right",
    className: "hidden sm:table-cell",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-10" },
    csv: (movement) => movement.qtyIn || null,
    cell: (movement) =>
      movement.qtyIn ? (
        <span className="text-success">+{formatNumber(movement.qtyIn)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "qtyOut",
    header: "Out",
    align: "right",
    className: "hidden sm:table-cell",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-10" },
    csv: (movement) => movement.qtyOut || null,
    cell: (movement) =>
      movement.qtyOut ? (
        <span className="text-destructive">−{formatNumber(movement.qtyOut)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    // Phones: one signed quantity with the balance underneath, instead of In/Out/Balance.
    id: "qty",
    header: "Qty",
    align: "right",
    className: "sm:hidden",
    hideable: false,
    skeleton: { sub: true, width: "w-14" },
    cell: (movement) => (
      <span className={cn("whitespace-nowrap", movement.qtyIn ? "text-success" : "text-destructive")}>
        {movement.qtyIn ? "+" : "−"}
        {formatQty(movement.qtyIn || movement.qtyOut, movement.fabric.unit)}
        <span className="block text-xs text-muted-foreground">
          Bal. {formatQty(movement.balance, movement.fabric.unit)}
        </span>
      </span>
    ),
  },
  {
    id: "balance",
    header: "Balance",
    align: "right",
    className: "hidden sm:table-cell",
    skeleton: { width: "w-16" },
    csv: (movement) => `${movement.balance} ${UNIT_LABEL[movement.fabric.unit]}`,
    cell: (movement) => (
      <span className="font-medium whitespace-nowrap">{formatQty(movement.balance, movement.fabric.unit)}</span>
    ),
  },
  {
    id: "createdBy",
    header: "By",
    className: "hidden xl:table-cell",
    sortable: true,
    filter: { type: "text", placeholder: "Name contains…" },
    skeleton: { width: "w-20" },
    csv: (movement) => movement.createdBy,
    cell: (movement) => <span className="text-muted-foreground">{movement.createdBy ?? "—"}</span>,
  },
];

function TilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="grid gap-1.5">
          <Skeleton className="h-3 w-20 opacity-70" />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  );
}

function FabricHeaderSkeleton() {
  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4 sm:p-5" aria-hidden>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-52 opacity-70" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      <TilesSkeleton />
    </div>
  );
}

function Tile({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-base font-semibold tabular-nums", className)}>{value}</span>
    </div>
  );
}

function FabricHeader({
  fabric,
  onPurchase,
  onAdjust,
}: {
  fabric: Fabric;
  onPurchase?: () => void;
  onAdjust?: () => void;
}) {
  const state = stockState(fabric);
  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold">{fabric.name}</h2>
          <p className="text-[13px] text-muted-foreground">
            {fabric.code} · {UNIT_NAME[fabric.unit]}
          </p>
        </div>
        <div className="flex gap-2">
          {onAdjust ? (
            <Button variant="outline" size="sm" onClick={onAdjust}>
              Adjust stock
            </Button>
          ) : null}
          {onPurchase ? (
            <Button size="sm" onClick={onPurchase}>
              Record purchase
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tile
          label="In stock now"
          value={formatQty(fabric.balance, fabric.unit)}
          className={cn(state === "low" && "text-warning", state === "out" && "text-destructive")}
        />
        <Tile
          label="Reorder at"
          value={fabric.lowStockThreshold === null ? "Not set" : formatQty(fabric.lowStockThreshold, fabric.unit)}
        />
        <Tile
          label="Avg purchase rate"
          value={fabric.avgRate === null ? "—" : `${formatMoney(fabric.avgRate)}/${UNIT_LABEL[fabric.unit]}`}
        />
        <Tile label="Stock value" value={formatMoney(fabric.stockValue)} />
      </div>
    </div>
  );
}

export function FabricLedger() {
  const { data: user } = useCurrentUser();
  const fabrics = useFabricOptions();
  // `fabric` (the picked fabric's id) is the page's own URL key; links point here with it.
  const table = useDataTableState(COLUMNS, ["fabric"]);
  const { fabric: fabricId, ...columnParams } = table.params;
  const params = fabricId ? { ...columnParams, fabricId } : columnParams;
  const detail = useFabric(fabricId);
  // A stale or hand-edited link: the id is malformed (400) or no longer exists (404).
  const notFound =
    detail.error instanceof ApiError && (detail.error.code === "NOT_FOUND" || detail.error.code === "VALIDATION_ERROR");
  const movements = useMovements({ ...params, page: table.page, pageSize: table.pageSize });
  const [dialog, setDialog] = useState<{ kind: "adjust" | "purchase"; key: number } | null>(null);

  const fabric = detail.data;
  const columns = fabricId ? COLUMNS.filter((column) => column.id !== "fabricName") : COLUMNS;
  const data = movements.data;
  const summary = data?.summary;
  const from = table.filters.dateFrom;
  const to = table.filters.dateTo;
  const period = from || to ? `${from ? formatDate(from) : "Start"} – ${to ? formatDate(to) : "today"}` : "All time";
  const pickedName = fabrics.data?.find((option) => option.id === fabricId)?.name;

  return (
    <FabricPage
      title="Stock & Ledger"
      description="Every stock movement with its running balance. Entries are never edited or deleted; corrections are new entries."
    >
      <div className="grid gap-4">
        {fabricId && detail.isPending ? <FabricHeaderSkeleton /> : null}
        {notFound ? (
          <div className="rounded-lg border bg-card">
            <EmptyState
              icon={ScrollText}
              title="This fabric could not be found"
              description="It may have been removed, or the link is incomplete."
              action={
                <Button variant="outline" size="sm" onClick={() => table.setFilters({ fabric: "" })}>
                  Show all fabrics
                </Button>
              }
            />
          </div>
        ) : null}
        {fabric ? (
          <FabricHeader
            fabric={fabric}
            onPurchase={
              hasPermission(user, "fabric.inward") ? () => setDialog({ kind: "purchase", key: Date.now() }) : undefined
            }
            onAdjust={
              hasPermission(user, "fabric.adjust") ? () => setDialog({ kind: "adjust", key: Date.now() }) : undefined
            }
          />
        ) : null}

        {fabricId && !summary && movements.isPending && !notFound ? (
          <div className="rounded-lg border bg-card" aria-hidden>
            <div className="border-b px-4 py-2.5">
              <Skeleton className="h-3 w-16 opacity-70" />
            </div>
            <div className="p-4 sm:p-5">
              <TilesSkeleton />
            </div>
          </div>
        ) : null}
        {fabric && summary ? (
          <section aria-label={`Movement summary, ${period}`} className="rounded-lg border bg-card">
            <p className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">{period}</p>
            <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 sm:p-5">
              <Tile label="Opening" value={formatQty(summary.opening, fabric.unit)} />
              <Tile
                label="Received"
                value={summary.totalIn ? `+${formatQty(summary.totalIn, fabric.unit)}` : formatQty(0, fabric.unit)}
                className={cn(summary.totalIn > 0 && "text-success")}
              />
              <Tile
                label="Issued / reduced"
                value={summary.totalOut ? `−${formatQty(summary.totalOut, fabric.unit)}` : formatQty(0, fabric.unit)}
                className={cn(summary.totalOut > 0 && "text-destructive")}
              />
              <Tile label="Closing" value={formatQty(summary.closing, fabric.unit)} />
            </div>
          </section>
        ) : null}

        {notFound ? null : (
          <DataTable
            id="fabric-ledger"
            columns={columns}
            rows={data?.movements}
            rowId={(movement) => movement.id}
            total={data?.total}
            state={table}
            isFetching={movements.isFetching}
            isPlaceholderData={movements.isPlaceholderData}
            error={movements.error}
            onRetry={() => void movements.refetch()}
            searchLabel="Search movements"
            searchPlaceholder="Search fabric, colour, roll, reason…"
            isEmpty={Object.keys(columnParams).length === 0}
            empty={{
              icon: ScrollText,
              title: fabric ? `No stock movements for ${fabric.name} yet` : "No stock movements yet",
              description: "Purchases, reversals and adjustments appear here with a running balance.",
            }}
            toolbarStart={
              <FabricCombobox
                aria-label="Fabric"
                placeholder="All fabrics"
                fabrics={fabrics.data ?? []}
                value={fabricId ?? ""}
                onChange={(next) => table.setFilters({ fabric: next })}
                clearable
                className="w-full sm:w-64"
              />
            }
            extraFilters={
              fabricId
                ? [
                    {
                      label: "Fabric",
                      value: pickedName ?? "Selected fabric",
                      onClear: () => table.setFilters({ fabric: "" }),
                    },
                  ]
                : []
            }
            onExport={() => downloadServerCsv("/fabrics/movements/export", params)}
            exportName="fabric-ledger"
            bulkActions={() => null}
            rowActions={(movement) => (
              <>
                {fabricId ? null : (
                  <DropdownMenuItem onClick={() => table.setFilters({ fabric: movement.fabric.id })}>
                    Show only {movement.fabric.name}
                  </DropdownMenuItem>
                )}
                {movement.inward ? (
                  <DropdownMenuItem
                    render={<Link href={`/fabric/purchases?q=${inwardNumber(movement.inward.number)}`} />}
                  >
                    Open purchase {inwardNumber(movement.inward.number)}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem render={<Link href={`/fabric?q=${movement.fabric.code}`} />}>
                  Open in Fabric Master
                </DropdownMenuItem>
              </>
            )}
          />
        )}

        {fabric && dialog?.kind === "adjust" ? (
          <AdjustStockDialog key={dialog.key} fabric={fabric} open onOpenChange={() => setDialog(null)} />
        ) : null}
        {fabric && dialog?.kind === "purchase" ? (
          <InwardFormDialog key={dialog.key} defaultFabricId={fabric.id} open onOpenChange={() => setDialog(null)} />
        ) : null}
      </div>
    </FabricPage>
  );
}
