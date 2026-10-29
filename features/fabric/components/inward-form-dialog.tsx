"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { SuggestInput } from "@/components/form/suggest-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { applyServerError } from "@/lib/form-errors";
import { cn } from "@/lib/utils";

import { useCreateInward, useFabricOptions, useSuppliers } from "../hooks/use-fabric";
import { amountOf, closeName, formatMoney, formatQty, hasPlaces, inwardNumber, todayISO, UNIT_LABEL, UNIT_NAME } from "../lib/format";
import type { FabricUnit } from "../types/fabric.types";

/** An empty number input reads as NaN; treat it as "not entered". */
const optionalNumber = z.preprocess(
  (value) => (Number.isNaN(value) ? undefined : value),
  z.number().min(0, "Reorder level cannot be negative.").optional(),
);

const schema = z.object({
  fabricName: z.string().trim().min(1, "Enter the fabric name.").max(100, "Keep the name under 100 characters."),
  unit: z.enum(["KG", "METER"]),
  lowStockThreshold: optionalNumber,
  description: z.string().trim().max(500),
  inwardDate: z
    .string()
    .min(1, "Enter the date.")
    .refine((value) => value <= todayISO(), "Date cannot be in the future."),
  // Same precision the API stores, so the amount shown is the amount posted.
  quantity: z
    .number({ invalid_type_error: "Enter a quantity." })
    .positive("Quantity must be more than zero.")
    .refine((value) => hasPlaces(value, 3), "Use at most 3 decimals for quantity."),
  rate: z
    .number({ invalid_type_error: "Enter the rate." })
    .min(0, "Rate cannot be negative.")
    .refine((value) => hasPlaces(value, 2), "Use at most 2 decimals for rate."),
  supplier: z.string().trim().max(100),
  invoiceRef: z.string().trim().max(50),
  notes: z.string().trim().max(500),
});

type Values = z.input<typeof schema>;

const UNITS: FabricUnit[] = ["KG", "METER"];

/** Same comparison the API uses: case ignored, runs of spaces count as one. */
const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** Mount with a `key` so each open starts fresh. */
export function InwardFormDialog({
  open,
  onOpenChange,
  defaultFabricName = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFabricName?: string;
}) {
  const fabrics = useFabricOptions();
  const suppliers = useSuppliers();
  const create = useCreateInward();
  const [showDescription, setShowDescription] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fabricName: defaultFabricName,
      unit: "KG",
      description: "",
      inwardDate: todayISO(),
      supplier: "",
      invoiceRef: "",
      notes: "",
    },
  });

  const { errors, isSubmitting } = form.formState;

  const [fabricName, unit, quantity, rate] = useWatch({
    control: form.control,
    name: ["fabricName", "unit", "quantity", "rate"],
  });

  const key = nameKey(fabricName);
  const existing = key ? fabrics.data?.find((fabric) => nameKey(fabric.name) === key) : undefined;
  const unitLabel = UNIT_LABEL[unit];
  const amount = amountOf(Number.isFinite(quantity) ? quantity : 0, Number.isFinite(rate) ? rate : 0);

  // Typing an existing fabric's name fills in its unit, reorder level and description.
  const existingId = existing?.id;
  useEffect(() => {
    const fabric = fabrics.data?.find((item) => item.id === existingId);

    if (!fabric) return;
    form.setValue("unit", fabric.unit);
    form.setValue("lowStockThreshold", fabric.lowStockThreshold ?? Number.NaN);
    form.setValue("description", fabric.description ?? "");
  }, [existingId, fabrics.data, form]);
  // A fabric that already has a description shows it, so it can be kept or edited.
  const descriptionOpen = showDescription || Boolean(existing?.description);

  // A near-miss of a fabric already bought (e.g. its old misspelling) would create a duplicate.
  const near = existing || !key ? undefined : closeName(fabricName, fabrics.data?.map((fabric) => fabric.name) ?? []);
  const nearFabric = near ? fabrics.data?.find((fabric) => fabric.name === near) : undefined;

  const fabricHint = existing
    ? `Existing fabric · ${existing.code} · ${formatQty(existing.balance, existing.unit)} in stock`
    : nearFabric
      ? `New fabric · did you mean ${nearFabric.name} (${nearFabric.code})? Pick it from the list to add to its stock.`
      : key
        ? "New fabric · its code is assigned when you save"
        : "Type a new name, or pick one you have bought before";

  const onSubmit = form.handleSubmit(async (raw) => {
    const values = schema.parse(raw);

    try {
      const inward = await create.mutateAsync({
        fabricName: values.fabricName,
        unit: values.unit,
        lowStockThreshold: values.lowStockThreshold ?? null,
        description: values.description || null,
        inwardDate: values.inwardDate,
        quantity: values.quantity,
        rate: values.rate,
        supplier: values.supplier || null,
        invoiceRef: values.invoiceRef || null,
        notes: values.notes || null,
      });

      toast.success(
        `${inwardNumber(inward.number)} added: ${formatQty(inward.quantity, inward.fabric.unit)} of ${inward.fabric.name}${
          existing ? "." : ` (new fabric ${inward.fabric.code}).`
        }`,
      );
      onOpenChange(false);
    } catch (error) {
      applyServerError(error, form);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
        // Fabric already named (opened from a filtered list): start typing the quantity.
        initialFocus={defaultFabricName ? () => document.getElementById("inward-quantity") : true}
      >
        <DialogHeader>
          <DialogTitle>Add purchase</DialogTitle>
          <DialogDescription>
            Name the fabric and how much came in. New fabrics are created for you; stock goes up through the ledger.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {errors.root?.server ? <FormAlert>{errors.root.server.message}</FormAlert> : null}

          <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
            <Field id="inward-fabric" label="Fabric name" error={errors.fabricName?.message} description={fabricHint}>
              <Controller
                control={form.control}
                name="fabricName"
                render={({ field }) => (
                  <SuggestInput
                    {...fieldProps("inward-fabric", errors.fabricName?.message)}
                    suggestions={fabrics.data?.map((fabric) => fabric.name) ?? []}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    placeholder="e.g. Cotton Jersey 180 GSM"
                  />
                )}
              />
            </Field>
            <Field
              id="inward-unit"
              label="Unit"
              error={errors.unit?.message}
              description={existing ? "Fixed for this fabric" : undefined}
            >
              <Controller
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <div
                    id="inward-unit"
                    role="radiogroup"
                    aria-label="Unit"
                    aria-invalid={errors.unit ? true : undefined}
                    className="grid h-9 grid-cols-2 gap-1 rounded-lg bg-muted p-1"
                  >
                    {UNITS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={field.value === value}
                        disabled={existing !== undefined && field.value !== value}
                        onClick={() => field.onChange(value)}
                        className={cn(
                          "rounded-md text-[13px] font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40",
                          field.value === value && "bg-card text-foreground shadow-sm",
                        )}
                      >
                        {UNIT_NAME[value]}
                      </button>
                    ))}
                  </div>
                )}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <Field id="inward-date" label="Date" error={errors.inwardDate?.message}>
              <Input
                {...fieldProps("inward-date", errors.inwardDate?.message)}
                type="date"
                max={todayISO()}
                {...form.register("inwardDate")}
              />
            </Field>
            <Field id="inward-quantity" label="Quantity" error={errors.quantity?.message}>
              <InputGroup>
                <InputGroupInput
                  {...fieldProps("inward-quantity", errors.quantity?.message)}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="e.g. 250"
                  {...form.register("quantity", { valueAsNumber: true })}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{unitLabel}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field id="inward-rate" label="Rate" error={errors.rate?.message}>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>Rs</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  {...fieldProps("inward-rate", errors.rate?.message)}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="e.g. 420"
                  {...form.register("rate", { valueAsNumber: true })}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>/{unitLabel}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <div className="grid content-start gap-1.5">
              <span className="text-[13px] font-medium text-foreground/90">Amount</span>
              <output
                htmlFor="inward-quantity inward-rate"
                className="flex h-9 items-center justify-end rounded-md bg-muted px-3 text-sm font-semibold tabular-nums"
              >
                {formatMoney(amount)}
              </output>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              id="inward-threshold"
              label="Reorder level"
              error={errors.lowStockThreshold?.message}
              description="Optional · flags low stock"
            >
              <InputGroup>
                <InputGroupInput
                  {...fieldProps("inward-threshold", errors.lowStockThreshold?.message)}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="e.g. 50"
                  {...form.register("lowStockThreshold", { valueAsNumber: true })}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{unitLabel}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field id="inward-supplier" label="Supplier" error={errors.supplier?.message} description="Optional">
              <Controller
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <SuggestInput
                    {...fieldProps("inward-supplier", errors.supplier?.message)}
                    suggestions={suppliers.data ?? []}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    placeholder="e.g. Sunrise Knits"
                  />
                )}
              />
            </Field>
            <Field
              id="inward-invoice"
              label="Invoice / bill no."
              error={errors.invoiceRef?.message}
              description="Optional"
            >
              <Input
                {...fieldProps("inward-invoice", errors.invoiceRef?.message)}
                autoComplete="off"
                placeholder="e.g. INV-1042"
                {...form.register("invoiceRef")}
              />
            </Field>
          </div>

          {descriptionOpen ? (
            <Field id="inward-description" label="Fabric description" error={errors.description?.message}>
              <Textarea
                {...fieldProps("inward-description", errors.description?.message)}
                rows={2}
                placeholder="e.g. 180 GSM, 72 inch width, bio-washed"
                {...form.register("description")}
              />
            </Field>
          ) : null}

          <Field id="inward-notes" label="Notes" error={errors.notes?.message}>
            <Textarea
              {...fieldProps("inward-notes", errors.notes?.message)}
              rows={2}
              placeholder="Anything to remember about this delivery (optional)"
              {...form.register("notes")}
            />
          </Field>

          <DialogFooter className="sm:justify-between">
            {descriptionOpen ? (
              <span />
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowDescription(true)}>
                <Plus aria-hidden />
                Add fabric description
              </Button>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Add purchase
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
