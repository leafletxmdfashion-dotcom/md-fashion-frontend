"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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

import { useCreateInward, useFabricOptions, useSuppliers } from "../hooks/use-fabric";
import { formatMoney, formatQty, inwardNumber, todayISO, UNIT_LABEL } from "../lib/format";
import { FabricCombobox } from "./fabric-combobox";

const schema = z.object({
  fabricId: z.string().min(1, "Choose a fabric."),
  inwardDate: z
    .string()
    .min(1, "Enter the date.")
    .refine((value) => value <= todayISO(), "Date cannot be in the future."),
  quantity: z.number({ invalid_type_error: "Enter a quantity." }).positive("Quantity must be more than zero."),
  rate: z.number({ invalid_type_error: "Enter the rate." }).min(0, "Rate cannot be negative."),
  supplier: z.string().trim().max(100),
  invoiceRef: z.string().trim().max(50),
  notes: z.string().trim().max(500),
});

type Values = z.infer<typeof schema>;

const blank = (fabricId = ""): Partial<Values> => ({
  fabricId,
  inwardDate: todayISO(),
  supplier: "",
  invoiceRef: "",
  notes: "",
});

/** Mount with a `key` so each open starts fresh. */
export function InwardFormDialog({
  open,
  onOpenChange,
  defaultFabricId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFabricId?: string;
}) {
  const fabrics = useFabricOptions();
  const suppliers = useSuppliers();
  const create = useCreateInward();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: blank(defaultFabricId) });
  const { errors, isSubmitting } = form.formState;

  const active = fabrics.data ?? [];
  const [fabricId, quantity, rate] = useWatch({ control: form.control, name: ["fabricId", "quantity", "rate"] });
  const fabric = active.find((item) => item.id === fabricId);
  const unit = fabric ? UNIT_LABEL[fabric.unit] : null;
  const amount = (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(rate) ? rate : 0);

  const onSubmit = form.handleSubmit(async (values) => {
    const input = {
      ...values,
      supplier: values.supplier || null,
      invoiceRef: values.invoiceRef || null,
      notes: values.notes || null,
    };
    try {
      const inward = await create.mutateAsync(input);
      toast.success(
        `${inwardNumber(inward.number)} posted: ${formatQty(inward.quantity, inward.fabric.unit)} of ${inward.fabric.name}.`,
      );
      onOpenChange(false);
    } catch (error) {
      applyServerError(error, form);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
        // Fabric already chosen (opened from a fabric row): start typing the quantity.
        initialFocus={defaultFabricId ? () => document.getElementById("inward-quantity") : true}
      >
        <DialogHeader>
          <DialogTitle>Record purchase</DialogTitle>
          <DialogDescription>Posting adds the quantity to stock through the ledger.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {errors.root?.server ? <FormAlert>{errors.root.server.message}</FormAlert> : null}

          <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
            <Field id="inward-fabric" label="Fabric" error={errors.fabricId?.message}>
              <Controller
                control={form.control}
                name="fabricId"
                render={({ field }) => (
                  <FabricCombobox
                    id="inward-fabric"
                    fabrics={active}
                    value={field.value}
                    onChange={field.onChange}
                    invalid={Boolean(errors.fabricId)}
                  />
                )}
              />
            </Field>
            <Field id="inward-date" label="Date" error={errors.inwardDate?.message}>
              <Input
                {...fieldProps("inward-date", errors.inwardDate?.message)}
                type="date"
                max={todayISO()}
                {...form.register("inwardDate")}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="inward-quantity" label="Quantity" error={errors.quantity?.message}>
              <InputGroup>
                <InputGroupInput
                  {...fieldProps("inward-quantity", errors.quantity?.message)}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  {...form.register("quantity", { valueAsNumber: true })}
                />
                {unit ? (
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{unit}</InputGroupText>
                  </InputGroupAddon>
                ) : null}
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
                  {...form.register("rate", { valueAsNumber: true })}
                />
                {unit ? (
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>/{unit}</InputGroupText>
                  </InputGroupAddon>
                ) : null}
              </InputGroup>
            </Field>
            <div className="grid gap-1.5">
              <span className="text-[13px] font-medium text-foreground/90">Amount</span>
              <output
                htmlFor="inward-quantity inward-rate"
                className="flex h-9 items-center justify-end rounded-md bg-muted px-3 text-sm font-semibold tabular-nums"
              >
                {formatMoney(amount)}
              </output>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="inward-supplier" label="Supplier" error={errors.supplier?.message}>
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
                  />
                )}
              />
            </Field>
            <Field id="inward-invoice" label="Invoice / bill no." error={errors.invoiceRef?.message}>
              <Input
                {...fieldProps("inward-invoice", errors.invoiceRef?.message)}
                autoComplete="off"
                {...form.register("invoiceRef")}
              />
            </Field>
          </div>

          <Field id="inward-notes" label="Notes" error={errors.notes?.message}>
            <Textarea {...fieldProps("inward-notes", errors.notes?.message)} rows={2} {...form.register("notes")} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Post purchase
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
