"use client";

import { AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray } from "react-hook-form";

import { fieldProps } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { costOf, type BatchResult } from "../lib/cutting-calc";
import { microKgText, moneyText } from "../lib/format";
import { STEPS, type StepId } from "../lib/form-model";
import { CellError } from "./form-parts";
import type { StepProps } from "./step-details";

export interface Blocker {
  step: StepId;
  message: string;
}

function ColourRejects({ form, errorAt, colourIndex, sizes }: StepProps & { colourIndex: number; sizes: string[] }) {
  const rejects = useFieldArray({ control: form.control, name: `colours.${colourIndex}.rejects`, keyName: "key" });
  const colourName = form.watch(`colours.${colourIndex}.name`) || `Colour ${colourIndex + 1}`;

  return (
    <div className="grid gap-2">
      <p className="text-[13px] font-medium">{colourName}</p>
      {rejects.fields.map((row, index) => {
        const path = `colours.${colourIndex}.rejects.${index}`;
        const id = `reject-${colourIndex}-${index}`;

        return (
          <div key={row.key} className="grid gap-2 sm:grid-cols-[8rem_8rem_minmax(0,1fr)_2.25rem] sm:items-start">
            <div>
              <Controller
                control={form.control}
                name={`colours.${colourIndex}.rejects.${index}.sizeLabel`}
                render={({ field }) => (
                  <Select
                    items={sizes.map((size) => ({ value: size, label: size }))}
                    value={field.value || null}
                    onValueChange={(next) => field.onChange(next ?? "")}
                  >
                    <SelectTrigger
                      id={`${id}-size`}
                      className="w-full"
                      aria-label={`Rejected size, ${colourName}`}
                      aria-invalid={Boolean(errorAt(`${path}.sizeLabel`)) || undefined}
                    >
                      <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent>
                      {sizes.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <CellError id={`${id}-size-error`} message={errorAt(`${path}.sizeLabel`)} />
            </div>
            <div>
              <Input
                {...fieldProps(`${id}-qty`, errorAt(`${path}.quantity`))}
                aria-label={`Rejected pieces, ${colourName}`}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                placeholder="Pieces"
                className="text-right tabular-nums"
                {...form.register(`colours.${colourIndex}.rejects.${index}.quantity`)}
              />
              <CellError id={`${id}-qty-error`} message={errorAt(`${path}.quantity`)} />
            </div>
            <div>
              <Input
                {...fieldProps(`${id}-reason`, errorAt(`${path}.reason`))}
                aria-label={`Reason, ${colourName}`}
                placeholder="Reason, e.g. hole in fabric"
                autoComplete="off"
                {...form.register(`colours.${colourIndex}.rejects.${index}.reason`)}
              />
              <CellError id={`${id}-reason-error`} message={errorAt(`${path}.reason`)} />
            </div>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove rejected pieces" onClick={() => rejects.remove(index)}>
              <Trash2 aria-hidden />
            </Button>
          </div>
        );
      })}
      <div>
        <Button type="button" variant="ghost" size="sm" onClick={() => rejects.append({ sizeLabel: "", quantity: "", reason: "" })}>
          <Plus aria-hidden />
          Add rejected pieces
        </Button>
      </div>
    </div>
  );
}

/** Section 4: pieces damaged in cutting, per colour and size. */
export function RejectedPieces(props: StepProps) {
  const sizes = props.calc.colours[0]?.sizes.map((size) => size.label) ?? [];

  return (
    <div className="grid gap-5 rounded-lg border bg-card p-4 sm:p-5">
      {props.calc.colours.map((_, index) => (
        <ColourRejects key={index} {...props} colourIndex={index} sizes={sizes} />
      ))}
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "warning" | "danger" | "muted" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-medium tabular-nums",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** The live summary beside the form: output, material balance, cost and what still blocks posting. */
export function SummaryAside({
  calc,
  target,
  blockers,
  onGoTo,
  fabricRate,
  storeKg,
  toIssueKg,
  actions,
}: {
  calc: BatchResult;
  target: number | null;
  blockers: Blocker[];
  onGoTo: (step: StepId) => void;
  /** Average purchase rate per kg; null when costs are hidden or unknown. */
  fabricRate: number | null;
  storeKg: bigint | null;
  toIssueKg: bigint;
  actions: React.ReactNode;
}) {
  const { totals } = calc;
  const sizes = calc.colours[0]?.sizes.map((size) => size.label) ?? [];

  const bySize = sizes.map((label) => ({
    label,
    accepted: calc.colours.reduce((sum, colour) => sum + (colour.sizes.find((size) => size.label === label)?.accepted ?? 0), 0),
  }));

  const reconciled = totals.consumedKg + totals.returnedKg + totals.wastageKg === totals.issuedKg;

  const wastePercent =
    totals.issuedKg > 0n ? Number((totals.wastageKg * 10_000n) / totals.issuedKg) / 100 : null;

  const short = storeKg !== null && toIssueKg > storeKg;
  const rate = fabricRate === null ? null : fabricRate.toFixed(4);
  const rejected = totals.plannedPieces - totals.acceptedPieces;

  return (
    <aside aria-label="Cutting summary" className="grid content-start gap-4 rounded-lg border bg-card p-4 text-[13px]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Summary</h2>
        <span className="text-xs text-muted-foreground">Updates as you type</span>
      </div>

      <dl className="grid grid-cols-2 gap-3" aria-live="polite">
        <div className="rounded-md bg-muted/60 px-3 py-2">
          <dt className="text-xs text-muted-foreground">Pieces</dt>
          <dd className="text-2xl font-bold tabular-nums">{totals.acceptedPieces.toLocaleString("en-IN")}</dd>
          <dd className="text-xs text-muted-foreground">
            {target !== null && Number.isFinite(target) ? `of ${target.toLocaleString("en-IN")} target` : "No target yet"}
          </dd>
        </div>
        <div className="rounded-md bg-muted/60 px-3 py-2">
          <dt className="text-xs text-muted-foreground">Pala</dt>
          <dd className="text-2xl font-bold tabular-nums">{totals.confirmedPala}</dd>
          <dd className="text-xs text-muted-foreground">
            {calc.marker.activePalaKg === null ? "No Pala weight" : `${microKgText(calc.marker.activePalaKg)} each`}
          </dd>
        </div>
      </dl>

      {bySize.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Pieces by size</p>
          <div className="flex flex-wrap gap-1.5">
            {bySize.map((size) => (
              <span key={size.label} className="rounded-md border px-2 py-0.5 tabular-nums">
                <span className="text-muted-foreground">{size.label}</span> <strong>{size.accepted}</strong>
              </span>
            ))}
          </div>
          {rejected > 0 ? <p className="mt-1 text-xs text-destructive">{rejected} rejected, not counted</p> : null}
          {calc.colours.length > 1 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {calc.colours.map((colour, index) => `${colour.name || `Colour ${index + 1}`} ${colour.totals.acceptedPieces}`).join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="border-t pt-3">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Fabric</p>
        <dl className="divide-y">
          <Line label="Issued" value={microKgText(totals.issuedKg)} />
          <Line label="Consumed" value={microKgText(totals.consumedKg)} />
          <Line label="Returned" value={microKgText(totals.returnedKg)} />
          <Line
            label={wastePercent === null ? "Wastage" : `Wastage (${wastePercent.toLocaleString("en-IN")}%)`}
            value={microKgText(totals.wastageKg)}
            tone={totals.wastageKg > 0n ? "warning" : undefined}
          />
          {storeKg !== null ? (
            <Line label="In store" value={microKgText(storeKg)} tone={short ? "danger" : "muted"} />
          ) : null}
          {rate !== null ? (
            <Line label="Fabric cost (est.)" value={moneyText(Number(costOf(totals.consumedKg + totals.wastageKg, rate)) / 100)} />
          ) : null}
        </dl>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {reconciled ? (
            <CheckCircle2 className="size-3.5 text-success" aria-hidden />
          ) : (
            <AlertTriangle className="size-3.5 text-destructive" aria-hidden />
          )}
          Issued = consumed + returned + wastage
        </p>
        {short ? <p className="mt-1 text-xs text-destructive">This cutting issues {microKgText(toIssueKg)}, more than the store holds.</p> : null}
      </div>

      <div className="border-t pt-3">
        {blockers.length === 0 ? (
          <p className="flex items-center gap-1.5 font-medium text-success">
            <CheckCircle2 className="size-4" aria-hidden />
            Ready to post
          </p>
        ) : (
          <>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Still needed to finalize</p>
            <ul className="grid gap-1">
              {blockers.map((blocker, index) => (
                <li key={index}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-1.5 rounded-sm text-left hover:text-link focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    onClick={() => onGoTo(blocker.step)}
                    title={`Go to ${STEPS.find((step) => step.id === blocker.step)?.title}`}
                  >
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
                    {blocker.message}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {calc.warnings.length > 0 ? (
          <ul className="mt-2 grid gap-1 text-xs text-warning">
            {calc.warnings.map((warning) => (
              <li key={warning.path}>{warning.message}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {actions}
    </aside>
  );
}
