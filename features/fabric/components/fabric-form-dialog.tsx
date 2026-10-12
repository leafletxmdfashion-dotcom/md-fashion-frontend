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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { applyServerError } from "@/lib/form-errors";

import { useCreateFabric, useFabricCategories, useUpdateFabric } from "../hooks/use-fabric";
import { UNIT_LABEL, UNIT_NAME } from "../lib/format";
import type { Fabric, FabricUnit } from "../types/fabric.types";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100, "Keep the name under 100 characters."),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{0,23}$/, "Use up to 24 letters, numbers or dashes."),
  unit: z.enum(["KG", "METER"], { errorMap: () => ({ message: "Choose a unit." }) }),
  category: z.string().trim().max(50, "Keep the category under 50 characters."),
  lowStockThreshold: z.number({ invalid_type_error: "Enter a number." }).min(0, "Cannot be negative.").nullable(),
  description: z.string().trim().max(500, "Keep the description under 500 characters."),
  isActive: z.boolean(),
});

type Values = z.infer<typeof schema>;

const unitItems = (Object.keys(UNIT_NAME) as FabricUnit[]).map((unit) => ({ value: unit, label: UNIT_NAME[unit] }));

const optionalNumber = (value: unknown) => (value === "" || value === null ? null : Number(value));

/** Create when `fabric` is omitted, edit otherwise. Mount with a `key` so each open starts fresh. */
export function FabricFormDialog({
  fabric,
  open,
  onOpenChange,
}: {
  fabric?: Fabric;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateFabric();
  const categories = useFabricCategories();
  const update = useUpdateFabric();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: fabric?.name ?? "",
      code: fabric?.code ?? "",
      unit: fabric?.unit,
      category: fabric?.category ?? "",
      lowStockThreshold: fabric?.lowStockThreshold ?? null,
      description: fabric?.description ?? "",
      isActive: fabric?.isActive ?? true,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const unit = useWatch({ control: form.control, name: "unit" });
  const unitLocked = Boolean(fabric && fabric.movementCount > 0);

  const onSubmit = form.handleSubmit(async ({ isActive, description, ...values }) => {
    const input = { ...values, category: values.category || null, description: description || null };
    try {
      if (fabric) {
        await update.mutateAsync({ id: fabric.id, isActive, ...input });
        toast.success(`${values.name} updated.`);
      } else {
        await create.mutateAsync(input);
        toast.success(`${values.name} added. Record a purchase to bring it into stock.`);
      }
      onOpenChange(false);
    } catch (error) {
      applyServerError(error, form);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{fabric ? "Edit fabric" : "New fabric"}</DialogTitle>
          <DialogDescription>
            {fabric
              ? "Changes apply to future entries. Posted purchases keep their history."
              : "A new fabric starts with zero stock until a purchase is posted."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {errors.root?.server ? <FormAlert>{errors.root.server.message}</FormAlert> : null}

          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field id="fabric-name" label="Name" error={errors.name?.message}>
              <Input
                {...fieldProps("fabric-name", errors.name?.message)}
                placeholder="Cotton Jersey"
                autoComplete="off"
                {...form.register("name")}
              />
            </Field>
            <Field id="fabric-code" label="Code" error={errors.code?.message}>
              <Input
                {...fieldProps("fabric-code", errors.code?.message)}
                placeholder="FB-CTJ"
                autoComplete="off"
                className="uppercase placeholder:normal-case"
                {...form.register("code")}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="fabric-unit"
              label="Unit"
              error={errors.unit?.message}
              description={unitLocked ? "Locked: stock is already recorded in this unit." : undefined}
            >
              <Controller
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <Select
                    items={unitItems}
                    value={field.value ?? null}
                    onValueChange={(next) => field.onChange(next ?? undefined)}
                    disabled={unitLocked}
                  >
                    <SelectTrigger
                      id="fabric-unit"
                      className="w-full"
                      aria-invalid={errors.unit ? true : undefined}
                      aria-describedby={unitLocked ? "fabric-unit-description" : undefined}
                    >
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {unitItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="fabric-category" label="Category (optional)" error={errors.category?.message}>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <SuggestInput
                    {...fieldProps("fabric-category", errors.category?.message)}
                    placeholder="e.g. Knit, Woven, Lining"
                    suggestions={categories.data ?? []}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                )}
              />
            </Field>
          </div>

          <Field
            id="fabric-threshold"
            label="Reorder level"
            error={errors.lowStockThreshold?.message}
            description="Flag this fabric as low when stock falls to this level. Leave blank to skip."
          >
            <InputGroup>
              <InputGroupInput
                {...fieldProps("fabric-threshold", errors.lowStockThreshold?.message, "hint")}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="50"
                {...form.register("lowStockThreshold", { setValueAs: optionalNumber })}
              />
              {unit ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{UNIT_LABEL[unit]}</InputGroupText>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
          </Field>

          <Field id="fabric-description" label="Description" error={errors.description?.message}>
            <Textarea
              {...fieldProps("fabric-description", errors.description?.message)}
              rows={2}
              placeholder="GSM, width, composition…"
              {...form.register("description")}
            />
          </Field>

          {fabric ? (
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <label className="flex items-start justify-between gap-4 rounded-lg border p-3">
                  <span className="grid gap-0.5">
                    <span className="text-[13px] font-medium">Active</span>
                    <span className="text-xs text-muted-foreground">
                      Inactive fabrics are hidden from new purchases. Their history stays.
                    </span>
                  </span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {fabric ? "Save changes" : "Add fabric"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
