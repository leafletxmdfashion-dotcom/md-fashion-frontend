"use client";

import { ArrowLeft, HandCoins, Loader2, Plus, Scale, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { SuggestInput } from "@/components/form/suggest-input";
import { Page } from "@/components/page-header";
import { StatCard, StatCardSkeleton } from "@/components/stat-card";
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
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirePermission } from "@/features/auth/components/require-permission";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { formatDate, todayISO } from "@/features/fabric/lib/format";
import { useKarigarOptions } from "@/features/production/hooks/use-production";
import { CATEGORY_LABEL, karigarCode, moneyText } from "@/features/production/lib/format";
import type { KarigarCategory } from "@/features/production/types/production.types";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import { AccountCards, BalanceText, balanceWord, LedgerTable } from "./ledger";
import {
  ENTRY_TYPES,
  METHOD_LABEL,
  useLedger,
  usePeople,
  usePersonAccount,
  useRecordEntry,
  useReverseEntry,
  type LedgerEntry,
  type ManualType,
  type PersonRow,
} from "./payments.api";

const MONEY = /^\d{1,8}(\.\d{1,2})?$/;

const categoryLabel = (category: string) => CATEGORY_LABEL[category as KarigarCategory] ?? category;

function RecordDialog({
  personId,
  type: initialType,
  onOpenChange,
}: {
  personId: string;
  type: ManualType;
  onOpenChange: (open: boolean) => void;
}) {
  const people = useKarigarOptions();
  const record = useRecordEntry();
  const [karigarId, setKarigarId] = useState(personId);
  const [type, setType] = useState<ManualType>(initialType);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<"CASH" | "BANK" | "WALLET">("CASH");
  const [category, setCategory] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const account = usePersonAccount(karigarId || undefined);
  const spec = ENTRY_TYPES[type];
  const movesMoney = type === "PAYMENT" || type === "ADVANCE" || type === "RECOVERY";
  const current = Number(account.data?.summary?.balance ?? 0);
  const typed = MONEY.test(amount.trim()) ? Number(amount) : null;
  const after = typed === null ? null : Math.round((current + spec.sign * typed) * 100) / 100;
  // Active people, plus the one chosen if inactive (they may still have money to settle).
  const owner = account.data?.person;
  const options = [
    ...(people.data ?? []),
    ...(owner && !people.data?.some((item) => item.id === owner.id)
      ? [
          {
            ...owner,
            category: owner.category as KarigarCategory,
            payMode: "SALARY" as const,
          },
        ]
      : []),
  ];
  const person = options.find((item) => item.id === karigarId);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const next: Record<string, string> = {};

    if (!karigarId) next.karigarId = "Choose the person.";

    if (typed === null || typed <= 0) next.amount = "Enter an amount above zero, up to 2 decimals.";

    setErrors(next);

    if (Object.keys(next).length > 0 || typed === null) return;

    try {
      await record.mutateAsync({
        karigarId,
        type,
        amount: typed,
        entryDate: date,
        method: movesMoney ? method : null,
        category: category.trim() || null,
        reference: reference.trim() || null,
        note: note.trim() || null,
      });
      toast.success(`${spec.label} of ${moneyText(typed)} recorded for ${person?.name ?? "the person"}.`);
      onOpenChange(false);
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;

      setErrors(
        Object.fromEntries(Object.entries(apiError?.details ?? {}).map(([key, value]) => [key, value[0] ?? ""])),
      );
      setFormError(apiError?.message ?? "Could not record the entry.");
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Record money</DialogTitle>
          <DialogDescription>
            Payments, advances, expenses and credits update the person&apos;s balance at once.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
          {formError ? <FormAlert>{formError}</FormAlert> : null}
          <Field id="entry-person" label="Person" error={errors.karigarId}>
            <Select
              items={options.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              value={karigarId || null}
              onValueChange={(value) => setKarigarId(value ?? "")}
            >
              <SelectTrigger id="entry-person" className="w-full" aria-invalid={errors.karigarId ? true : undefined}>
                <SelectValue placeholder={people.isLoading ? "Loading…" : "Choose staff or karigar"} />
              </SelectTrigger>
              <SelectContent>
                {options.map((item) => (
                  <SelectItem
                    key={item.id}
                    value={item.id}
                    description={
                      <>
                        {karigarCode(item.number)} · {CATEGORY_LABEL[item.category]}
                      </>
                    }
                  >
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {karigarId && account.data?.summary ? (
              <p className="text-xs text-muted-foreground">
                Balance now: <BalanceText value={current} /> ({balanceWord(current).toLowerCase()})
              </p>
            ) : null}
          </Field>

          <Field id="entry-type" label="What is it?" description={spec.hint}>
            <Select
              items={(Object.keys(ENTRY_TYPES) as ManualType[]).map((key) => ({
                value: key,
                label: ENTRY_TYPES[key].label,
              }))}
              value={type}
              onValueChange={(value) => {
                if (!value) return;
                setType(value as ManualType);
                setCategory("");
              }}
            >
              <SelectTrigger id="entry-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ENTRY_TYPES) as ManualType[]).map((key) => (
                  <SelectItem
                    key={key}
                    value={key}
                    description={
                      <span className={ENTRY_TYPES[key].sign > 0 ? "text-success" : "text-destructive"}>
                        {ENTRY_TYPES[key].sign > 0 ? "+ adds to balance" : "− takes from balance"}
                      </span>
                    }
                  >
                    {ENTRY_TYPES[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="entry-amount" label="Amount" error={errors.amount}>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>Rs</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  {...fieldProps("entry-amount", errors.amount)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="text-right tabular-nums"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </InputGroup>
            </Field>
            <Field id="entry-date" label="Date" error={errors.entryDate}>
              <Input
                id="entry-date"
                type="date"
                max={todayISO()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            {movesMoney ? (
              <Field id="entry-method" label="Paid by">
                <Select
                  items={Object.entries(METHOD_LABEL).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  value={method}
                  onValueChange={(value) => setMethod((value ?? "CASH") as typeof method)}
                >
                  <SelectTrigger id="entry-method" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(METHOD_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="entry-category" label="For" description="Optional" error={errors.category}>
              <SuggestInput
                id="entry-category"
                suggestions={spec.categories}
                value={category}
                onChange={setCategory}
                placeholder={`e.g. ${spec.categories[0]}`}
                maxLength={40}
              />
            </Field>
            <Field id="entry-reference" label="Voucher / cheque no." description="Optional" error={errors.reference}>
              <Input
                id="entry-reference"
                maxLength={60}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
          </div>
          <Field id="entry-note" label="Note" description="Optional" error={errors.note}>
            <Input id="entry-note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          {after !== null && karigarId ? (
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-[13px]">
              <span>
                Balance <BalanceText value={current} /> → <BalanceText value={after} className="text-base" />
              </span>
              <span className={after > 0 ? "text-success" : after < 0 ? "text-destructive" : "text-muted-foreground"}>
                {after > 0 ? "We still owe them" : after < 0 ? "They will owe us" : "Settled"}
              </span>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={record.isPending}>
              {record.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Record {spec.label.toLowerCase()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReverseDialog({ entry, onOpenChange }: { entry: LedgerEntry; onOpenChange: (open: boolean) => void }) {
  const reverse = useReverseEntry();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (reason.trim().length < 3) return setError("Give a reason (at least 3 characters).");

    try {
      await reverse.mutateAsync({ id: entry.id, reason: reason.trim() });
      toast.success(`${entry.label} of ${moneyText(Math.abs(Number(entry.amount)))} reversed.`);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not reverse.");
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reverse this entry?</DialogTitle>
          <DialogDescription>
            {entry.karigar.name} · {entry.label} · {moneyText(Math.abs(Number(entry.amount)))} on{" "}
            {formatDate(entry.date)}. An opposite entry is added; nothing is deleted.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
          {error ? <FormAlert>{error}</FormAlert> : null}
          <Field id="reverse-reason" label="Reason">
            <Input id="reverse-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Keep it
            </Button>
            <Button type="submit" variant="destructive" disabled={reverse.isPending}>
              {reverse.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Reverse
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const PEOPLE_COLUMNS: DataColumn<PersonRow>[] = [
  {
    id: "name",
    header: "Name",
    sortable: true,
    hideable: false,
    filter: { type: "text", placeholder: "Name or phone contains…" },
    skeleton: { sub: true, width: "w-28" },
    cell: (row) => (
      <>
        <p className={cn("font-medium", !row.active && "text-muted-foreground")}>{row.name}</p>
        <p className="text-xs text-muted-foreground">
          {karigarCode(row.number)}
          {row.active ? "" : " · inactive"}
        </p>
      </>
    ),
  },
  {
    id: "category",
    header: "Works as",
    className: "hidden md:table-cell",
    sortable: true,
    filter: {
      type: "enum",
      // SAFETY: CATEGORY_LABEL is keyed by exactly the KarigarCategory values.
      options: (Object.keys(CATEGORY_LABEL) as KarigarCategory[]).map((value) => ({
        value,
        label: CATEGORY_LABEL[value],
      })),
    },
    skeleton: { width: "w-20" },
    cell: (row) => categoryLabel(row.category),
  },
  {
    id: "earned",
    header: "Earned",
    align: "right",
    sortable: true,
    filter: { type: "number", unit: "Rs" },
    skeleton: { width: "w-16" },
    cell: (row) => (
      <>
        <p className="tabular-nums">{moneyText(row.earned)}</p>
        {Number(row.credits) ? <p className="text-xs text-muted-foreground">+{moneyText(row.credits)} credit</p> : null}
      </>
    ),
  },
  {
    id: "paid",
    header: "Paid",
    align: "right",
    sortable: true,
    filter: { type: "number", unit: "Rs" },
    skeleton: { width: "w-16" },
    cell: (row) => <span className="tabular-nums">{moneyText(row.paid)}</span>,
  },
  {
    id: "lent",
    header: "Advances · expenses",
    align: "right",
    className: "hidden lg:table-cell",
    skeleton: { width: "w-16" },
    cell: (row) => (
      <>
        <p className="tabular-nums">{moneyText(Number(row.advances) + Number(row.expenses))}</p>
        {Number(row.recovered) ? (
          <p className="text-xs text-muted-foreground">{moneyText(row.recovered)} back</p>
        ) : null}
      </>
    ),
  },
  {
    id: "balance",
    header: "Balance",
    align: "right",
    sortable: true,
    filter: { type: "number", unit: "Rs" },
    skeleton: { sub: true, width: "w-16" },
    cell: (row) => (
      <>
        <BalanceText value={row.balance} />
        <p className="text-xs text-muted-foreground">{balanceWord(row.balance)}</p>
      </>
    ),
  },
  {
    id: "last",
    header: "Last entry",
    className: "hidden xl:table-cell",
    sortable: true,
    filter: { type: "date" },
    skeleton: { width: "w-20" },
    cell: (row) => (row.lastDate ? formatDate(row.lastDate) : <span className="text-muted-foreground">—</span>),
  },
];

const BALANCE_FILTERS = [
  { value: "", label: "All balances" },
  { value: "owed", label: "To pay" },
  { value: "owing", label: "To receive" },
  { value: "settled", label: "Settled" },
] as const;

function PeopleTable({
  canManage,
  onOpen,
  onRecord,
}: {
  canManage: boolean;
  onOpen: (id: string) => void;
  onRecord: (id: string, type: ManualType) => void;
}) {
  const table = useDataTableState(PEOPLE_COLUMNS, ["balance"]);
  const people = usePeople({
    ...table.params,
    page: table.page,
    pageSize: table.pageSize,
  });
  const balance = table.filters.balance ?? "";
  const picked = BALANCE_FILTERS.find((option) => option.value === balance);

  return (
    <div className="grid gap-2">
      <DataTable
        id="payments-people"
        toolbarStart={
          <Select
            items={BALANCE_FILTERS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            value={balance}
            onValueChange={(next) => table.setFilters({ balance: next ?? "" })}
          >
            <SelectTrigger aria-label="Balance" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BALANCE_FILTERS.map((option) => (
                <SelectItem key={option.value || "all"} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        extraFilters={
          balance && picked
            ? [
                {
                  label: "Balance",
                  value: picked.label,
                  onClear: () => table.setFilters({ balance: "" }),
                },
              ]
            : []
        }
        columns={PEOPLE_COLUMNS}
        rows={people.data?.people}
        rowId={(row) => row.id}
        total={people.data?.total}
        state={table}
        isFetching={people.isFetching}
        isPlaceholderData={people.isPlaceholderData}
        error={people.error}
        onRetry={() => void people.refetch()}
        searchLabel="Search people"
        searchPlaceholder="Search name or phone…"
        isEmpty={Object.keys(table.params).length === 0}
        empty={{
          icon: Users,
          title: "No staff or karigars yet",
          description: "Add them in Staff & Karigar; their balances appear here.",
        }}
        exportPath="/payments/people/export"
        onRowClick={(row) => onOpen(row.id)}
        rowActions={(row) => (
          <>
            <DropdownMenuItem onClick={() => onOpen(row.id)}>Open ledger</DropdownMenuItem>
            {canManage ? (
              <>
                <DropdownMenuItem onClick={() => onRecord(row.id, "PAYMENT")}>Record payment</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRecord(row.id, "ADVANCE")}>Give advance / loan</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRecord(row.id, "EXPENSE")}>Record expense</DropdownMenuItem>
              </>
            ) : null}
          </>
        )}
      />
    </div>
  );
}

function PersonView({
  id,
  canManage,
  onBack,
  onRecord,
  onReverse,
}: {
  id: string;
  canManage: boolean;
  onBack: () => void;
  onRecord: (type: ManualType) => void;
  onReverse: (entry: LedgerEntry) => void;
}) {
  const account = usePersonAccount(id);
  const person = account.data?.person;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Back to balances" onClick={onBack}>
            <ArrowLeft aria-hidden />
          </Button>
          {person ? (
            <div>
              <h2 className="text-base font-semibold">{person.name}</h2>
              <p className="text-xs text-muted-foreground">
                {karigarCode(person.number)} · {categoryLabel(person.category)}
                {person.phone ? ` · ${person.phone}` : ""}
              </p>
            </div>
          ) : (
            <Skeleton className="h-9 w-48" />
          )}
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" onClick={() => onRecord("PAYMENT")}>
              <Wallet aria-hidden />
              Pay
            </Button>
            <Button size="sm" variant="outline" onClick={() => onRecord("ADVANCE")}>
              Advance / loan
            </Button>
            <Button size="sm" variant="outline" onClick={() => onRecord("EXPENSE")}>
              Expense
            </Button>
            <Button size="sm" variant="outline" onClick={() => onRecord("CREDIT")}>
              Credit
            </Button>
            <Button size="sm" variant="outline" onClick={() => onRecord("RECOVERY")}>
              Received back
            </Button>
          </div>
        ) : null}
      </div>
      <AccountCards totals={account.data?.summary} />
      <LedgerTable
        id="payments-person-ledger"
        useEntries={useLedger}
        extra={{ karigarId: id }}
        showPerson={false}
        onReverse={canManage ? onReverse : undefined}
        exportPath="/payments/ledger/export"
      />
    </div>
  );
}

export function PaymentsPage() {
  const { data: user } = useCurrentUser();
  const { filters, resetTo: setFilters } = useUrlFilters(["tab", "person", "balance"]);
  const canManage = hasPermission(user, "payments.manage");
  const summary = usePeople({ page: 1, pageSize: 1 }).data?.summary;
  const [record, setRecord] = useState<{
    personId: string;
    type: ManualType;
    key: number;
  } | null>(null);
  const [reversing, setReversing] = useState<LedgerEntry | null>(null);
  const tab = filters.tab === "entries" ? "entries" : "balances";
  const openRecord = (personId: string, type: ManualType) => setRecord({ personId, type, key: Date.now() });

  return (
    <RequirePermission permission="payments.view" title="Payments">
      <Page
        title="Payments"
        description="Every staff member's and karigar's account: earnings, payments, advances, expenses and credits."
        actions={
          canManage ? (
            <Button onClick={() => openRecord(filters.person ?? "", "PAYMENT")}>
              <Plus aria-hidden />
              Record money
            </Button>
          ) : null
        }
      >
        <div className="grid gap-5">
          {filters.person ? null : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {summary ? (
                <>
                  <StatCard
                    label="To pay"
                    icon={TrendingUp}
                    value={moneyText(summary.payable)}
                    context="Owed to staff and karigars"
                    tone="success"
                    onClick={() => setFilters({ tab: "", balance: "owed" })}
                  />
                  <StatCard
                    label="To receive"
                    icon={TrendingDown}
                    value={moneyText(summary.receivable)}
                    context="Advances above what was earned"
                    tone={Number(summary.receivable) ? "danger" : "default"}
                    onClick={() => setFilters({ tab: "", balance: "owing" })}
                  />
                  <StatCard label="Earned this month" icon={Scale} value={moneyText(summary.earnedThisMonth)} />
                  <StatCard label="Paid this month" icon={Wallet} value={moneyText(summary.paidThisMonth)} />
                  <StatCard
                    label="Spent & lent this month"
                    icon={HandCoins}
                    value={moneyText(Number(summary.expensesThisMonth) + Number(summary.advancesThisMonth))}
                    context={`${moneyText(summary.expensesThisMonth)} expenses · ${moneyText(summary.advancesThisMonth)} advances`}
                  />
                </>
              ) : (
                Array.from({ length: 5 }, (_, index) => <StatCardSkeleton key={index} />)
              )}
            </div>
          )}

          {filters.person ? (
            <PersonView
              id={filters.person}
              canManage={canManage}
              onBack={() => setFilters({ person: "" })}
              onRecord={(type) => openRecord(filters.person!, type)}
              onReverse={setReversing}
            />
          ) : (
            <>
              <Tabs value={tab} onValueChange={(value) => setFilters({ tab: value === "entries" ? "entries" : "" })}>
                <TabsList>
                  <TabsTrigger value="balances">Balances</TabsTrigger>
                  <TabsTrigger value="entries">All entries</TabsTrigger>
                </TabsList>
              </Tabs>
              {tab === "balances" ? (
                <PeopleTable canManage={canManage} onOpen={(id) => setFilters({ person: id })} onRecord={openRecord} />
              ) : (
                <LedgerTable
                  id="payments-ledger"
                  useEntries={useLedger}
                  showPerson
                  onReverse={canManage ? setReversing : undefined}
                  exportPath="/payments/ledger/export"
                />
              )}
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Green: the business owes the person. Red: the person owes the business. Earnings come from{" "}
            <Link href="/cutting" className="text-link hover:underline">
              cutting
            </Link>
            ,{" "}
            <Link href="/stitching" className="text-link hover:underline">
              stitching
            </Link>{" "}
            and{" "}
            <Link href="/packing" className="text-link hover:underline">
              packing
            </Link>
            .
          </p>
        </div>
        {record ? (
          <RecordDialog
            key={record.key}
            personId={record.personId}
            type={record.type}
            onOpenChange={(open) => (open ? undefined : setRecord(null))}
          />
        ) : null}
        {reversing ? (
          <ReverseDialog entry={reversing} onOpenChange={(open) => (open ? undefined : setReversing(null))} />
        ) : null}
      </Page>
    </RequirePermission>
  );
}
