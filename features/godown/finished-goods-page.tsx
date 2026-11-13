"use client";

import { Boxes, CheckCircle2, Layers, PackageCheck, Scissors, XCircle } from "lucide-react";
import Link from "next/link";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { Page } from "@/components/page-header";
import { StatCard, StatCardSkeleton } from "@/components/stat-card";
import { StatusChip, type StatusTone } from "@/components/status-chip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirePermission } from "@/features/auth/components/require-permission";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { formatDate } from "@/features/fabric/lib/format";
import { MergeItemsButton } from "@/features/production/components/item-tools";
import { useUrlFilters } from "@/hooks/use-url-filters";

import { cn } from "@/lib/utils";

import { useFinishedItems, useFinishedLots, type FinishedItem, type FinishedLot, type LotStage } from "./godown.api";

const STAGE: Record<LotStage, { label: string; tone: StatusTone }> = {
  production: { label: "In production", tone: "info" },
  packing: { label: "To pack", tone: "warning" },
  done: { label: "Finished", tone: "success" },
};

const n = (value: number) => value.toLocaleString("en-IN");

const LOT_COLUMNS: DataColumn<FinishedLot>[] = [
  {
    id: "date",
    header: "Date",
    sortable: true,
    filter: { type: "date" },
    skeleton: { width: "w-20" },
    cell: (row) => <span className="whitespace-nowrap">{formatDate(row.productionDate)}</span>,
  },
  {
    id: "lot",
    header: "Lot",
    sortable: true,
    hideable: false,
    filter: { type: "text", placeholder: "Lot contains…" },
    skeleton: { width: "w-20" },
    cell: (row) => <span className="font-mono font-medium">{row.lotNumber}</span>,
  },
  {
    id: "item",
    header: "Item / design",
    sortable: true,
    filter: { type: "text", placeholder: "Item contains…" },
    skeleton: { width: "w-28" },
    cell: (row) => row.article.name,
  },
  {
    id: "cut",
    header: "Cut",
    align: "right",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-10" },
    cell: (row) => <span className="tabular-nums">{n(row.cut)}</span>,
  },
  {
    id: "good",
    header: "Good",
    align: "right",
    sortable: true,
    filter: { type: "number" },
    skeleton: { sub: true, width: "w-10" },
    cell: (row) => (
      <>
        <p className="tabular-nums">{n(row.good)}</p>
        {row.reject || row.rework ? (
          <p className="text-xs text-muted-foreground">
            {row.reject ? `${row.reject} rejected` : ""}
            {row.reject && row.rework ? " · " : ""}
            {row.rework ? `${row.rework} in rework` : ""}
          </p>
        ) : null}
      </>
    ),
  },
  {
    id: "packed",
    header: "Packed",
    align: "right",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-10" },
    cell: (row) => <span className="font-semibold tabular-nums">{n(row.packed)}</span>,
  },
  {
    id: "toPack",
    header: "To pack",
    align: "right",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-10" },
    cell: (row) => (
      <span className={row.toPack > 0 ? "font-medium text-warning tabular-nums" : "text-muted-foreground tabular-nums"}>
        {n(row.toPack)}
      </span>
    ),
  },
  {
    id: "stage",
    header: "Stage",
    filter: {
      type: "enum",
      // SAFETY: STAGE is keyed by exactly the LotStage values.
      options: (Object.keys(STAGE) as LotStage[]).map((value) => ({
        value,
        label: STAGE[value].label,
      })),
    },
    skeleton: { sub: true, width: "w-20" },
    cell: (row) => (
      <>
        <StatusChip tone={STAGE[row.stage].tone}>{STAGE[row.stage].label}</StatusChip>
        {row.stage === "production" ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[row.unissued ? `${row.unissued} to issue` : "", row.wip ? `${row.wip} with teams` : ""]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : row.lastPacked ? (
          <p className="mt-0.5 text-xs text-muted-foreground">Last packed {formatDate(row.lastPacked)}</p>
        ) : null}
      </>
    ),
  },
];

function LotTable({ tabs }: { tabs: React.ReactNode }) {
  const table = useDataTableState(LOT_COLUMNS);
  const lots = useFinishedLots({
    ...table.params,
    page: table.page,
    pageSize: table.pageSize,
  });
  const summary = lots.data?.summary;

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {summary ? (
          <>
            <StatCard label="Lots" icon={Layers} value={n(summary.lots)} context="Matching the filters" />
            <StatCard label="Pieces cut" icon={Scissors} value={n(summary.cut)} />
            <StatCard
              label="Good pieces"
              icon={CheckCircle2}
              value={n(summary.good)}
              context={summary.cut ? `${Math.round((summary.good / summary.cut) * 100)}% of cut` : undefined}
              tone="success"
            />
            <StatCard
              label="Packed"
              icon={PackageCheck}
              value={n(summary.packed)}
              context={`${n(summary.toPack)} still to pack`}
              href="/packing"
            />
            <StatCard
              label="Rejected"
              icon={XCircle}
              value={n(summary.reject)}
              context={`${n(summary.inProduction)} still in production`}
              tone={summary.reject ? "danger" : "default"}
              href="/rework?tab=rejects"
            />
          </>
        ) : (
          Array.from({ length: 5 }, (_, index) => <StatCardSkeleton key={index} />)
        )}
      </div>
      {tabs}
      <DataTable
        id="finished-lots"
        columns={LOT_COLUMNS}
        rows={lots.data?.lots}
        rowId={(row) => row.id}
        total={lots.data?.total}
        state={table}
        isFetching={lots.isFetching}
        isPlaceholderData={lots.isPlaceholderData}
        error={lots.error}
        onRetry={() => void lots.refetch()}
        searchLabel="Search lots"
        searchPlaceholder="Search lot or item…"
        isEmpty={Object.keys(table.params).length === 0}
        empty={{
          icon: Boxes,
          title: "No finished goods yet",
          description: "Every lot appears here once its cutting is finalized, through stitching and packing.",
        }}
        exportPath="/godown/finished-goods/export"
      />
    </div>
  );
}

const ITEM_COLUMNS: DataColumn<FinishedItem>[] = [
  {
    id: "item",
    header: "Item / design",
    sortable: true,
    hideable: false,
    filter: { type: "text", placeholder: "Item or code contains…" },
    skeleton: { sub: true, width: "w-32" },
    cell: (row) => (
      <>
        <p className="font-medium">{row.articleName}</p>
        <p className="text-xs text-muted-foreground">{row.code}</p>
      </>
    ),
  },
  ...(
    [
      ["lots", "Lots"],
      ["cut", "Cut"],
      ["good", "Good"],
      ["reject", "Rejected"],
      ["packed", "Packed"],
      ["dispatched", "Dispatched"],
    ] as const
  ).map(([key, header]): DataColumn<FinishedItem> => ({
    id: key,
    header,
    align: "right",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-10" },
    cell: (row) => (
      <span className={cn("tabular-nums", key === "reject" && "text-muted-foreground")}>{n(row[key])}</span>
    ),
  })),
  {
    id: "inStock",
    header: "In godown",
    align: "right",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-10" },
    cell: (row) => (
      <Link href="/godown" className="font-semibold tabular-nums hover:underline">
        {n(row.inStock)}
      </Link>
    ),
  },
];

function ItemTable({ tabs }: { tabs: React.ReactNode }) {
  const table = useDataTableState(ITEM_COLUMNS);
  // Search, filters and sort run on the server; the cards add up everything that matches.
  const items = useFinishedItems({ ...table.params, page: table.page, pageSize: table.pageSize });
  const data = items.data;
  const sum = (key: keyof NonNullable<typeof data>["totals"]) => data?.totals[key] ?? 0;

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {data ? (
          <>
            <StatCard label="Items" icon={Boxes} value={n(data.total)} context="Matching the filters" />
            <StatCard label="Pieces cut" icon={Scissors} value={n(sum("cut"))} />
            <StatCard
              label="Good pieces"
              icon={CheckCircle2}
              value={n(sum("good"))}
              context={`${n(sum("reject"))} rejected`}
              tone="success"
            />
            <StatCard
              label="Dispatched"
              icon={PackageCheck}
              value={n(sum("dispatched"))}
              context={`${n(sum("packed"))} packed`}
            />
            <StatCard label="In godown" icon={Layers} value={n(sum("inStock"))} href="/godown" />
          </>
        ) : (
          Array.from({ length: 5 }, (_, index) => <StatCardSkeleton key={index} />)
        )}
      </div>
      {tabs}
      <DataTable
        id="finished-items"
        columns={ITEM_COLUMNS}
        rows={data?.items}
        rowId={(row) => row.id}
        total={data?.total}
        state={table}
        isFetching={items.isFetching}
        error={items.error}
        onRetry={() => void items.refetch()}
        searchLabel="Search items"
        searchPlaceholder="Search item or code…"
        isPlaceholderData={items.isPlaceholderData}
        isEmpty={data?.total === 0 && Object.keys(table.params).length === 0}
        empty={{ icon: Boxes, title: "No finished goods yet" }}
        exportPath="/godown/finished-goods/items/export"
      />
    </div>
  );
}

export function FinishedGoodsPage() {
  const { data: user } = useCurrentUser();
  const { filters, resetTo: setFilters } = useUrlFilters(["tab"]);
  const tab = filters.tab === "items" ? "items" : "lots";
  // Each view has its own figures; the tabs sit between them and the table, as on other pages.
  const tabs = (
    <Tabs value={tab} onValueChange={(value) => setFilters({ tab: value === "items" ? "items" : "" })}>
      <TabsList>
        <TabsTrigger value="lots">By lot</TabsTrigger>
        <TabsTrigger value="items">By item</TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <RequirePermission permission="godown.view" title="Finished Goods">
      <Page
        title="Finished Goods"
        description="Every lot from cutting through stitching to packing, and totals per item with what is dispatched and in the godown."
        actions={hasPermission(user, "production.manage") ? <MergeItemsButton /> : null}
      >
        {tab === "lots" ? <LotTable tabs={tabs} /> : <ItemTable tabs={tabs} />}
      </Page>
    </RequirePermission>
  );
}
