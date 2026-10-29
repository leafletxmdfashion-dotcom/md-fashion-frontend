"use client";

import { Ban, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { Field } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { Page } from "@/components/page-header";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirePermission } from "@/features/auth/components/require-permission";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { formatDate, todayISO } from "@/features/fabric/lib/format";
import { useKarigarOptions } from "@/features/production/hooks/use-production";
import { karigarCode } from "@/features/production/lib/format";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { ApiError } from "@/lib/api-client";

import { useRejectReasons, useRejects, useResolveRework, useRework, useUpdateRework } from "../hooks/use-stitching";
import { issueNumber, pieces, receiptNumber, REWORK_STATUS, reworkNumber } from "../lib/format";
import type { RejectRow, ReworkItem, ReworkStatus } from "../types/stitching.types";

const OPEN: ReworkStatus[] = ["PENDING", "ASSIGNED", "IN_PROGRESS"];

const REWORK_COLUMNS: DataColumn<ReworkItem>[] = [
  {
    id: "number",
    header: "No.",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-14" },
    csv: (item) => reworkNumber(item.number),
    cell: (item) => (
      <>
        <p className="font-mono text-xs">{reworkNumber(item.number)}</p>
        <p className="text-xs text-muted-foreground">{formatDate(item.createdAt.slice(0, 10))}</p>
      </>
    ),
  },
  {
    id: "lot",
    header: "Lot · piece",
    sortable: true,
    hideable: false,
    filter: { type: "text", placeholder: "Lot or item contains…" },
    skeleton: { sub: true, width: "w-28" },
    csv: (item) => `${item.lot.lotNumber} ${item.colour} ${item.sizeLabel}`,
    cell: (item) => (
      <>
        <p className="font-medium">
          {item.lot.lotNumber} · {item.colour} {item.sizeLabel}
        </p>
        <p className="text-xs text-muted-foreground">{item.lot.articleName}</p>
      </>
    ),
  },
  {
    id: "team",
    header: "From",
    className: "hidden md:table-cell",
    sortable: true,
    filter: { type: "text", placeholder: "Team contains…" },
    skeleton: { sub: true, width: "w-24" },
    csv: (item) => item.issue.teamName,
    cell: (item) => (
      <>
        <p>{item.issue.teamName}</p>
        <p className="text-xs text-muted-foreground">
          {issueNumber(item.issue.number)} · {receiptNumber(item.receiptNumber)}
          {item.assignedTo ? ` · with ${item.assignedTo.name}` : ""}
        </p>
      </>
    ),
  },
  {
    id: "pending",
    header: "To fix",
    align: "right",
    sortable: true,
    filter: { type: "number" },
    skeleton: { sub: true, width: "w-10" },
    csv: (item) => item.pending,
    cell: (item) => (
      <>
        <p className="font-medium tabular-nums">
          {item.pending} <span className="font-normal text-muted-foreground">of {item.quantity}</span>
        </p>
        {item.recovered || item.failed ? (
          <p className="text-xs text-muted-foreground">
            {item.recovered} fixed · {item.failed} failed
          </p>
        ) : null}
      </>
    ),
  },
  {
    id: "status",
    header: "Status",
    sortable: true,
    filter: {
      type: "enum",
      // SAFETY: REWORK_STATUS is keyed by exactly the ReworkStatus values.
      options: (Object.keys(REWORK_STATUS) as ReworkStatus[]).map((value) => ({
        value,
        label: REWORK_STATUS[value].label,
      })),
    },
    skeleton: { width: "w-16" },
    csv: (item) => REWORK_STATUS[item.status].label,
    cell: (item) => <StatusChip tone={REWORK_STATUS[item.status].tone}>{REWORK_STATUS[item.status].label}</StatusChip>,
  },
];

const REJECT_COLUMNS: DataColumn<RejectRow>[] = [
  {
    id: "date",
    header: "Date",
    sortable: true,
    filter: { type: "date" },
    skeleton: { width: "w-20" },
    csv: (row) => row.date,
    cell: (row) => (
      <>
        <p className="whitespace-nowrap">{formatDate(row.date)}</p>
        <p className="font-mono text-xs text-muted-foreground">{row.reference}</p>
      </>
    ),
  },
  {
    id: "lot",
    header: "Lot · piece",
    sortable: true,
    hideable: false,
    filter: { type: "text", placeholder: "Lot or item contains…" },
    skeleton: { sub: true, width: "w-28" },
    csv: (row) => `${row.lot.lotNumber} ${row.colour} ${row.sizeLabel}`,
    cell: (row) => (
      <>
        <p className="font-medium">
          {row.lot.lotNumber} · {row.colour} {row.sizeLabel}
        </p>
        <p className="text-xs text-muted-foreground">
          {row.lot.articleName} · {row.teamName}
        </p>
      </>
    ),
  },
  {
    id: "reason",
    header: "Reason",
    sortable: true,
    filter: { type: "text", placeholder: "Reason contains…" },
    skeleton: { width: "w-28" },
    csv: (row) => row.reason,
    cell: (row) => row.reason,
  },
  {
    id: "quantity",
    header: "Pieces",
    align: "right",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-10" },
    csv: (row) => row.quantity,
    cell: (row) => <span className="font-medium tabular-nums">{row.quantity}</span>,
  },
];

function AssignDialog({ item, onOpenChange }: { item: ReworkItem; onOpenChange: (open: boolean) => void }) {
  const karigars = useKarigarOptions();
  const update = useUpdateRework();
  const [assignee, setAssignee] = useState(item.assignedTo?.id ?? "");

  const items = [
    { value: "", label: "The team that stitched it" },
    ...(karigars.data ?? []).map((k) => ({ value: k.id, label: `${k.name} · ${karigarCode(k.number)}` })),
  ];

  const save = async (status: "ASSIGNED" | "IN_PROGRESS") => {
    try {
      await update.mutateAsync({ id: item.id, status, assignedToId: assignee || null });
      toast.success(`${reworkNumber(item.number)} ${status === "ASSIGNED" ? "assigned" : "started"}.`);
      onOpenChange(false);
    } catch {
      // Shown from the mutation's error.
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign {reworkNumber(item.number)}</DialogTitle>
          <DialogDescription>
            {pieces(item.pending)} of {item.lot.lotNumber} {item.colour} {item.sizeLabel} to fix.
          </DialogDescription>
        </DialogHeader>
        {update.error ? (
          <FormAlert>{update.error instanceof ApiError ? update.error.message : "Could not save."}</FormAlert>
        ) : null}
        <Field id="rework-assignee" label="Who fixes it">
          <Select items={items} value={assignee} onValueChange={(value) => setAssignee(value ?? "")}>
            <SelectTrigger id="rework-assignee" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((option) => (
                <SelectItem key={option.value || "team"} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={update.isPending} onClick={() => void save("ASSIGNED")}>
            Assign
          </Button>
          <Button type="button" disabled={update.isPending} onClick={() => void save("IN_PROGRESS")}>
            {update.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Assign and start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResolveDialog({ item, onOpenChange }: { item: ReworkItem; onOpenChange: (open: boolean) => void }) {
  const reasons = useRejectReasons();
  const resolve = useResolveRework();
  const [recovered, setRecovered] = useState(String(item.pending));
  const [failed, setFailed] = useState("");
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const reasonItems = (reasons.data ?? []).map((value) => ({ value, label: value }));

  const fixed = recovered.trim() === "" ? 0 : Number(recovered);
  const lost = failed.trim() === "" ? 0 : Number(failed);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (![fixed, lost].every((value) => Number.isInteger(value) && value >= 0)) return setError("Use whole pieces.");

    if (fixed + lost === 0) return setError("Enter the pieces fixed or failed.");

    if (fixed + lost > item.pending) return setError(`Only ${pieces(item.pending)} are waiting.`);

    if (lost > 0 && !reason) return setError("Choose why the failed pieces are rejected.");

    if (lost > 0 && reason === "Other" && !other.trim()) return setError("Say what was wrong.");

    setError(null);

    try {
      await resolve.mutateAsync({
        id: item.id,
        resolvedOn: date,
        recovered: fixed,
        failed: lost,
        failedReason: lost > 0 ? (reason === "Other" ? `Other: ${other.trim()}` : reason) : null,
      });
      toast.success(`${reworkNumber(item.number)}: ${fixed} fixed${lost ? `, ${lost} rejected` : ""}.`);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not record the result.");
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rework result · {reworkNumber(item.number)}</DialogTitle>
          <DialogDescription>
            {item.lot.lotNumber} {item.colour} {item.sizeLabel}: {pieces(item.pending)} waiting. Fixed pieces become
            Good and are paid to {item.issue.teamName}; failed ones are rejected.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
          {error ? <FormAlert>{error}</FormAlert> : null}
          <div className="grid grid-cols-3 gap-3">
            <Field id="rework-fixed" label="Fixed">
              <Input
                id="rework-fixed"
                inputMode="numeric"
                className="text-right tabular-nums"
                value={recovered}
                onChange={(e) => setRecovered(e.target.value)}
              />
            </Field>
            <Field id="rework-failed" label="Failed">
              <Input
                id="rework-failed"
                inputMode="numeric"
                placeholder="0"
                className="text-right tabular-nums"
                value={failed}
                onChange={(e) => setFailed(e.target.value)}
              />
            </Field>
            <Field id="rework-date" label="Date">
              <Input
                id="rework-date"
                type="date"
                max={todayISO()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>
          {lost > 0 ? (
            <Field id="rework-reason" label="Why they failed">
              <Select items={reasonItems} value={reason || null} onValueChange={(value) => setReason(value ?? "")}>
                <SelectTrigger id="rework-reason" className="w-full">
                  <SelectValue placeholder="Choose why" />
                </SelectTrigger>
                <SelectContent>
                  {reasonItems.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reason === "Other" ? (
                <Input
                  aria-label="What was wrong"
                  placeholder="What was wrong?"
                  maxLength={150}
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                />
              ) : null}
            </Field>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={resolve.isPending}>
              {resolve.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save result
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReworkTable({ canResolve }: { canResolve: boolean }) {
  const table = useDataTableState(REWORK_COLUMNS);
  const rework = useRework({ ...table.params, page: table.page, pageSize: table.pageSize });
  const [dialog, setDialog] = useState<{ kind: "assign" | "resolve"; item: ReworkItem; key: number } | null>(null);
  const close = (open: boolean) => (open ? undefined : setDialog(null));

  // The main action stays visible on every open row, not only in the row menu.
  const columns: DataColumn<ReworkItem>[] = canResolve
    ? [
        ...REWORK_COLUMNS,
        {
          id: "action",
          header: "Action",
          headerHidden: true,
          align: "right",
          hideable: false,
          skeleton: { width: "w-24" },
          cell: (item) =>
            OPEN.includes(item.status) ? (
              <Button
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation();
                  setDialog({ kind: "resolve", item, key: Date.now() });
                }}
              >
                Record result
              </Button>
            ) : null,
        },
      ]
    : REWORK_COLUMNS;

  return (
    <>
      <DataTable
        id="rework"
        columns={columns}
        rows={rework.data?.items}
        rowId={(item) => item.id}
        total={rework.data?.total}
        state={table}
        isFetching={rework.isFetching}
        isPlaceholderData={rework.isPlaceholderData}
        error={rework.error}
        onRetry={() => void rework.refetch()}
        searchLabel="Search rework"
        searchPlaceholder="Search lot, colour, team, RW-no…"
        isEmpty={Object.keys(table.params).length === 0}
        empty={{
          icon: RotateCcw,
          title: "No rework waiting",
          description: "Pieces marked Rework when stitching is received appear here until they are fixed or rejected.",
        }}
        exportName="rework"
        bulkActions={() => null}
        onRowClick={
          canResolve
            ? (item) => (OPEN.includes(item.status) ? setDialog({ kind: "resolve", item, key: Date.now() }) : undefined)
            : undefined
        }
        rowActions={(item) =>
          canResolve && OPEN.includes(item.status) ? (
            <>
              <DropdownMenuItem onClick={() => setDialog({ kind: "resolve", item, key: Date.now() })}>
                Record result
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog({ kind: "assign", item, key: Date.now() })}>
                Assign or start
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem disabled>No actions</DropdownMenuItem>
          )
        }
      />
      {dialog?.kind === "assign" ? <AssignDialog key={dialog.key} item={dialog.item} onOpenChange={close} /> : null}
      {dialog?.kind === "resolve" ? <ResolveDialog key={dialog.key} item={dialog.item} onOpenChange={close} /> : null}
    </>
  );
}

function RejectTable() {
  const table = useDataTableState(REJECT_COLUMNS);
  const rejects = useRejects({ ...table.params, page: table.page, pageSize: table.pageSize });

  return (
    <DataTable
      id="rejects"
      columns={REJECT_COLUMNS}
      rows={rejects.data?.rejects}
      rowId={(row) => row.id}
      total={rejects.data?.total}
      state={table}
      isFetching={rejects.isFetching}
      isPlaceholderData={rejects.isPlaceholderData}
      error={rejects.error}
      onRetry={() => void rejects.refetch()}
      searchLabel="Search rejects"
      searchPlaceholder="Search lot, colour, reason…"
      isEmpty={Object.keys(table.params).length === 0}
      empty={{
        icon: Ban,
        title: "No rejected pieces",
        description: "Rejects from receipts and failed rework appear here with their reason.",
      }}
      exportName="rejects"
      bulkActions={() => null}
    />
  );
}

export function ReworkPage() {
  const { data: user } = useCurrentUser();
  const { filters, setFilters } = useUrlFilters(["tab"]);
  const tab = filters.tab === "rejects" ? "rejects" : "rework";
  // Unfiltered totals for the tab labels; shares the dashboard's cached queries.
  const toFix = useRework({ page: 1, pageSize: 1 }).data?.pending;
  const rejected = useRejects({ page: 1, pageSize: 1 }).data?.pieces;

  return (
    <RequirePermission permission="stitching.view" title="Rework & Reject">
      <Page
        title="Rework & Reject"
        description="Pieces sent back for rework until they are fixed or rejected, and every rejected piece with its reason."
      >
        <div className="grid gap-4">
          <Tabs value={tab} onValueChange={(value) => setFilters({ tab: value === "rejects" ? "rejects" : "" })}>
            <TabsList>
              <TabsTrigger value="rework">
                Rework
                <TabCount value={toFix} label="pieces to fix" />
              </TabsTrigger>
              <TabsTrigger value="rejects">
                Rejects
                <TabCount value={rejected} label="pieces rejected" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "rework" ? <ReworkTable canResolve={hasPermission(user, "stitching.rework")} /> : <RejectTable />}
        </div>
      </Page>
    </RequirePermission>
  );
}

function TabCount({ value, label }: { value: number | undefined; label: string }) {
  if (!value) return null;

  return (
    <span
      aria-label={`${value} ${label}`}
      className="rounded-full bg-muted-foreground/10 px-1.5 text-xs font-medium text-muted-foreground tabular-nums"
    >
      {value.toLocaleString("en-IN")}
    </span>
  );
}
