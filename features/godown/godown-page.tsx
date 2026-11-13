"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Loader2,
  Plus,
  Truck,
  Undo2,
  Warehouse,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { SuggestInput } from "@/components/form/suggest-input";
import { Page } from "@/components/page-header";
import { StatCard, StatCardSkeleton } from "@/components/stat-card";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RequirePermission } from "@/features/auth/components/require-permission";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { formatDate, todayISO } from "@/features/fabric/lib/format";
import { MergeItemsButton } from "@/features/production/components/item-tools";
import { pieces } from "@/features/stitching/lib/format";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import {
  dispatchNumber,
  MOVEMENT_LABEL,
  useAdjustStock,
  useCreateDispatch,
  useDispatch,
  useDispatches,
  useMovements,
  useParties,
  useReverseDispatch,
  useStock,
  type DispatchRow,
  type Movement,
  type MovementType,
  type StockItem,
} from "./godown.api";

const count = (text: string | undefined) => (text?.trim() ? Number(text) : 0);

/** Items with stock, for the dispatch and count forms. */
function useStockItems() {
  return useStock({ pageSize: 200 });
}

interface DispatchItem {
  articleId: string;
  quantities: Record<string, string>;
}

function DispatchDialog({ articleId, onOpenChange }: { articleId: string; onOpenChange: (open: boolean) => void }) {
  const stock = useStockItems();
  const parties = useParties();
  const create = useCreateDispatch();
  const [party, setParty] = useState("");
  const [challan, setChallan] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DispatchItem[]>([{ articleId, quantities: {} }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const inStock = (stock.data?.items ?? []).filter((item) => item.balance > 0);
  const itemOf = (id: string) => inStock.find((item) => item.article.id === id);
  const total = items.reduce(
    (sum, entry) => sum + Object.values(entry.quantities).reduce((acc, value) => acc + (count(value) || 0), 0),
    0,
  );

  const lines = items.flatMap((entry) =>
    (itemOf(entry.articleId)?.sizes ?? [])
      .filter((size) => count(entry.quantities[size.size]) > 0)
      .map((size) => ({
        articleId: entry.articleId,
        sizeLabel: size.size,
        quantity: count(entry.quantities[size.size]),
      })),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const next: Record<string, string> = {};

    if (!party.trim()) next.party = "Enter who the goods go to.";

    for (const entry of items) {
      for (const size of itemOf(entry.articleId)?.sizes ?? []) {
        const value = count(entry.quantities[size.size]);
        const key = `${entry.articleId}|${size.size}`;

        if (!Number.isInteger(value) || value < 0) next[key] = "Whole pieces only.";
        else if (value > size.balance) next[key] = `Only ${size.balance} in stock.`;
      }
    }

    if (lines.length === 0) next.lines = "Enter the pieces to dispatch.";

    setErrors(next);

    if (Object.keys(next).length > 0) return;

    try {
      const dispatch = await create.mutateAsync({
        dispatchDate: date,
        party: party.trim(),
        challan: challan.trim() || null,
        notes: notes.trim() || null,
        lines,
      });

      toast.success(`${dispatchNumber(dispatch.number)}: ${pieces(dispatch.pieces)} sent to ${dispatch.party}.`);
      onOpenChange(false);
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;

      setErrors(
        Object.fromEntries(
          Object.entries(apiError?.details ?? {}).map(([path, messages]) => {
            const line = /^lines\.(\d+)\./.exec(path);
            const sent = line ? lines[Number(line[1])] : undefined;

            return [sent ? `${sent.articleId}|${sent.sizeLabel}` : path, messages[0] ?? ""];
          }),
        ),
      );
      setFormError(apiError?.message ?? "Could not dispatch.");
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dispatch goods</DialogTitle>
          <DialogDescription>Finished goods leaving the godown, with the party and challan.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-5">
          {formError ? <FormAlert>{formError}</FormAlert> : null}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="dispatch-party" label="Party" error={errors.party}>
              <SuggestInput
                {...fieldProps("dispatch-party", errors.party)}
                suggestions={parties.data ?? []}
                value={party}
                onChange={setParty}
                placeholder="Shop or buyer"
                maxLength={100}
              />
            </Field>
            <Field id="dispatch-challan" label="Challan no." description="Optional">
              <Input
                id="dispatch-challan"
                maxLength={40}
                value={challan}
                onChange={(e) => setChallan(e.target.value)}
              />
            </Field>
            <Field id="dispatch-date" label="Date">
              <Input
                id="dispatch-date"
                type="date"
                max={todayISO()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>

          {stock.isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            items.map((entry, index) => {
              const item = itemOf(entry.articleId);
              const options = inStock.filter(
                (option) =>
                  option.article.id === entry.articleId ||
                  !items.some((other) => other.articleId === option.article.id),
              );

              return (
                <div key={index} className="grid gap-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Select
                      items={options.map((option) => ({
                        value: option.article.id,
                        label: option.article.name,
                      }))}
                      value={entry.articleId || null}
                      onValueChange={(value) =>
                        setItems((current) =>
                          current.map((other, at) =>
                            at === index ? { articleId: value ?? "", quantities: {} } : other,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="w-full" aria-label={`Item ${index + 1}`}>
                        <SelectValue placeholder="Choose an item" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((option) => (
                          <SelectItem
                            key={option.article.id}
                            value={option.article.id}
                            description={<>{pieces(option.balance)} in stock</>}
                          >
                            {option.article.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {items.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove item"
                        onClick={() => setItems((current) => current.filter((_, at) => at !== index))}
                      >
                        <X aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                  {item ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {item.sizes
                        .filter((size) => size.balance > 0)
                        .map((size) => {
                          const key = `${item.article.id}|${size.size}`;

                          return (
                            <div key={size.size} className="grid gap-1">
                              <Label
                                htmlFor={`dispatch-${index}-${size.size}`}
                                className="text-xs text-muted-foreground"
                              >
                                {size.size} <span className="tabular-nums">({size.balance})</span>
                              </Label>
                              <Input
                                id={`dispatch-${index}-${size.size}`}
                                aria-label={`Dispatch ${item.article.name} ${size.size}`}
                                aria-invalid={errors[key] ? true : undefined}
                                inputMode="numeric"
                                placeholder="0"
                                className="h-8 text-right tabular-nums"
                                value={entry.quantities[size.size] ?? ""}
                                onChange={(e) =>
                                  setItems((current) =>
                                    current.map((other, at) =>
                                      at === index
                                        ? {
                                            ...other,
                                            quantities: {
                                              ...other.quantities,
                                              [size.size]: e.target.value,
                                            },
                                          }
                                        : other,
                                    ),
                                  )
                                }
                              />
                              {errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null}
                            </div>
                          );
                        })}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
          <div className="flex items-center justify-between gap-2">
            {items.length < inStock.length ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setItems((current) => [...current, { articleId: "", quantities: {} }])}
              >
                <Plus aria-hidden />
                Add another item
              </Button>
            ) : (
              <span />
            )}
            {errors.lines ? <p className="text-xs text-destructive">{errors.lines}</p> : null}
          </div>

          <Field id="dispatch-notes" label="Notes" description="Optional">
            <Textarea
              id="dispatch-notes"
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
                  <strong className="text-foreground tabular-nums">{pieces(total)}</strong> to dispatch
                </>
              ) : null}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Dispatch
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({ articleId, onOpenChange }: { articleId: string; onOpenChange: (open: boolean) => void }) {
  const stock = useStockItems();
  const adjust = useAdjustStock();
  const [itemId, setItemId] = useState(articleId);
  const [size, setSize] = useState("");
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);

  const item = stock.data?.items.find((entry) => entry.article.id === itemId);
  const current = item?.sizes.find((entry) => entry.size === size.trim())?.balance ?? 0;
  const value = count(counted);
  const difference = counted.trim() === "" ? null : value - current;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!itemId) return setError("Choose the item.");

    if (!size.trim()) return setError("Enter the size.");

    if (counted.trim() === "" || !Number.isInteger(value) || value < 0) return setError("Enter the pieces counted.");

    if (difference === 0) return setError("The count matches the record. Nothing to change.");

    if (reason.trim().length < 3) return setError("Give a reason (at least 3 characters).");

    setError(null);

    try {
      await adjust.mutateAsync({
        date,
        articleId: itemId,
        sizeLabel: size.trim(),
        counted: value,
        reason: reason.trim(),
      });
      toast.success(`${item?.article.name} ${size.trim()}: ${current} → ${value}.`);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save the count.");
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Correct a count</DialogTitle>
          <DialogDescription>
            Set a size to the pieces counted in the godown. The difference is recorded with your reason.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
          {error ? <FormAlert>{error}</FormAlert> : null}
          <Field id="adjust-item" label="Item">
            <Select
              items={(stock.data?.items ?? []).map((entry) => ({
                value: entry.article.id,
                label: entry.article.name,
              }))}
              value={itemId || null}
              onValueChange={(next) => {
                setItemId(next ?? "");
                setSize("");
              }}
            >
              <SelectTrigger id="adjust-item" className="w-full">
                <SelectValue placeholder="Choose an item" />
              </SelectTrigger>
              <SelectContent>
                {(stock.data?.items ?? []).map((entry) => (
                  <SelectItem key={entry.article.id} value={entry.article.id}>
                    {entry.article.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field id="adjust-size" label="Size">
              <SuggestInput
                id="adjust-size"
                suggestions={item?.sizes.map((entry) => entry.size) ?? []}
                value={size}
                onChange={setSize}
                placeholder="e.g. M"
                maxLength={20}
              />
            </Field>
            <Field id="adjust-counted" label="Counted" description={size.trim() ? `Record: ${current}` : undefined}>
              <Input
                id="adjust-counted"
                inputMode="numeric"
                className="text-right tabular-nums"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
              />
            </Field>
            <Field id="adjust-date" label="Date">
              <Input
                id="adjust-date"
                type="date"
                max={todayISO()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>
          {difference !== null && difference !== 0 && Number.isInteger(difference) ? (
            <p className={cn("text-[13px] font-medium", difference > 0 ? "text-success" : "text-destructive")}>
              {difference > 0 ? `+${difference}` : difference} pieces
            </p>
          ) : null}
          <Field id="adjust-reason" label="Reason">
            <Input
              id="adjust-reason"
              placeholder="e.g. Monthly physical count"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={adjust.isPending}>
              {adjust.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save count
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DispatchDetail({
  id,
  canReverse,
  onOpenChange,
}: {
  id: string;
  canReverse: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dispatch = useDispatch(id);
  const reverse = useReverseDispatch();
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const data = dispatch.data;

  const submit = async () => {
    if (reason.trim().length < 3) return setError("Give a reason (at least 3 characters).");

    try {
      await reverse.mutateAsync({ id, reason: reason.trim() });
      toast.success(`${data ? dispatchNumber(data.number) : "Dispatch"} reversed; pieces are back in stock.`);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not reverse.");
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{data ? dispatchNumber(data.number) : "Dispatch"}</DialogTitle>
          <DialogDescription>
            {data
              ? `${data.party}${data.challan ? ` · challan ${data.challan}` : ""} · ${formatDate(data.date)}`
              : "Loading…"}
          </DialogDescription>
        </DialogHeader>
        {!data ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="grid gap-3 text-[13px]">
            <ul className="divide-y rounded-lg border">
              {data.lines.map((line) => (
                <li key={`${line.article.id}-${line.sizeLabel}`} className="flex justify-between gap-3 px-3 py-1.5">
                  <span>
                    {line.article.name} <span className="text-muted-foreground">· {line.sizeLabel}</span>
                  </span>
                  <span className="tabular-nums">{line.quantity}</span>
                </li>
              ))}
              <li className="flex justify-between px-3 py-1.5 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{data.pieces}</span>
              </li>
            </ul>
            {data.notes ? <p className="text-muted-foreground">{data.notes}</p> : null}
            <p className="text-xs text-muted-foreground">
              Recorded by {data.createdBy}
              {data.reversal
                ? ` · reversed ${formatDate(data.reversal.at.slice(0, 10))} by ${data.reversal.by}: ${data.reversal.reason}`
                : ""}
            </p>
            {reversing ? (
              <>
                {error ? <FormAlert>{error}</FormAlert> : null}
                <Field id="dispatch-reverse" label="Why reverse?" description="The pieces come back into stock.">
                  <Input id="dispatch-reverse" value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
              </>
            ) : null}
          </div>
        )}
        <DialogFooter>
          {canReverse && data?.status === "POSTED" ? (
            reversing ? (
              <Button type="button" variant="destructive" disabled={reverse.isPending} onClick={() => void submit()}>
                {reverse.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Reverse dispatch
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

function stockColumns(
  canManage: boolean,
  onDispatch: (articleId: string) => void,
  onAdjust: (articleId: string) => void,
): DataColumn<StockItem>[] {
  return [
    {
      id: "item",
      header: "Item / design",
      sortable: true,
      hideable: false,
      filter: { type: "text", placeholder: "Item or code contains…" },
      skeleton: { sub: true, width: "w-32" },
      cell: (item) => (
        <>
          <p className="font-medium">{item.article.name}</p>
          <p className="text-xs text-muted-foreground">{item.article.code}</p>
        </>
      ),
    },
    {
      id: "sizes",
      header: "In stock by size",
      filter: { type: "text", placeholder: "Size, e.g. M" },
      skeleton: { width: "w-32" },
      cell: (item) => {
        const shown = item.sizes.filter((size) => size.balance > 0);

        return shown.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {shown.map((size) => (
              <span
                key={size.size}
                title={`${size.size}: ${size.in} in, ${size.out} out`}
                className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums"
              >
                <span className="font-medium">{size.size}</span> {size.balance}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      id: "in",
      header: "In",
      align: "right",
      sortable: true,
      filter: { type: "number" },
      skeleton: { width: "w-10" },
      cell: (item) => <span className="text-success tabular-nums">{item.in.toLocaleString("en-IN")}</span>,
    },
    {
      id: "out",
      header: "Out",
      align: "right",
      sortable: true,
      filter: { type: "number" },
      skeleton: { width: "w-10" },
      cell: (item) => <span className="text-muted-foreground tabular-nums">{item.out.toLocaleString("en-IN")}</span>,
    },
    {
      id: "balance",
      header: "In stock",
      align: "right",
      sortable: true,
      filter: { type: "number" },
      skeleton: { width: "w-10" },
      cell: (item) => <span className="font-semibold tabular-nums">{item.balance.toLocaleString("en-IN")}</span>,
    },
    {
      id: "lastMovement",
      header: "Last movement",
      className: "hidden md:table-cell",
      sortable: true,
      filter: { type: "date" },
      skeleton: { width: "w-20" },
      cell: (item) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {item.lastMovementAt ? formatDate(item.lastMovementAt.slice(0, 10)) : "—"}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "Actions",
            headerHidden: true,
            hideable: false,
            align: "right" as const,
            className: "w-40",
            skeleton: { width: "w-24" },
            cell: (item: StockItem) => (
              <span className="flex justify-end gap-1 whitespace-nowrap">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={item.balance === 0}
                  onClick={() => onDispatch(item.article.id)}
                >
                  Dispatch
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onAdjust(item.article.id)}>
                  Count
                </Button>
              </span>
            ),
          },
        ]
      : []),
  ];
}

function StockTable({
  canManage,
  onDispatch,
  onAdjust,
}: {
  canManage: boolean;
  onDispatch: (articleId: string) => void;
  onAdjust: (articleId: string) => void;
}) {
  const columns = useMemo(() => stockColumns(canManage, onDispatch, onAdjust), [canManage, onDispatch, onAdjust]);
  const table = useDataTableState(columns, ["stock"]);
  const includeEmpty = table.filters.stock === "all";
  // Search, filters and sort run on the server, so the list and its export always agree.
  const columnParams = Object.fromEntries(Object.entries(table.params).filter(([key]) => key !== "stock"));
  const params = { ...columnParams, inStock: includeEmpty ? undefined : "true" };
  const stock = useStock({ ...params, page: table.page, pageSize: table.pageSize });

  return (
    <DataTable
      id="godown-stock"
      columns={columns}
      rows={stock.data?.items}
      rowId={(item) => item.article.id}
      total={stock.data?.total}
      state={table}
      isFetching={stock.isFetching}
      isPlaceholderData={stock.isPlaceholderData}
      error={stock.error}
      onRetry={() => void stock.refetch()}
      searchLabel="Search items"
      searchPlaceholder="Search item, code or size…"
      exportPath="/godown/stock/export"
      exportParams={params}
      isEmpty={stock.data?.total === 0 && Object.keys(columnParams).length === 0 && !includeEmpty}
      empty={{
        icon: Warehouse,
        title: "The godown is empty",
        description: "Packed pieces arrive here automatically, by item and size.",
      }}
      toolbarStart={
        <div className="flex items-center gap-2 pl-1">
          <Checkbox
            id="include-empty"
            checked={includeEmpty}
            onCheckedChange={(checked) => table.setFilters({ stock: checked === true ? "all" : "" })}
          />
          <Label htmlFor="include-empty" className="text-[13px] font-normal whitespace-nowrap">
            Include items with no stock
          </Label>
        </div>
      }
    />
  );
}

const MOVEMENT_COLUMNS: DataColumn<Movement>[] = [
  {
    id: "date",
    header: "Date",
    sortable: true,
    filter: { type: "date" },
    skeleton: { width: "w-20" },
    cell: (row) => <span className="whitespace-nowrap">{formatDate(row.date)}</span>,
  },
  {
    id: "item",
    header: "Item",
    sortable: true,
    hideable: false,
    filter: { type: "text", placeholder: "Item contains…" },
    skeleton: { width: "w-28" },
    cell: (row) => <span className="font-medium">{row.article.name}</span>,
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
    id: "type",
    header: "Movement",
    sortable: true,
    filter: {
      type: "enum",
      // SAFETY: MOVEMENT_LABEL is keyed by exactly the MovementType values.
      options: (Object.keys(MOVEMENT_LABEL) as MovementType[]).map((value) => ({
        value,
        label: MOVEMENT_LABEL[value],
      })),
    },
    skeleton: { sub: true, width: "w-24" },
    cell: (row) => (
      <>
        <p>{MOVEMENT_LABEL[row.type]}</p>
        <p className="text-xs text-muted-foreground">
          {[row.lotNumber, row.reference, row.reason].filter(Boolean).join(" · ")}
        </p>
      </>
    ),
  },
  {
    id: "quantity",
    header: "Pieces",
    align: "right",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-10" },
    cell: (row) => (
      <span className={cn("font-semibold tabular-nums", row.direction === "IN" ? "text-success" : "text-destructive")}>
        {row.direction === "IN" ? "+" : "−"}
        {row.quantity}
      </span>
    ),
  },
];

function MovementsTable() {
  const table = useDataTableState(MOVEMENT_COLUMNS);
  const moves = useMovements({
    ...table.params,
    page: table.page,
    pageSize: table.pageSize,
  });

  return (
    <div className="grid gap-2">
      <DataTable
        id="godown-movements"
        columns={MOVEMENT_COLUMNS}
        rows={moves.data?.movements}
        rowId={(row) => row.id}
        total={moves.data?.total}
        state={table}
        isFetching={moves.isFetching}
        isPlaceholderData={moves.isPlaceholderData}
        error={moves.error}
        onRetry={() => void moves.refetch()}
        searchLabel="Search movements"
        searchPlaceholder="Search item, lot, party, reason…"
        isEmpty={Object.keys(table.params).length === 0}
        empty={{ icon: ClipboardList, title: "No stock movements yet" }}
        exportPath="/godown/movements/export"
      />
    </div>
  );
}

const DISPATCH_STATUS = {
  POSTED: { label: "Dispatched", tone: "success" },
  REVERSED: { label: "Reversed", tone: "danger" },
} as const;

const DISPATCH_COLUMNS: DataColumn<DispatchRow>[] = [
  {
    id: "date",
    header: "Date",
    sortable: true,
    filter: { type: "date" },
    skeleton: { sub: true, width: "w-20" },
    cell: (row) => (
      <>
        <p className="whitespace-nowrap">{formatDate(row.date)}</p>
        <p className="font-mono text-xs text-muted-foreground">{dispatchNumber(row.number)}</p>
      </>
    ),
  },
  {
    id: "party",
    header: "Party",
    sortable: true,
    hideable: false,
    filter: { type: "text", placeholder: "Party contains…" },
    skeleton: { sub: true, width: "w-28" },
    cell: (row) => (
      <>
        <p className="font-medium">{row.party}</p>
        <p className="text-xs text-muted-foreground">{row.challan ? `Challan ${row.challan}` : "No challan"}</p>
      </>
    ),
  },
  {
    id: "items",
    header: "Items",
    className: "hidden md:table-cell",
    skeleton: { width: "w-28" },
    cell: (row) => <span className="text-muted-foreground">{row.items}</span>,
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
  {
    id: "status",
    header: "Status",
    sortable: true,
    filter: {
      type: "enum",
      options: [
        { value: "POSTED", label: "Dispatched" },
        { value: "REVERSED", label: "Reversed" },
      ],
    },
    skeleton: { width: "w-16" },
    cell: (row) => <StatusChip tone={DISPATCH_STATUS[row.status].tone}>{DISPATCH_STATUS[row.status].label}</StatusChip>,
  },
];

function DispatchTable({ onOpen }: { onOpen: (id: string) => void }) {
  const table = useDataTableState(DISPATCH_COLUMNS);
  const dispatches = useDispatches({
    ...table.params,
    page: table.page,
    pageSize: table.pageSize,
  });

  return (
    <div className="grid gap-2">
      <DataTable
        id="godown-dispatches"
        columns={DISPATCH_COLUMNS}
        rows={dispatches.data?.dispatches}
        rowId={(row) => row.id}
        total={dispatches.data?.total}
        state={table}
        isFetching={dispatches.isFetching}
        isPlaceholderData={dispatches.isPlaceholderData}
        error={dispatches.error}
        onRetry={() => void dispatches.refetch()}
        searchLabel="Search dispatches"
        searchPlaceholder="Search party, challan, DS-no…"
        isEmpty={Object.keys(table.params).length === 0}
        empty={{ icon: Truck, title: "Nothing dispatched yet" }}
        exportPath="/godown/dispatches/export"
        onRowClick={(row) => onOpen(row.id)}
        rowActions={(row) => <DropdownMenuItem onClick={() => onOpen(row.id)}>Open</DropdownMenuItem>}
      />
    </div>
  );
}

const TABS = ["stock", "movements", "dispatches"] as const;

export function GodownPage() {
  const { data: user } = useCurrentUser();
  const { filters, resetTo: setFilters } = useUrlFilters(["tab"]);
  const tab = (TABS as readonly string[]).includes(filters.tab ?? "") ? filters.tab! : "stock";
  const summary = useStock({ pageSize: 1 }).data?.summary;
  const [dialog, setDialog] = useState<{
    kind: "dispatch" | "adjust";
    articleId: string;
    key: number;
  } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const canManage = hasPermission(user, "godown.manage");
  const canMerge = hasPermission(user, "production.manage");
  const close = (value: boolean) => (value ? undefined : setDialog(null));

  return (
    <RequirePermission permission="godown.view" title="Godown">
      <Page
        title="Godown"
        description="Finished goods by item and size. Packing brings stock in; dispatches take it out."
        actions={
          canManage ? (
            <>
              {canMerge ? <MergeItemsButton /> : null}
              <Button variant="outline" onClick={() => setDialog({ kind: "adjust", articleId: "", key: Date.now() })}>
                Correct a count
              </Button>
              <Button
                onClick={() =>
                  setDialog({
                    kind: "dispatch",
                    articleId: "",
                    key: Date.now(),
                  })
                }
              >
                <Truck aria-hidden />
                Dispatch
              </Button>
            </>
          ) : null
        }
      >
        <div className="grid gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summary ? (
              <>
                <StatCard
                  label="Pieces in stock"
                  icon={Warehouse}
                  value={summary.pieces.toLocaleString("en-IN")}
                  context={`${summary.items} items · ${summary.sizes} sizes`}
                  onClick={() => setFilters({ tab: "" })}
                />
                <StatCard
                  label="In this month"
                  icon={ArrowDownToLine}
                  value={summary.inThisMonth.toLocaleString("en-IN")}
                  context="Packed into the godown"
                  tone="success"
                  onClick={() => setFilters({ tab: "movements" })}
                />
                <StatCard
                  label="Out this month"
                  icon={ArrowUpFromLine}
                  value={summary.outThisMonth.toLocaleString("en-IN")}
                  context="Dispatched and counted out"
                  onClick={() => setFilters({ tab: "dispatches" })}
                />
                <StatCard label="Items in stock" value={String(summary.items)} context="Items / designs with pieces" />
              </>
            ) : (
              Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
            )}
          </div>
          <Tabs value={tab} onValueChange={(value) => setFilters({ tab: value === "stock" ? "" : String(value) })}>
            <TabsList>
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="movements">In & out</TabsTrigger>
              <TabsTrigger value="dispatches">Dispatches</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "stock" ? (
            <StockTable
              canManage={canManage}
              onDispatch={(articleId) => setDialog({ kind: "dispatch", articleId, key: Date.now() })}
              onAdjust={(articleId) => setDialog({ kind: "adjust", articleId, key: Date.now() })}
            />
          ) : tab === "movements" ? (
            <MovementsTable />
          ) : (
            <DispatchTable onOpen={setOpen} />
          )}
        </div>
        {dialog?.kind === "dispatch" ? (
          <DispatchDialog key={dialog.key} articleId={dialog.articleId} onOpenChange={close} />
        ) : null}
        {dialog?.kind === "adjust" ? (
          <AdjustDialog key={dialog.key} articleId={dialog.articleId} onOpenChange={close} />
        ) : null}
        {open ? (
          <DispatchDetail
            id={open}
            canReverse={canManage}
            onOpenChange={(value) => (value ? undefined : setOpen(null))}
          />
        ) : null}
      </Page>
    </RequirePermission>
  );
}
