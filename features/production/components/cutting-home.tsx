"use client";

import { Layers, Plus, Scissors, Timer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { StatCard, StatCardSkeleton } from "@/components/stat-card";
import { StatusChip } from "@/components/status-chip";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { formatDate } from "@/features/fabric/lib/format";

import { useBatches, useLots } from "../hooks/use-production";
import { BATCH_STATUS, cutNumber, kgText } from "../lib/format";
import type { BatchListItem, BatchStatus } from "../types/production.types";
import { ButtonLink } from "./form-parts";
import { ProductionPage } from "./production-pages";

// SAFETY: the label map is a total Record over the union, so its keys are exactly the union members.
const BATCH_STATUS_OPTIONS = (Object.keys(BATCH_STATUS) as BatchStatus[]).map((value) => ({
  value,
  label: BATCH_STATUS[value].label,
}));

const BATCH_COLUMNS: DataColumn<BatchListItem>[] = [
  {
    id: "number",
    header: "Cutting no.",
    sortable: true,
    hideable: false,
    skeleton: { sub: true, width: "w-20" },
    csv: (batch) => cutNumber(batch.number),
    cell: (batch) => (
      <>
        <Link
          href={`/cutting/${batch.id}`}
          onClick={(event) => event.stopPropagation()}
          className="font-mono text-[13px] font-medium text-foreground hover:underline"
        >
          {cutNumber(batch.number)}
        </Link>
        <p className="text-xs text-muted-foreground">{formatDate(batch.cuttingDate)}</p>
      </>
    ),
  },
  {
    id: "lot",
    header: "Lot",
    sortable: true,
    filter: { type: "text", placeholder: "Lot or item contains…" },
    skeleton: { sub: true, width: "w-28" },
    csv: (batch) => `${batch.lot.lotNumber} ${batch.lot.articleName}`,
    cell: (batch) => (
      <>
        <p className="font-mono text-[13px] font-medium">{batch.lot.lotNumber}</p>
        <p className="text-xs text-muted-foreground">
          {batch.lot.articleName} · {batch.lot.fabricName}
        </p>
      </>
    ),
  },
  {
    id: "master",
    header: "Cutting master",
    className: "hidden lg:table-cell",
    sortable: true,
    filter: { type: "text", placeholder: "Name contains…" },
    skeleton: { width: "w-24" },
    csv: (batch) => batch.cuttingMaster,
    cell: (batch) => <span className="text-muted-foreground">{batch.cuttingMaster ?? "—"}</span>,
  },
  {
    id: "issued",
    header: "Issued",
    align: "right",
    className: "hidden md:table-cell",
    sortable: true,
    filter: { type: "number", unit: "kg" },
    skeleton: { width: "w-16" },
    csv: (batch) => batch.issuedKg,
    cell: (batch) => <span className="tabular-nums">{kgText(batch.issuedKg)}</span>,
  },
  {
    id: "pala",
    header: "Pala",
    align: "right",
    className: "hidden sm:table-cell",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-10" },
    csv: (batch) => batch.pala,
    cell: (batch) => <span className="tabular-nums">{batch.pala ?? "—"}</span>,
  },
  {
    id: "pieces",
    header: "Pieces",
    align: "right",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-10" },
    csv: (batch) => batch.acceptedPieces,
    cell: (batch) => <span className="font-medium tabular-nums">{batch.acceptedPieces ?? "—"}</span>,
  },
  {
    id: "wastage",
    header: "Wastage",
    align: "right",
    className: "hidden md:table-cell",
    sortable: true,
    filter: { type: "number", unit: "kg" },
    skeleton: { width: "w-16" },
    csv: (batch) => batch.wastageKg,
    cell: (batch) => <span className="tabular-nums text-muted-foreground">{kgText(batch.wastageKg)}</span>,
  },
  {
    id: "status",
    header: "Status",
    sortable: true,
    filter: { type: "enum", options: BATCH_STATUS_OPTIONS },
    skeleton: { width: "w-20" },
    csv: (batch) => BATCH_STATUS[batch.status].label,
    cell: (batch) => <StatusChip tone={BATCH_STATUS[batch.status].tone}>{BATCH_STATUS[batch.status].label}</StatusChip>,
  },
];

export function NewCuttingButton() {
  const { data: user } = useCurrentUser();

  return hasPermission(user, "production.manage") ? (
    <ButtonLink href="/cutting/new">
      <Plus aria-hidden />
      New cutting
    </ButtonLink>
  ) : null;
}

function Stats() {
  const lots = useLots({ page: 1, pageSize: 1 });
  const summary = lots.data?.summary;

  if (lots.isError) return null;

  if (!summary) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  const holding = summary.inCuttingKg.replace(/[0.]/g, "") !== "";

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Open cutting"
        icon={Scissors}
        value={String(summary.openBatches)}
        context="Drafts and fabric issued"
        href="/cutting?status=DRAFT,ISSUED"
      />
      <StatCard
        label="Pieces cut this month"
        value={summary.piecesThisMonth.toLocaleString("en-IN")}
        context="From finalized cutting"
        href="/cutting?status=FINALIZED"
      />
      <StatCard
        label="Fabric used this month"
        icon={Layers}
        value={kgText(summary.consumedKgThisMonth)}
        context={`${kgText(summary.wastageKgThisMonth)} wastage`}
      />
      <StatCard
        label="Fabric in cutting"
        icon={Timer}
        value={kgText(summary.inCuttingKg)}
        context="Issued, not yet finalized"
        tone={holding ? "warning" : "default"}
        href="/cutting?status=ISSUED"
      />
    </div>
  );
}

/** The Cutting page: figures, then every cutting with its lot. */
export function CuttingHome() {
  const router = useRouter();
  const table = useDataTableState(BATCH_COLUMNS);
  const list = useBatches({ ...table.params, page: table.page, pageSize: table.pageSize });
  const data = list.data;

  return (
    <ProductionPage
      title="Cutting"
      description="Every cutting with its lot, from draft to finalized pieces."
      actions={<NewCuttingButton />}
    >
      <div className="grid gap-5">
        <Stats />
        <DataTable
          id="cutting-batches"
          columns={BATCH_COLUMNS}
          rows={data?.batches}
          rowId={(batch) => batch.id}
          total={data?.total}
          state={table}
          isFetching={list.isFetching}
          isPlaceholderData={list.isPlaceholderData}
          error={list.error}
          onRetry={() => void list.refetch()}
          searchLabel="Search cutting"
          searchPlaceholder="Search cutting no., lot, item or master…"
          isEmpty={data !== undefined && data.total === 0 && !table.isFiltered}
          empty={{
            icon: Scissors,
            title: "No cutting yet",
            description: "Start with New cutting: type the lot number, the item and fabric, then the Thaan you cut.",
            action: <NewCuttingButton />,
          }}
          onRowClick={(batch) => router.push(`/cutting/${batch.id}`)}
          rowActions={(batch) => (
            <DropdownMenuItem render={<Link href={`/cutting/${batch.id}`} />}>Open cutting</DropdownMenuItem>
          )}
        />
      </div>
    </ProductionPage>
  );
}
