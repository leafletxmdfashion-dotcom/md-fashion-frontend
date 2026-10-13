"use client";

import { ArrowDownToLine, ArrowUpFromLine, History, Package, ScrollText, Wallet } from "lucide-react";
import Link from "next/link";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/states";
import { StatCard, StatCardSkeleton } from "@/components/stat-card";
import { StatusChip, type StatusTone } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-client";
import { downloadServerCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

import { useFabric, useFabricList, useFabricOptions, useMovements } from "../hooks/use-fabric";
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
import type { Fabric, FabricUnit, Movement, MovementPage, MovementType } from "../types/fabric.types";
import { FabricCombobox } from "./fabric-combobox";
import { FabricPage } from "./fabric-page";

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

const STOCK_TONE = { ok: "default", low: "warning", out: "danger" } as const;

/** "+120 kg · +40 m": one figure per unit present, since kilograms and metres never add up. */
function perUnit(byUnit: MovementPage["byUnit"], pick: "in" | "out", sign: string): string {
  const parts = (Object.keys(UNIT_LABEL) as FabricUnit[])
    .filter((unit) => byUnit[unit]?.[pick])
    .map((unit) => `${sign}${formatQty(byUnit[unit]![pick], unit)}`);
  return parts.length ? parts.join(" · ") : "0";
}

/**
 * The page's headline figures. One fabric: its stock movement over the period
 * (opening → received → issued → closing). All fabrics: activity under the
 * current filters plus today's stock value.
 */
function LedgerStats({
  fabricId,
  fabric,
  data,
  period,
  to,
  refreshing,
  failed,
}: {
  fabricId: string | undefined;
  fabric: Fabric | undefined;
  data: MovementPage | undefined;
  period: string;
  to: string | undefined;
  /** Figures still belong to the previous filters while new ones load. */
  refreshing: boolean;
  /** The ledger failed to load: the table shows the error and its retry; no figures to show. */
  failed: boolean;
}) {
  const grid = cn("grid grid-cols-2 gap-3 transition-opacity lg:grid-cols-4", refreshing && "opacity-60");
  const stock = useFabricList({ page: 1, pageSize: 1 }).data?.summary;
  if (failed && !data) return null;

  if (fabricId) {
    const summary = data?.summary;
    if (!fabric || !summary) return <StatsSkeleton label={`Movement summary, ${period}`} heading />;
    const state = stockState(fabric);
    const reorder =
      fabric.lowStockThreshold === null ? "" : ` · reorder at ${formatQty(fabric.lowStockThreshold, fabric.unit)}`;
    return (
      <section aria-label={`Movement summary, ${period}`} aria-busy={refreshing} className="grid gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 className="text-base font-semibold">{fabric.name}</h2>
          <span className="text-[13px] text-muted-foreground">
            {fabric.code} · {UNIT_NAME[fabric.unit]}
          </span>
        </div>
        <div className={grid}>
          <StatCard label="Opening" icon={History} value={formatQty(summary.opening, fabric.unit)} context={period} />
          <StatCard
            label="Received"
            icon={ArrowDownToLine}
            value={summary.totalIn ? `+${formatQty(summary.totalIn, fabric.unit)}` : formatQty(0, fabric.unit)}
            context="Purchases, additions"
          />
          <StatCard
            label="Issued / reduced"
            icon={ArrowUpFromLine}
            value={summary.totalOut ? `−${formatQty(summary.totalOut, fabric.unit)}` : formatQty(0, fabric.unit)}
            context="Reversals, reductions"
          />
          <StatCard
            label={to ? "Closing" : "In stock now"}
            icon={Package}
            value={formatQty(summary.closing, fabric.unit)}
            tone={to ? "default" : STOCK_TONE[state]}
            context={to ? `On ${formatDate(to)}` : `Worth ${formatMoney(fabric.stockValue)}${reorder}`}
          />
        </div>
      </section>
    );
  }

  if (!data || !stock) return <StatsSkeleton label="Ledger summary" />;
  return (
    <section aria-label="Ledger summary" aria-busy={refreshing} className={grid}>
      <StatCard label="Movements" icon={ScrollText} value={formatNumber(data.total)} context={period} />
      <StatCard
        label="Received"
        icon={ArrowDownToLine}
        value={perUnit(data.byUnit, "in", "+")}
        context="Purchases, additions"
      />
      <StatCard
        label="Issued / reduced"
        icon={ArrowUpFromLine}
        value={perUnit(data.byUnit, "out", "−")}
        context="Reversals, reductions"
      />
      <StatCard
        label="Stock value"
        icon={Wallet}
        value={formatMoney(stock.stockValue)}
        context={
          stock.reorder > 0
            ? `${stock.reorder} fabric${stock.reorder === 1 ? "" : "s"} need reorder`
            : `${stock.fabrics} fabric${stock.fabrics === 1 ? "" : "s"}, none need reorder`
        }
        href={stock.reorder > 0 ? "/fabric?stock=low" : "/fabric"}
      />
    </section>
  );
}

function StatsSkeleton({ label, heading = false }: { label: string; heading?: boolean }) {
  return (
    <div aria-label={label} aria-busy className="grid gap-3">
      {heading ? <Skeleton className="h-5 w-56" /> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export function FabricLedger() {
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

  const fabric = detail.data;
  const columns = fabricId ? COLUMNS.filter((column) => column.id !== "fabricName") : COLUMNS;
  const data = movements.data;
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
        ) : (
          <LedgerStats
            fabricId={fabricId}
            fabric={fabric}
            data={data}
            period={period}
            to={to}
            refreshing={movements.isPlaceholderData}
            failed={movements.isError}
          />
        )}

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
      </div>
    </FabricPage>
  );
}
