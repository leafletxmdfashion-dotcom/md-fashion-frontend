"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { applyServerError } from "@/lib/form-errors";

import { useFabric, useUpdateFabric } from "../hooks/use-fabric";
import { UNIT_LABEL, UNIT_NAME } from "../lib/format";
import type { Fabric, FabricUnit } from "../types/fabric.types";

const schema = z.object({
  name: z.string().trim().min(1, "Enter the fabric name.").max(100, "Keep the name under 100 characters."),
  unit: z.enum(["KG", "METER"]),
  // An empty number input reads as NaN: no reorder level.
  lowStockThreshold: z.preprocess(
    (value) => (Number.isNaN(value) ? undefined : value),
    z.number().min(0, "Reorder level cannot be negative.").optional(),
  ),
  description: z.string().trim().max(500),
});

type Values = z.input<typeof schema>;

const UNITS: FabricUnit[] = ["KG", "METER"];

function EditForm({ fabric, onDone }: { fabric: Fabric; onDone: () => void }) {
  const update = useUpdateFabric();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: fabric.name,
      unit: fabric.unit,
      lowStockThreshold: fabric.lowStockThreshold ?? Number.NaN,
      description: fabric.description ?? "",
    },
  });

  const { errors, isSubmitting } = form.formState;
  // Posted quantities are in this unit; the API refuses to rescale them.
  const unitFixed = fabric.movementCount > 0;
  const unit = useWatch({ control: form.control, name: "unit" });

  const onSubmit = form.handleSubmit(async (raw) => {
    const values = schema.parse(raw);

    try {
      const saved = await update.mutateAsync({
        id: fabric.id,
        name: values.name,
        unit: values.unit,
        lowStockThreshold: values.lowStockThreshold ?? null,
        description: values.description || null,
      });

      toast.success(`${saved.name} updated.`);
      onDone();
    } catch (error) {
      applyServerError(error, form);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {errors.root?.server ? <FormAlert>{errors.root.server.message}</FormAlert> : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <Field
          id="fabric-name"
          label="Fabric name"
          error={errors.name?.message}
          description="Future purchases must use this name to add to this fabric"
        >
          <Input
            {...fieldProps("fabric-name", errors.name?.message)}
            autoComplete="off"
            placeholder="e.g. Cotton Jersey 180 GSM"
            autoFocus
            {...form.register("name")}
          />
        </Field>
        <Field
          id="fabric-unit"
          label="Unit"
          error={errors.unit?.message}
          description={unitFixed ? "Fixed once stock is posted" : undefined}
        >
          <Controller
            control={form.control}
            name="unit"
            render={({ field }) => (
              <SegmentedControl
                id="fabric-unit"
                aria-label="Unit"
                fill
                value={field.value}
                onValueChange={field.onChange}
                options={UNITS.map((value) => ({
                  value,
                  label: UNIT_NAME[value],
                  disabled: unitFixed && field.value !== value,
                }))}
              />
            )}
          />
        </Field>
      </div>

      <Field
        id="fabric-threshold"
        label="Reorder level"
        error={errors.lowStockThreshold?.message}
        description="Optional · flags low stock"
      >
        <InputGroup>
          <InputGroupInput
            {...fieldProps("fabric-threshold", errors.lowStockThreshold?.message)}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="e.g. 50"
            {...form.register("lowStockThreshold", { valueAsNumber: true })}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText>{UNIT_LABEL[unit]}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </Field>

      <Field id="fabric-description" label="Description" error={errors.description?.message} description="Optional">
        <Textarea
          {...fieldProps("fabric-description", errors.description?.message)}
          rows={2}
          placeholder="e.g. 180 GSM, 72 inch width, bio-washed"
          {...form.register("description")}
        />
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Fixes a fabric's name, unit (before any stock), reorder level or description. Mount with a `key`. */
export function EditFabricDialog({
  fabricId,
  open,
  onOpenChange,
}: {
  fabricId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fabric = useFabric(fabricId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit fabric</DialogTitle>
          <DialogDescription>
            {fabric.data ? `${fabric.data.code} · ` : null}Fix a misspelt name or update its details. Stock and history
            stay as they are.
          </DialogDescription>
        </DialogHeader>
        {fabric.data ? (
          <EditForm fabric={fabric.data} onDone={() => onOpenChange(false)} />
        ) : fabric.isError ? (
          <FormAlert>Could not load this fabric. Close and try again.</FormAlert>
        ) : (
          <div className="grid gap-4" aria-busy>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
