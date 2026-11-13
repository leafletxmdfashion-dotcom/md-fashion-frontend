"use client";

import { useQuery } from "@tanstack/react-query";
import { Boxes, Loader2, Package, PackageCheck, Timer, Undo2, Users, Wallet, Wand2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { Page } from "@/components/page-header";
import { StatCard, StatCardSkeleton } from "@/components/stat-card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RequirePermission } from "@/features/auth/components/require-permission";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { formatDate, todayISO } from "@/features/fabric/lib/format";
import { useKarigarOptions } from "@/features/production/hooks/use-production";
import { CATEGORY_LABEL, karigarCode, moneyText } from "@/features/production/lib/format";
import { pieces } from "@/features/stitching/lib/format";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { api, ApiError, unwrap, type ApiSuccess } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import {
  packingNumber,
  usePack,
  usePackers,
  usePackingEntries,
  usePackingEntry,
  usePackingLines,
  usePackingQueue,
  usePackingSummary,
  useReversePacking,
  type PackingEntryRow,
  type PackerRow,
  type PackingLineRow,
  type QueueLot,
} from "./packing.api";

const STATUS = {
  POSTED: { label: "Packed", tone: "success" },
  REVERSED: { label: "Reversed", tone: "danger" },
} as const;

const count = (text: string | undefined) => (text?.trim() ? Number(text) : 0);

const monthStart = () => `${todayISO().slice(0, 8)}01`;

/** The packer's pay setup, to show what an entry will earn before it is posted. */
function usePackerPay(id: string) {
  return useQuery({
    queryKey: ["packing", "packer-pay", id],
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.get<ApiSuccess<{ karigar: { payMode: string; payRate: number | null } }>>(`/karigars/${id}`, { signal }),
        )
      ).karigar,
    enabled: Boolean(id),
  });
}

function PackDialog({ defaultLotId, onOpenChange }: { defaultLotId: string; onOpenChange: (open: boolean) => void }) {
  const { data: user } = useCurrentUser();
  const queue = usePackingQueue();
  const people = useKarigarOptions();
  const pack = usePack();
  const [lotId, setLotId] = useState(defaultLotId);
  const [packerId, setPackerId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const pay = usePackerPay(hasPermission(user, "karigar.view") ? packerId : "");

  const lot = queue.data?.lots.find((item) => item.lot.id === lotId);
  const sizes = (lot?.sizes ?? []).filter((size) => size.waiting > 0);
  const total = sizes.reduce((sum, size) => sum + Math.max(0, count(quantities[size.size]) || 0), 0);
  // Packers first, then everyone else who may pack.
  const packers = [...(people.data ?? [])].sort(
    (a, b) => Number(b.category === "PACKER") - Number(a.category === "PACKER") || a.name.localeCompare(b.name),
  );
  const rate = pay.data?.payMode === "PER_PIECE" ? pay.data.payRate : pay.data ? 0 : null;
  const anyTyped = Object.values(quantities).some((value) => value.trim() !== "");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const next: Record<string, string> = {};

    if (!lotId) next.lotId = "Choose a lot.";

    if (!packerId) next.packerId = "Choose who packed.";

    for (const size of sizes) {
      const value = count(quantities[size.size]);

      if (!Number.isInteger(value) || value < 0) next[size.size] = "Whole pieces only.";
      else if (value > size.waiting) next[size.size] = `Only ${size.waiting} waiting.`;
    }

    if (lotId && total === 0) next.lines = "Enter the pieces packed, or use Pack all waiting.";

    setErrors(next);

    if (Object.keys(next).length > 0) return;

    const sent = sizes.filter((size) => count(quantities[size.size]) > 0);

    try {
      const entry = await pack.mutateAsync({
        lotId,
        packerId,
        packDate: date,
        notes: notes.trim() || null,
        lines: sent.map((size) => ({
          sizeLabel: size.size,
          quantity: count(quantities[size.size]),
        })),
      });

      toast.success(
        `${packingNumber(entry.number)}: ${pieces(entry.pieces)} packed by ${entry.packer.name}` +
          (entry.earning !== null ? `, earns ${moneyText(entry.earning)}.` : ". Sent to the godown."),
      );
      onOpenChange(false);
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;
      const mapped = Object.fromEntries(
        Object.entries(apiError?.details ?? {}).map(([path, messages]) => {
          const line = /^lines\.(\d+)\./.exec(path);

          return [line ? (sent[Number(line[1])]?.size ?? path) : path, messages[0] ?? ""];
        }),
      );

      setErrors(mapped);
      setFormError(apiError?.message ?? "Could not record the packing.");
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pack pieces</DialogTitle>
          <DialogDescription>
            Good pieces from stitching, packed by size. They go into the godown and the packer is paid per piece.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-5">
          {formError ? <FormAlert>{formError}</FormAlert> : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="pack-lot" label="Lot" error={errors.lotId}>
              <Select
                items={(queue.data?.lots ?? []).map((item) => ({
                  value: item.lot.id,
                  label: item.lot.lotNumber,
                }))}
                value={lotId || null}
                onValueChange={(value) => {
                  setLotId(value ?? "");
                  setQuantities({});
                }}
              >
                <SelectTrigger id="pack-lot" className="w-full" aria-invalid={errors.lotId ? true : undefined}>
                  <SelectValue placeholder={queue.isLoading ? "Loading…" : "Choose a lot"} />
                </SelectTrigger>
                <SelectContent>
                  {(queue.data?.lots ?? []).map((item) => (
                    <SelectItem
                      key={item.lot.id}
                      value={item.lot.id}
                      description={
                        <>
                          {item.lot.articleName} · {pieces(item.waiting)} to pack
                        </>
                      }
                    >
                      {item.lot.lotNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="pack-packer" label="Packed by" error={errors.packerId}>
              <Select
                items={packers.map((person) => ({
                  value: person.id,
                  label: person.name,
                }))}
                value={packerId || null}
                onValueChange={(value) => setPackerId(value ?? "")}
              >
                <SelectTrigger id="pack-packer" className="w-full" aria-invalid={errors.packerId ? true : undefined}>
                  <SelectValue placeholder={people.isLoading ? "Loading…" : "Choose who packed"} />
                </SelectTrigger>
                <SelectContent>
                  {packers.map((person) => (
                    <SelectItem
                      key={person.id}
                      value={person.id}
                      description={
                        <>
                          {karigarCode(person.number)} · {CATEGORY_LABEL[person.category]}
                        </>
                      }
                    >
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="pack-date" label="Date">
              <Input
                id="pack-date"
                type="date"
                max={todayISO()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>

          {lotId ? (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium">
                  {lot?.lot.articleName} <span className="text-muted-foreground">· all colours</span>
                </span>
                {sizes.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setQuantities(
                        anyTyped ? {} : Object.fromEntries(sizes.map((size) => [size.size, String(size.waiting)])),
                      )
                    }
                  >
                    <Wand2 aria-hidden />
                    {anyTyped ? "Clear" : "Pack all waiting"}
                  </Button>
                ) : null}
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-[13px]">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Size</th>
                      <th className="px-3 py-2 text-right font-medium">Waiting</th>
                      <th className="w-32 px-3 py-2 text-right font-medium">Packed now</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sizes.map((size) => (
                      <tr key={size.size} className="align-top">
                        <td className="px-3 py-2 font-medium">
                          {size.size}
                          {errors[size.size] ? (
                            <p className="font-normal text-destructive">{errors[size.size]}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{size.waiting}</td>
                        <td className="px-3 py-1.5">
                          <Input
                            aria-label={`Packed now, size ${size.size}`}
                            aria-invalid={errors[size.size] ? true : undefined}
                            inputMode="numeric"
                            placeholder="0"
                            className="h-8 text-right tabular-nums"
                            value={quantities[size.size] ?? ""}
                            onChange={(e) =>
                              setQuantities((current) => ({
                                ...current,
                                [size.size]: e.target.value,
                              }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {errors.lines ? <p className="text-xs text-destructive">{errors.lines}</p> : null}
            </div>
          ) : null}

          {/* Pay per piece, highlighted: what this entry adds to the packer's account. */}
          {packerId && total > 0 && rate !== null && rate !== undefined ? (
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3">
              <span className="text-[13px]">
                Paid per piece: {pieces(total)} × {moneyText(rate)}
              </span>
              <strong className="text-base text-success tabular-nums">
                {moneyText((Math.round(rate * 100) * total) / 100)}
              </strong>
            </div>
          ) : packerId && total > 0 ? (
            <p className="text-[13px] text-muted-foreground">Paid per piece at the packer&apos;s rate.</p>
          ) : null}

          <Field id="pack-notes" label="Notes" description="Optional">
            <Textarea
              id="pack-notes"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          <DialogFooter className="items-center sm:justify-between">
            <p className="text-[13px] text-muted-foreground" aria-live="polite">
              {total > 0 ? (
                <>
                  <strong className="text-foreground tabular-nums">{pieces(total)}</strong> to pack
                </>
              ) : null}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pack.isPending}>
                {pack.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Record packing
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EntryDialog({
  id,
  canReverse,
  onOpenChange,
}: {
  id: string;
  canReverse: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const entry = usePackingEntry(id);
  const reverse = useReversePacking();
  const [reason, setReason] = useState("");
  const [reversing, setReversing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = entry.data;

  const submit = async () => {
    if (reason.trim().length < 3) return setError("Give a reason (at least 3 characters).");

    try {
      await reverse.mutateAsync({ id, reason: reason.trim() });
      toast.success(`${data ? packingNumber(data.number) : "Entry"} reversed.`);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not reverse.");
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{data ? packingNumber(data.number) : "Packing entry"}</DialogTitle>
          <DialogDescription>
            {data ? `${data.lot.lotNumber} · ${data.lot.articleName} · packed by ${data.packer.name}` : "Loading…"}
          </DialogDescription>
        </DialogHeader>
        {entry.isLoading || !data ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="grid gap-4 text-[13px]">
            <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3 sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Date</dt>
                <dd className="font-medium">{formatDate(data.date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Pieces</dt>
                <dd className="font-medium tabular-nums">{data.pieces}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Rate</dt>
                <dd className="font-medium tabular-nums">{data.rate === null ? "—" : moneyText(data.rate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Earned</dt>
                <dd className="font-semibold text-success tabular-nums">
                  {data.earning === null ? "—" : moneyText(data.earning)}
                </dd>
              </div>
            </dl>
            <ul className="divide-y rounded-lg border">
              {data.lines.map((line) => (
                <li key={line.sizeLabel} className="flex justify-between px-3 py-1.5">
                  <span>Size {line.sizeLabel}</span>
                  <span className="tabular-nums">{line.quantity}</span>
                </li>
              ))}
            </ul>
            {data.notes ? <p className="text-muted-foreground">{data.notes}</p> : null}
            <p className="text-xs text-muted-foreground">
              Recorded by {data.createdBy}
              {data.reversal
                ? ` · reversed ${formatDate(data.reversal.at.slice(0, 10))} by ${data.reversal.by}: ${data.reversal.reason}`
                : ""}
            </p>
            {canReverse && data.status === "POSTED" ? (
              reversing ? (
                <div className="grid gap-2">
                  {error ? <FormAlert>{error}</FormAlert> : null}
                  <Field
                    id="pack-reverse"
                    label="Why reverse?"
                    description="Pieces go back to packing; pay is taken back."
                  >
                    <Input
                      {...fieldProps("pack-reverse", undefined)}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                </div>
              ) : null
            ) : null}
          </div>
        )}
        <DialogFooter>
          {canReverse && data?.status === "POSTED" ? (
            reversing ? (
              <Button type="button" variant="destructive" disabled={reverse.isPending} onClick={() => void submit()}>
                {reverse.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Reverse entry
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => setReversing(true)}>
                <Undo2 aria-hidden />
                Reverse…
              </Button>
            )
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SizeChips({ sizes }: { sizes: { size: string; count: number }[] }) {
  const shown = sizes.filter((size) => size.count > 0);

  if (shown.length === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((size) => (
        <span key={size.size} className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums">
          <span className="font-medium">{size.size}</span> {size.count}
        </span>
      ))}
    </div>
  );
}

function queueColumns(canPack: boolean, onPack: (lotId: string) => void): DataColumn<QueueLot>[] {
  return [
    {
      id: "lot",
      header: "Lot",
      sortable: true,
      hideable: false,
      filter: { type: "text", placeholder: "Lot contains…" },
      skeleton: { sub: true, width: "w-24" },
      cell: (row) => <span className="font-mono font-medium">{row.lot.lotNumber}</span>,
    },
    {
      id: "item",
      header: "Item / design",
      sortable: true,
      filter: { type: "text", placeholder: "Item or code contains…" },
      skeleton: { sub: true, width: "w-28" },
      cell: (row) => (
        <>
          <p className="font-medium">{row.lot.articleName}</p>
          <p className="text-xs text-muted-foreground">{row.lot.articleCode}</p>
        </>
      ),
    },
    {
      id: "sizes",
      header: "Waiting by size",
      filter: { type: "text", placeholder: "Size, e.g. M" },
      skeleton: { width: "w-32" },
      cell: (row) => (
        <SizeChips
          sizes={row.sizes.map((size) => ({
            size: size.size,
            count: size.waiting,
          }))}
        />
      ),
    },
    {
      id: "good",
      header: "Good",
      align: "right",
      sortable: true,
      filter: { type: "number" },
      skeleton: { width: "w-10" },
      cell: (row) => <span className="tabular-nums">{row.good.toLocaleString("en-IN")}</span>,
    },
    {
      id: "packed",
      header: "Packed",
      align: "right",
      sortable: true,
      filter: { type: "number" },
      skeleton: { width: "w-10" },
      cell: (row) => <span className="text-muted-foreground tabular-nums">{row.packed.toLocaleString("en-IN")}</span>,
    },
    {
      id: "waiting",
      header: "To pack",
      align: "right",
      sortable: true,
      filter: { type: "number" },
      skeleton: { width: "w-10" },
      cell: (row) => <span className="font-semibold tabular-nums">{row.waiting.toLocaleString("en-IN")}</span>,
    },
    ...(canPack
      ? [
          {
            id: "action",
            header: "Pack",
            headerHidden: true,
            hideable: false,
            align: "right" as const,
            className: "w-20",
            skeleton: { width: "w-12" },
            cell: (row: QueueLot) => (
              <Button size="sm" variant="outline" onClick={() => onPack(row.lot.id)}>
                Pack
              </Button>
            ),
          },
        ]
      : []),
  ];
}

function Queue({ canPack, onPack }: { canPack: boolean; onPack: (lotId: string) => void }) {
  const columns = useMemo(() => queueColumns(canPack, onPack), [canPack, onPack]);
  const table = useDataTableState(columns);
  // Search, filters and sort run on the server, so the list and its export always agree.
  const queue = usePackingQueue({ ...table.params, page: table.page, pageSize: table.pageSize });

  return (
    <DataTable
      id="packing-queue"
      columns={columns}
      rows={queue.data?.lots}
      rowId={(row) => row.lot.id}
      total={queue.data?.total}
      state={table}
      isFetching={queue.isFetching}
      isPlaceholderData={queue.isPlaceholderData}
      error={queue.error}
      onRetry={() => void queue.refetch()}
      searchLabel="Search lots to pack"
      searchPlaceholder="Search lot, item or size…"
      exportPath="/packing/queue/export"
      isEmpty={queue.data?.total === 0 && Object.keys(table.params).length === 0}
      empty={{
        icon: PackageCheck,
        title: "Nothing waiting to pack",
        description: "Good pieces received from stitching appear here by size, ready to pack.",
      }}
    />
  );
}

function entryColumns(showMoney: boolean): DataColumn<PackingEntryRow>[] {
  return [
    {
      id: "date",
      header: "Date",
      sortable: true,
      filter: { type: "date" },
      skeleton: { width: "w-20" },
      cell: (row) => (
        <>
          <p className="whitespace-nowrap">{formatDate(row.date)}</p>
          <p className="font-mono text-xs text-muted-foreground">{packingNumber(row.number)}</p>
        </>
      ),
    },
    {
      id: "lot",
      header: "Lot · item",
      sortable: true,
      hideable: false,
      filter: { type: "text", placeholder: "Lot or item contains…" },
      skeleton: { sub: true, width: "w-28" },
      cell: (row) => (
        <>
          <p className="font-medium">{row.lot.lotNumber}</p>
          <p className="text-xs text-muted-foreground">{row.lot.articleName}</p>
        </>
      ),
    },
    {
      id: "packer",
      header: "Packed by",
      sortable: true,
      filter: { type: "text", placeholder: "Name contains…" },
      skeleton: { width: "w-24" },
      cell: (row) => row.packer.name,
    },
    {
      id: "sizes",
      header: "Sizes",
      className: "hidden md:table-cell",
      skeleton: { width: "w-28" },
      cell: (row) => <span className="text-muted-foreground">{row.sizes}</span>,
    },
    {
      id: "pieces",
      header: "Pieces",
      align: "right",
      sortable: true,
      filter: { type: "number" },
      skeleton: { width: "w-10" },
      cell: (row) => <span className="font-medium tabular-nums">{row.pieces}</span>,
    },
    ...(showMoney
      ? [
          {
            id: "earning",
            header: "Pay",
            align: "right" as const,
            skeleton: { width: "w-16" },
            cell: (row: PackingEntryRow) => (
              <>
                <p className={cn("font-semibold tabular-nums", row.status === "POSTED" && "text-success")}>
                  {moneyText(row.earning)}
                </p>
                <p className="text-xs text-muted-foreground">{moneyText(row.rate)} / pc</p>
              </>
            ),
          },
        ]
      : []),
    {
      id: "status",
      header: "Status",
      sortable: true,
      filter: {
        type: "enum",
        options: [
          { value: "POSTED", label: "Packed" },
          { value: "REVERSED", label: "Reversed" },
        ],
      },
      skeleton: { width: "w-16" },
      cell: (row) => <StatusChip tone={STATUS[row.status].tone}>{STATUS[row.status].label}</StatusChip>,
    },
  ];
}

function EntriesTable({ showMoney, onOpen }: { showMoney: boolean; onOpen: (id: string) => void }) {
  const columns = entryColumns(showMoney);
  const table = useDataTableState(columns);
  const entries = usePackingEntries({
    ...table.params,
    page: table.page,
    pageSize: table.pageSize,
  });

  return (
    <div className="grid gap-2">
      <DataTable
        id="packing-entries"
        columns={columns}
        rows={entries.data?.entries}
        rowId={(row) => row.id}
        total={entries.data?.total}
        state={table}
        isFetching={entries.isFetching}
        isPlaceholderData={entries.isPlaceholderData}
        error={entries.error}
        onRetry={() => void entries.refetch()}
        searchLabel="Search packing"
        searchPlaceholder="Search lot, item, packer, PK-no…"
        isEmpty={Object.keys(table.params).length === 0}
        empty={{
          icon: Package,
          title: "No packing yet",
          description: "Every packing entry appears here.",
        }}
        exportPath="/packing/entries/export"
        onRowClick={(row) => onOpen(row.id)}
        rowActions={(row) => <DropdownMenuItem onClick={() => onOpen(row.id)}>Open</DropdownMenuItem>}
      />
    </div>
  );
}

const LINE_COLUMNS: DataColumn<PackingLineRow>[] = [
  {
    id: "date",
    header: "Date",
    sortable: true,
    filter: { type: "date" },
    skeleton: { width: "w-20" },
    cell: (row) => <span className="whitespace-nowrap">{formatDate(row.date)}</span>,
  },
  {
    id: "packer",
    header: "Packed by",
    sortable: true,
    filter: { type: "text", placeholder: "Name contains…" },
    skeleton: { width: "w-24" },
    cell: (row) => <span className="font-medium">{row.packer.name}</span>,
  },
  {
    id: "item",
    header: "Item",
    sortable: true,
    filter: { type: "text", placeholder: "Item contains…" },
    skeleton: { sub: true, width: "w-24" },
    cell: (row) => (
      <>
        <p>{row.articleName}</p>
        <p className="text-xs text-muted-foreground">
          {row.lot.lotNumber} · {packingNumber(row.entry.number)}
        </p>
      </>
    ),
  },
  {
    id: "size",
    header: "Size",
    sortable: true,
    filter: { type: "text", placeholder: "Size, e.g. M" },
    skeleton: { width: "w-10" },
    cell: (row) => row.sizeLabel,
  },
  {
    id: "quantity",
    header: "Pieces",
    align: "right",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-10" },
    cell: (row) => <span className="font-medium tabular-nums">{row.quantity}</span>,
  },
];

function LinesTable() {
  const table = useDataTableState(LINE_COLUMNS);
  const lines = usePackingLines({
    ...table.params,
    page: table.page,
    pageSize: table.pageSize,
  });

  return (
    <div className="grid gap-2">
      <DataTable
        id="packing-lines"
        columns={LINE_COLUMNS}
        rows={lines.data?.lines}
        rowId={(row) => row.id}
        total={lines.data?.total}
        state={table}
        isFetching={lines.isFetching}
        isPlaceholderData={lines.isPlaceholderData}
        error={lines.error}
        onRetry={() => void lines.refetch()}
        searchLabel="Search packed sizes"
        searchPlaceholder="Search packer, lot, item or size…"
        isEmpty={Object.keys(table.params).length === 0}
        empty={{ icon: Boxes, title: "No pieces packed yet" }}
        exportPath="/packing/lines/export"
      />
    </div>
  );
}

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom dates" },
] as const;

type Period = (typeof PERIODS)[number]["value"];

function periodRange(period: Period): { from: string; to: string } {
  if (period === "today") return { from: todayISO(), to: todayISO() };
  if (period === "month") return { from: monthStart(), to: todayISO() };
  return { from: "", to: "" };
}

function staffColumns(showMoney: boolean): DataColumn<PackerRow>[] {
  return [
    {
      id: "packer",
      header: "Packer",
      sortable: true,
      hideable: false,
      filter: { type: "text", placeholder: "Name contains…" },
      skeleton: { sub: true, width: "w-28" },
      cell: (row) => (
        <>
          <Link
            href={`/karigar/payments?person=${row.id}`}
            className="font-medium hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {row.name}
          </Link>
          <p className="text-xs text-muted-foreground">{karigarCode(row.number)}</p>
        </>
      ),
    },
    {
      id: "items",
      header: "Items packed",
      filter: { type: "text", placeholder: "Item contains…" },
      skeleton: { width: "w-32" },
      cell: (row) => <span className="text-muted-foreground">{row.items}</span>,
    },
    {
      id: "entries",
      header: "Entries",
      align: "right",
      sortable: true,
      filter: { type: "number" },
      skeleton: { width: "w-8" },
      cell: (row) => <span className="tabular-nums">{row.entries}</span>,
    },
    {
      id: "lots",
      header: "Lots",
      align: "right",
      sortable: true,
      filter: { type: "number" },
      skeleton: { width: "w-8" },
      cell: (row) => <span className="tabular-nums">{row.lots}</span>,
    },
    {
      id: "pieces",
      header: "Pieces",
      align: "right",
      sortable: true,
      filter: { type: "number" },
      skeleton: { width: "w-10" },
      cell: (row) => <span className="font-semibold tabular-nums">{row.pieces.toLocaleString("en-IN")}</span>,
    },
    ...(showMoney
      ? [
          {
            id: "earned",
            header: "Pay earned",
            align: "right" as const,
            sortable: true,
            filter: { type: "number" as const, unit: "Rs" },
            skeleton: { width: "w-16" },
            cell: (row: PackerRow) => (
              <span className="font-semibold text-success tabular-nums">{moneyText(row.earned)}</span>
            ),
          },
        ]
      : []),
    {
      id: "lastDate",
      header: "Dates",
      sortable: true,
      filter: { type: "date" },
      skeleton: { width: "w-24" },
      cell: (row) => (
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {row.firstDate === row.lastDate
            ? formatDate(row.firstDate)
            : `${formatDate(row.firstDate)} – ${formatDate(row.lastDate)}`}
        </span>
      ),
    },
  ];
}

function StaffTable({ showMoney }: { showMoney: boolean }) {
  const columns = useMemo(() => staffColumns(showMoney), [showMoney]);
  const table = useDataTableState(columns, ["period", "from", "to"]);
  const period: Period = PERIODS.some((item) => item.value === table.filters.period)
    ? (table.filters.period as Period)
    : "month";
  const range =
    period === "custom" ? { from: table.filters.from ?? "", to: table.filters.to ?? "" } : periodRange(period);
  // The server adds up each packer's work in the period, then searches, filters and sorts.
  const columnParams = Object.fromEntries(
    Object.entries(table.params).filter(([key]) => !["period", "from", "to"].includes(key)),
  );
  const params = { ...columnParams, dateFrom: range.from || undefined, dateTo: range.to || undefined };
  const staff = usePackers({ ...params, page: table.page, pageSize: table.pageSize });

  return (
    <DataTable
      id="packing-staff"
      columns={columns}
      rows={staff.data?.staff}
      rowId={(row) => row.id}
      total={staff.data?.total}
      state={table}
      isFetching={staff.isFetching}
      isPlaceholderData={staff.isPlaceholderData}
      error={staff.error}
      onRetry={() => void staff.refetch()}
      searchLabel="Search packers"
      searchPlaceholder="Search packer or item…"
      exportPath="/packing/staff/export"
      exportParams={params}
      isEmpty={staff.data?.total === 0 && period === "all" && Object.keys(columnParams).length === 0}
      empty={{
        icon: Users,
        title: "No packing yet",
        description: "Each packer's pieces and pay appear here.",
      }}
      toolbarStart={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={PERIODS.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            value={period}
            onValueChange={(next) => table.setFilters({ period: next === "month" ? "" : (next ?? "") })}
          >
            <SelectTrigger aria-label="Period" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {period === "custom" ? (
            <>
              <Input
                type="date"
                aria-label="From"
                className="w-38"
                value={range.from}
                max={range.to || todayISO()}
                onChange={(event) => table.setFilters({ from: event.target.value })}
              />
              <Input
                type="date"
                aria-label="To"
                className="w-38"
                value={range.to}
                min={range.from}
                max={todayISO()}
                onChange={(event) => table.setFilters({ to: event.target.value })}
              />
            </>
          ) : null}
        </div>
      }
    />
  );
}

const TABS = ["queue", "entries", "staff", "sizes"] as const;

export function PackingPage() {
  const { data: user } = useCurrentUser();
  const { filters, resetTo: setFilters } = useUrlFilters(["tab"]);
  const tab = (TABS as readonly string[]).includes(filters.tab ?? "") ? filters.tab! : "queue";
  const summary = usePackingSummary();
  const [packing, setPacking] = useState<{ lotId: string; key: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const canPack = hasPermission(user, "packing.manage");
  const showMoney = hasPermission(user, "costing.view");
  const data = summary.data;

  return (
    <RequirePermission permission="packing.view" title="Packing">
      <Page
        title="Packing"
        description="Good pieces from stitching wait here by size. Packing pays the packer per piece and sends the pieces to the godown."
        actions={
          canPack ? (
            <Button onClick={() => setPacking({ lotId: "", key: Date.now() })}>
              <Package aria-hidden />
              Pack pieces
            </Button>
          ) : null
        }
      >
        <div className="grid gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {data ? (
              <>
                <StatCard
                  label="Waiting to pack"
                  icon={Timer}
                  value={data.waiting.toLocaleString("en-IN")}
                  context="Good pieces from stitching"
                  tone={data.waiting > 0 ? "warning" : "default"}
                  onClick={() => setFilters({ tab: "" })}
                />
                <StatCard
                  label="Packed today"
                  icon={PackageCheck}
                  value={data.packedToday.toLocaleString("en-IN")}
                  context={`${data.entriesToday} entries · ${data.packersToday} packers`}
                />
                <StatCard
                  label="Packed this month"
                  icon={Package}
                  value={data.packedThisMonth.toLocaleString("en-IN")}
                  context={`${data.packedTotal.toLocaleString("en-IN")} packed in all`}
                  onClick={() => setFilters({ tab: "staff" })}
                />
                {data.earningThisMonth !== null ? (
                  <StatCard
                    label="Packing pay this month"
                    icon={Wallet}
                    value={moneyText(data.earningThisMonth)}
                    context="Paid per piece packed"
                    tone="success"
                    href="/karigar/payments"
                  />
                ) : (
                  <StatCard label="Entries today" value={String(data.entriesToday)} />
                )}
              </>
            ) : (
              Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
            )}
          </div>

          <Tabs value={tab} onValueChange={(value) => setFilters({ tab: value === "queue" ? "" : String(value) })}>
            <TabsList>
              <TabsTrigger value="queue">To pack</TabsTrigger>
              <TabsTrigger value="entries">Packing entries</TabsTrigger>
              <TabsTrigger value="staff">By packer</TabsTrigger>
              <TabsTrigger value="sizes">By item & size</TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === "queue" ? (
            <Queue canPack={canPack} onPack={(lotId) => setPacking({ lotId, key: Date.now() })} />
          ) : tab === "entries" ? (
            <EntriesTable showMoney={showMoney} onOpen={setOpen} />
          ) : tab === "staff" ? (
            <StaffTable showMoney={showMoney} />
          ) : (
            <LinesTable />
          )}
        </div>
        {packing ? (
          <PackDialog
            key={packing.key}
            defaultLotId={packing.lotId}
            onOpenChange={(value) => (value ? undefined : setPacking(null))}
          />
        ) : null}
        {open ? (
          <EntryDialog id={open} canReverse={canPack} onOpenChange={(value) => (value ? undefined : setOpen(null))} />
        ) : null}
      </Page>
    </RequirePermission>
  );
}
