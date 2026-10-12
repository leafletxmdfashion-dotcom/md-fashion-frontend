"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Minus, Plus } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
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

import { useAdjustStock } from "../hooks/use-fabric";
import { formatQty, UNIT_LABEL } from "../lib/format";
import type { Fabric } from "../types/fabric.types";

const schema = z.object({
  direction: z.enum(["IN", "OUT"]),
  quantity: z.number({ invalid_type_error: "Enter a quantity." }).positive("Quantity must be more than zero."),
  reason: z.string().trim().min(3, "Give a reason (at least 3 characters).").max(500),
  color: z.string().trim().max(50),
  rollRef: z.string().trim().max(50),
});

type Values = z.infer<typeof schema>;

const DIRECTIONS = [
  { value: "IN", label: "Increase", icon: Plus },
  { value: "OUT", label: "Reduce", icon: Minus },
] as const;

export function AdjustStockDialog({
  fabric,
  open,
  onOpenChange,
}: {
  fabric: Fabric;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const adjust = useAdjustStock();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { direction: "OUT", reason: "", color: "", rollRef: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const [direction, quantity] = useWatch({ control: form.control, name: ["direction", "quantity"] });
  const delta = Number.isFinite(quantity) && quantity > 0 ? (direction === "IN" ? quantity : -quantity) : 0;
  const after = fabric.balance + delta;

  const onSubmit = form.handleSubmit(async ({ color, rollRef, ...values }) => {
    try {
      await adjust.mutateAsync({ fabricId: fabric.id, ...values, color: color || null, rollRef: rollRef || null });
      toast.success(`Stock adjusted. ${fabric.name} is now ${formatQty(after, fabric.unit)}.`);
      onOpenChange(false);
    } catch (error) {
      applyServerError(error, form);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {fabric.name} · {fabric.code}. Use this for physical-count corrections. It is recorded in the ledger with
            your reason.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {errors.root?.server ? <FormAlert>{errors.root.server.message}</FormAlert> : null}

          <Controller
            control={form.control}
            name="direction"
            render={({ field }) => (
              <div role="radiogroup" aria-label="Direction" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                {DIRECTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={field.value === value}
                    onClick={() => field.onChange(value)}
                    className={cn(
                      "inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      field.value === value && "bg-card text-foreground shadow-sm",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            )}
          />

          <Field id="adjust-quantity" label="Quantity" error={errors.quantity?.message}>
            <InputGroup>
              <InputGroupInput
                {...fieldProps("adjust-quantity", errors.quantity?.message)}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                autoFocus
                {...form.register("quantity", { valueAsNumber: true })}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{UNIT_LABEL[fabric.unit]}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>

          <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-[13px]">
            <div>
              <dt className="text-xs text-muted-foreground">Current stock</dt>
              <dd className="font-medium tabular-nums">{formatQty(fabric.balance, fabric.unit)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">After adjustment</dt>
              <dd className={cn("font-medium tabular-nums", after < 0 && "text-destructive")}>
                {formatQty(after, fabric.unit)}
              </dd>
            </div>
          </dl>

          <Field id="adjust-reason" label="Reason" error={errors.reason?.message}>
            <Textarea
              {...fieldProps("adjust-reason", errors.reason?.message)}
              rows={2}
              placeholder="Physical count after godown audit"
              {...form.register("reason")}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="adjust-color" label="Colour (optional)" error={errors.color?.message}>
              <Input {...fieldProps("adjust-color", errors.color?.message)} {...form.register("color")} />
            </Field>
            <Field id="adjust-roll" label="Than / roll (optional)" error={errors.rollRef?.message}>
              <Input {...fieldProps("adjust-roll", errors.rollRef?.message)} {...form.register("rollRef")} />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Post adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
