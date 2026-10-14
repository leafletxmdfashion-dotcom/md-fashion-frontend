"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, UserRound } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
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
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { applyServerError } from "@/lib/form-errors";

import { useKarigars, useSaveKarigar } from "../hooks/use-production";
import { CATEGORY_LABEL, moneyText, PAY_MODE_LABEL, PAY_UNIT } from "../lib/format";
import type { Karigar, KarigarCategory, PayMode } from "../types/production.types";
import { ProductionPage } from "./production-pages";

// SAFETY: the label map is a total Record over the union, so its keys are exactly the union members.
const CATEGORIES = Object.keys(CATEGORY_LABEL) as KarigarCategory[];

// SAFETY: the label map is a total Record over the union, so its keys are exactly the union members.
const PAY_MODES = Object.keys(PAY_MODE_LABEL) as PayMode[];

const schema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  phone: z.string().trim().max(20),
  category: z.enum(["CUTTING_MASTER", "TAILOR", "HELPER", "OTHER"]),
  payMode: z.enum(["PER_PIECE", "PER_PALA", "PER_KG", "FIXED_JOB", "SALARY"]),
  payRate: z.number({ invalid_type_error: "Enter the rate." }).min(0, "Rate cannot be negative."),
  active: z.boolean(),
  notes: z.string().trim().max(500),
});

type Values = z.infer<typeof schema>;

function KarigarDialog({ karigar, onOpenChange }: { karigar?: Karigar; onOpenChange: (open: boolean) => void }) {
  const save = useSaveKarigar();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: karigar?.name ?? "",
      phone: karigar?.phone ?? "",
      category: karigar?.category ?? "CUTTING_MASTER",
      payMode: karigar?.payMode ?? "PER_PIECE",
      payRate: karigar?.payRate ?? 0,
      active: karigar?.active ?? true,
      notes: karigar?.notes ?? "",
    },
  });

  const { errors, isSubmitting } = form.formState;
  const payMode = useWatch({ control: form.control, name: "payMode" });
  const unit = PAY_UNIT[payMode];

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        id: karigar?.id,
        ...values,
        payRate: values.payMode === "SALARY" ? 0 : values.payRate,
        phone: values.phone || null,
        notes: values.notes || null,
      });

      toast.success(`${saved.name} saved.`);
      onOpenChange(false);
    } catch (error) {
      applyServerError(error, form);
    }
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{karigar ? `Edit ${karigar.name}` : "New karigar"}</DialogTitle>
          <DialogDescription>
            The pay mode decides what each finalized job earns. A new rate applies to future jobs; past earnings keep the
            rate they were posted with.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {errors.root?.server ? <FormAlert>{errors.root.server.message}</FormAlert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="karigar-name" label="Name" error={errors.name?.message}>
              <Input {...fieldProps("karigar-name", errors.name?.message)} autoFocus {...form.register("name")} />
            </Field>
            <Field id="karigar-phone" label="Phone" error={errors.phone?.message}>
              <Input {...fieldProps("karigar-phone", errors.phone?.message)} type="tel" {...form.register("phone")} />
            </Field>
            <Field id="karigar-category" label="Category" error={errors.category?.message}>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <Select
                    items={CATEGORIES.map((value) => ({ value, label: CATEGORY_LABEL[value] }))}
                    value={field.value}
                    onValueChange={(next) => next && field.onChange(next)}
                  >
                    <SelectTrigger id="karigar-category" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {CATEGORY_LABEL[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="karigar-pay" label="Paid" error={errors.payMode?.message}>
              <Controller
                control={form.control}
                name="payMode"
                render={({ field }) => (
                  <Select
                    items={PAY_MODES.map((value) => ({ value, label: PAY_MODE_LABEL[value] }))}
                    value={field.value}
                    onValueChange={(next) => next && field.onChange(next)}
                  >
                    <SelectTrigger id="karigar-pay" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAY_MODES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {PAY_MODE_LABEL[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          {unit ? (
            <Field id="karigar-rate" label="Rate" error={errors.payRate?.message}>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>Rs</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  {...fieldProps("karigar-rate", errors.payRate?.message)}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  {...form.register("payRate", { valueAsNumber: true })}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>/ {unit}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          ) : (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-[13px] text-muted-foreground">
              Paid daily or by salary: finalized jobs post no per-job earning.
            </p>
          )}
          <Field id="karigar-notes" label="Notes" error={errors.notes?.message}>
            <Textarea {...fieldProps("karigar-notes", errors.notes?.message)} rows={2} {...form.register("notes")} />
          </Field>
          {karigar ? (
            <Controller
              control={form.control}
              name="active"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox id="karigar-active" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                  <Label htmlFor="karigar-active" className="text-[13px] font-normal">
                    Active (can be chosen for new work)
                  </Label>
                </div>
              )}
            />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save karigar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function columns(showPay: boolean): DataColumn<Karigar>[] {
  const all: (DataColumn<Karigar> | null)[] = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      hideable: false,
      filter: { type: "text", placeholder: "Name or phone contains…" },
      skeleton: { sub: true, width: "w-28" },
      csv: (karigar) => karigar.name,
      cell: (karigar) => (
        <>
          <p className="font-medium">{karigar.name}</p>
          <p className="text-xs text-muted-foreground">{karigar.phone ?? `K-${String(karigar.number).padStart(3, "0")}`}</p>
        </>
      ),
    },
    {
      id: "category",
      header: "Category",
      sortable: true,
      filter: { type: "enum", options: CATEGORIES.map((value) => ({ value, label: CATEGORY_LABEL[value] })) },
      skeleton: { width: "w-24" },
      csv: (karigar) => CATEGORY_LABEL[karigar.category],
      cell: (karigar) => CATEGORY_LABEL[karigar.category],
    },
    {
      id: "payMode",
      header: "Paid",
      className: "hidden md:table-cell",
      sortable: true,
      filter: { type: "enum", options: PAY_MODES.map((value) => ({ value, label: PAY_MODE_LABEL[value] })) },
      skeleton: { width: "w-28" },
      csv: (karigar) => PAY_MODE_LABEL[karigar.payMode],
      cell: (karigar) => (
        <span className="text-muted-foreground">
          {PAY_MODE_LABEL[karigar.payMode]}
          {showPay && karigar.payRate !== null && PAY_UNIT[karigar.payMode]
            ? ` · ${moneyText(karigar.payRate)} / ${PAY_UNIT[karigar.payMode]}`
            : ""}
        </span>
      ),
    },
    showPay
      ? {
          id: "earned",
          header: "Earned",
          align: "right",
          sortable: true,
          filter: { type: "number", unit: "Rs" },
          skeleton: { width: "w-20" },
          csv: (karigar) => karigar.earned,
          cell: (karigar) => <span className="font-medium tabular-nums">{moneyText(karigar.earned)}</span>,
        }
      : null,
    {
      id: "status",
      header: "Status",
      sortable: true,
      filter: {
        type: "enum",
        options: [
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ],
      },
      skeleton: { width: "w-14" },
      csv: (karigar) => (karigar.active ? "Active" : "Inactive"),
      cell: (karigar) => (
        <StatusChip tone={karigar.active ? "success" : "neutral"}>{karigar.active ? "Active" : "Inactive"}</StatusChip>
      ),
    },
  ];

  return all.flatMap((column) => (column ? [column] : []));
}

const WITH_PAY = columns(true);

const WITHOUT_PAY = columns(false);

export function KarigarList() {
  const { data: user } = useCurrentUser();
  const canManage = hasPermission(user, "karigar.manage");
  const showPay = canManage || hasPermission(user, "costing.view");
  const cols = showPay ? WITH_PAY : WITHOUT_PAY;
  const table = useDataTableState(WITH_PAY);
  const list = useKarigars({ ...table.params, page: table.page, pageSize: table.pageSize });
  const [dialog, setDialog] = useState<{ karigar?: Karigar; key: number } | null>(null);

  const newButton = canManage ? (
    <Button onClick={() => setDialog({ key: Date.now() })}>
      <Plus aria-hidden />
      New karigar
    </Button>
  ) : null;

  return (
    <ProductionPage
      title="Karigar Master"
      description="Workers, their category and how each is paid. Cutting masters are chosen from here."
      permission="karigar.view"
    >
      <DataTable
        id="karigars"
        columns={cols}
        rows={list.data?.karigars}
        rowId={(karigar) => karigar.id}
        total={list.data?.total}
        state={table}
        isFetching={list.isFetching}
        isPlaceholderData={list.isPlaceholderData}
        error={list.error}
        onRetry={() => void list.refetch()}
        searchLabel="Search karigars"
        searchPlaceholder="Search name or phone…"
        isEmpty={list.data !== undefined && list.data.total === 0 && !table.isFiltered}
        empty={{
          icon: UserRound,
          title: "No karigars yet",
          description: "Add cutting masters and other workers with how they are paid.",
          action: newButton,
        }}
        toolbarEnd={newButton}
        onRowClick={canManage ? (karigar) => setDialog({ karigar, key: Date.now() }) : undefined}
        rowActions={
          canManage
            ? (karigar) => (
                <DropdownMenuItem onClick={() => setDialog({ karigar, key: Date.now() })}>Edit karigar</DropdownMenuItem>
              )
            : undefined
        }
      />
      {dialog ? (
        <KarigarDialog key={dialog.key} karigar={dialog.karigar} onOpenChange={(open) => (open ? null : setDialog(null))} />
      ) : null}
    </ProductionPage>
  );
}
