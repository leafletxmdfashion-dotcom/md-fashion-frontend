"use client";

import { Layers, Plus, RotateCcw, Shirt, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { Page } from "@/components/page-header";
import { StatCard, StatCardSkeleton } from "@/components/stat-card";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequirePermission } from "@/features/auth/components/require-permission";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { formatDate } from "@/features/fabric/lib/format";
import { moneyText } from "@/features/production/lib/format";
import { cn } from "@/lib/utils";

import { useIssues, useLotBalance, useRework, useTeams } from "../hooks/use-stitching";
import { issueNumber } from "../lib/format";
import type { IssueListItem } from "../types/stitching.types";
import { IssueDialog } from "./issue-dialog";
import { IssueSheet } from "./issue-sheet";

const COLUMNS: DataColumn<IssueListItem>[] = [
  {
    id: "date",
    header: "Date",
    className: "hidden sm:table-cell",
    sortable: true,
    filter: { type: "date" },
    skeleton: { width: "w-20" },
    cell: (issue) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(issue.date)}</span>,
  },
  {
    id: "number",
    header: "No.",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-14" },
    cell: (issue) => <span className="font-mono text-xs">{issueNumber(issue.number)}</span>,
  },
  {
    id: "lot",
    header: "Lot",
    sortable: true,
    hideable: false,
    filter: { type: "text", placeholder: "Lot or item contains…" },
    skeleton: { sub: true, width: "w-24" },
    cell: (issue) => (
      <>
        <p className="font-medium">{issue.lot.lotNumber}</p>
        <p className="text-xs text-muted-foreground">{issue.lot.articleName}</p>
        <p className="text-xs text-muted-foreground sm:hidden">
          {issue.team.name} · <span className="font-medium text-foreground">{issue.wip}</span> with team
        </p>
      </>
    ),
  },
  {
    id: "team",
    header: "Jogadi",
    className: "hidden sm:table-cell",
    sortable: true,
    filter: { type: "text", placeholder: "Team contains…" },
    skeleton: { sub: true, width: "w-24" },
    cell: (issue) => (
      <>
        <p>{issue.team.name}</p>
        <p className="text-xs text-muted-foreground">
          {issue.operation}
          {issue.rate !== null ? ` · ${moneyText(issue.rate)}/pc` : ""}
        </p>
      </>
    ),
  },
  {
    id: "issued",
    header: "Issued",
    align: "right",
    className: "hidden md:table-cell",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-10" },
    cell: (issue) => <span className="tabular-nums">{issue.issued}</span>,
  },
  {
    id: "wip",
    header: "With team",
    align: "right",
    className: "hidden sm:table-cell",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-10" },
    cell: (issue) => (
      <span className={cn("font-medium tabular-nums", issue.wip === 0 && "text-muted-foreground")}>{issue.wip}</span>
    ),
  },
  {
    id: "status",
    header: "Status",
    className: "hidden sm:table-cell",
    sortable: true,
    filter: {
      type: "enum",
      options: [
        { value: "open", label: "With team" },
        { value: "done", label: "Done" },
        { value: "reversed", label: "Reversed" },
      ],
    },
    skeleton: { width: "w-16" },
    cell: (issue) =>
      issue.status === "REVERSED" ? (
        <StatusChip tone="danger">Reversed</StatusChip>
      ) : issue.wip > 0 ? (
        <StatusChip tone="warning">With team</StatusChip>
      ) : (
        <StatusChip tone="success">Done</StatusChip>
      ),
  },
];

/** Where every piece of one lot is, per colour and size. */
function LotBalancePanel({ lotId, onClear }: { lotId: string; onClear: () => void }) {
  const balance = useLotBalance(lotId);
  const data = balance.data;

  if (!data) return balance.isError ? null : <StatCardSkeleton />;

  const columns = ["cut", "unissued", "wip", "good", "rework", "reject"] as const;

  const LABEL: Record<(typeof columns)[number], string> = {
    cut: "Cut",
    unissued: "Waiting",
    wip: "With teams",
    good: "Good",
    rework: "Rework",
    reject: "Reject",
  };

  return (
    <section aria-label={`${data.lot.lotNumber} balance`} className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-[15px] font-semibold">
          {data.lot.lotNumber} <span className="font-normal text-muted-foreground">· {data.lot.articleName}</span>
        </h2>
        <Button variant="ghost" size="sm" onClick={onClear}>
          All lots
        </Button>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-[13px]">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Size</th>
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 text-right font-medium">
                  {LABEL[column]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.rows.map((row) => (
              <tr key={row.size}>
                <td className="px-4 py-1.5 font-medium">{row.size}</td>
                {columns.map((column) => (
                  <td
                    key={column}
                    className={cn("px-3 py-1.5 text-right tabular-nums", row[column] === 0 && "text-muted-foreground")}
                  >
                    {row[column]}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-4 py-2">Total</td>
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 text-right tabular-nums">
                  {data.totals[column]}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function StitchingPage() {
  const { data: user } = useCurrentUser();
  const table = useDataTableState(COLUMNS, ["team", "lotId"]);
  const { team, lotId, ...columnParams } = table.params;
  const params = { ...columnParams, teamId: team, lotId };
  const issues = useIssues({ ...params, page: table.page, pageSize: table.pageSize });
  const teams = useTeams();
  const rework = useRework({ page: 1, pageSize: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(0);
  const canIssue = hasPermission(user, "stitching.issue");

  const data = issues.data;

  const teamItems = [
    { value: "", label: "All teams" },
    ...(teams.data ?? []).map((item) => ({ value: item.id, label: item.name })),
  ];

  const pickedTeam = teams.data?.find((item) => item.id === team);

  return (
    <RequirePermission permission="stitching.view" title="Stitching">
      <Page
        title="Stitching"
        description="Cut pieces issued to Jogadi teams, and what came back: Good, Rework and Reject."
        actions={
          canIssue ? (
            <Button onClick={() => setIssuing(Date.now())}>
              <Plus aria-hidden />
              Issue to Jogadi
            </Button>
          ) : null
        }
      >
        <div className="grid gap-4">
          {!data ? (
            issues.isError ? null : (
              <div className="grid gap-3 sm:grid-cols-3" aria-hidden>
                {Array.from({ length: 3 }, (_, index) => (
                  <StatCardSkeleton key={index} />
                ))}
              </div>
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="With teams"
                icon={Shirt}
                value={data.summary.wip.toLocaleString("en-IN")}
                context={`pieces in ${data.summary.open} open issue${data.summary.open === 1 ? "" : "s"}`}
                onClick={() => table.setFilters({ status: "open" })}
              />
              <StatCard
                label="Rework pending"
                icon={RotateCcw}
                value={(rework.data?.pending ?? 0).toLocaleString("en-IN")}
                tone={(rework.data?.pending ?? 0) > 0 ? "warning" : "default"}
                context="pieces to fix"
                href="/rework"
              />
              <StatCard
                label="Jogadi teams"
                icon={UsersRound}
                value={String(teams.data?.filter((item) => item.active).length ?? 0)}
                context="active"
                href="/jogadi"
              />
            </div>
          )}

          {lotId ? <LotBalancePanel lotId={lotId} onClear={() => table.setFilters({ lotId: "" })} /> : null}

          <DataTable
            id="stitching-issues"
            columns={COLUMNS}
            rows={data?.issues}
            rowId={(issue) => issue.id}
            total={data?.total}
            state={table}
            isFetching={issues.isFetching}
            isPlaceholderData={issues.isPlaceholderData}
            error={issues.error}
            onRetry={() => void issues.refetch()}
            searchLabel="Search stitching issues"
            searchPlaceholder="Search lot, team, work, SI-no…"
            isEmpty={Object.keys(table.params).length === 0}
            empty={{
              icon: Layers,
              title: "Nothing issued for stitching yet",
              description: canIssue
                ? "Issue finalized cut pieces to a Jogadi team. Create teams first in Jogadi Teams."
                : "Issues to Jogadi teams appear here.",
            }}
            toolbarStart={
              <Select
                items={teamItems}
                value={team ?? ""}
                onValueChange={(value) => table.setFilters({ team: value ?? "" })}
              >
                <SelectTrigger className="w-full sm:w-48" aria-label="Filter by team">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teamItems.map((item) => (
                    <SelectItem key={item.value || "all"} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
            extraFilters={[
              ...(team
                ? [
                    {
                      label: "Team",
                      value: pickedTeam?.name ?? "Selected team",
                      onClear: () => table.setFilters({ team: "" }),
                    },
                  ]
                : []),
              ...(lotId
                ? [{ label: "Lot", value: "Selected lot", onClear: () => table.setFilters({ lotId: "" }) }]
                : []),
            ]}
            exportPath="/stitching/issues/export"
            exportParams={params}
            onRowClick={(issue) => setSelected(issue.id)}
            rowActions={(issue) => (
              <>
                <DropdownMenuItem onClick={() => setSelected(issue.id)}>View and receive</DropdownMenuItem>
                <DropdownMenuItem onClick={() => table.setFilters({ lotId: issue.lot.id })}>
                  Show where {issue.lot.lotNumber}&apos;s pieces are
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href={`/rework?q=${encodeURIComponent(issue.lot.lotNumber)}`} />}>
                  Rework of {issue.lot.lotNumber}
                </DropdownMenuItem>
              </>
            )}
          />
        </div>

        {issuing ? (
          <IssueDialog
            key={issuing}
            defaultLotId={lotId}
            defaultTeamId={team}
            onOpenChange={(open) => (open ? undefined : setIssuing(0))}
            onIssued={setSelected}
          />
        ) : null}
        <IssueSheet issueId={selected} onOpenChange={(open) => (open ? undefined : setSelected(null))} />
      </Page>
    </RequirePermission>
  );
}
