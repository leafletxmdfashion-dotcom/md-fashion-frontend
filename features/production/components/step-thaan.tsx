"use client";

import { Lock, Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray } from "react-hook-form";

import { fieldProps } from "@/components/form/field";
import { SuggestInput } from "@/components/form/suggest-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { formatKg, type Issue, type RollResult } from "../lib/cutting-calc";
import { microKgText, unitShort } from "../lib/format";
import { emptyRoll } from "../lib/form-model";
import { CellError } from "./form-parts";
import type { StepProps } from "./step-details";

const ROW = "md:grid-cols-[minmax(0,1fr)_8rem_6.5rem_8rem_9rem_2.25rem]";

const LOCKED = "Issued from the store: colour and quantity are fixed. Enter what came back under Returned.";

/** Step 3: one row per Thaan: its colour, the weight issued, and the Pala cut from it. */
export function StepThaan({
  form,
  errorAt,
  unit,
  storeKg,
  toIssueKg,
  fabricName,
  results,
  warnings,
}: StepProps & {
  storeKg: bigint | null;
  toIssueKg: bigint;
  fabricName: string | null;
  /** The calculation for each row, in row order. */
  results: (RollResult | undefined)[];
  /** Calculator warnings, on form row paths. */
  warnings: Issue[];
}) {
  const rows = useFieldArray({ control: form.control, name: "rolls", keyName: "key" });
  const values = form.watch("rolls");
  const repetitions = Math.max(1, Number(form.watch("marker.repetitionsPerLayer")) || 1);
  const palaLabel = repetitions > 1 ? "Layers" : "Pala";
  const unitLabel = unitShort(unit);
  const measure = unit === "METER" ? "length" : "weight";
  const short = storeKg !== null && toIssueKg > storeKg;
  const colours = [...new Set(values.map((roll) => roll.colour.trim()).filter(Boolean))];

  return (
    <div className="grid gap-4">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-lg border px-4 py-3 text-[13px]",
          short ? "border-destructive/40 bg-destructive-soft text-destructive" : "bg-muted/40",
        )}
      >
        <p>
          {fabricName ?? "Fabric"} in store:{" "}
          <strong className="tabular-nums">{storeKg === null ? "—" : microKgText(storeKg, unit)}</strong>
        </p>
        <p>
          This batch issues <strong className="tabular-nums">{microKgText(toIssueKg, unit)}</strong>
          {short ? " — more than the store holds" : ""}
        </p>
      </div>
      <p className="text-[13px] text-muted-foreground">
        {palaLabel} and Returned fill in from the {measure}. Type over them when the Thaan cut differently: thicker or
        thinner fabric gives fewer or more {palaLabel}. Whatever is left and not returned is wastage.
      </p>
      {errorAt("rolls") ? <p className="text-[13px] text-destructive">{errorAt("rolls")}</p> : null}

      <div className="grid gap-2 rounded-lg border bg-card px-4 py-3 sm:px-5">
        <div className={cn("hidden gap-3 text-xs font-medium text-muted-foreground md:grid", ROW)}>
          <span>Colour</span>
          <span>Issued</span>
          <span>{palaLabel}</span>
          <span>Returned</span>
          <span className="text-right">Cut / wastage</span>
          <span />
        </div>

        {rows.fields.map((row, index) => {
          const roll = values[index];
          const result = results[index];
          const path = `rolls.${index}`;
          const id = `roll-${index}`;
          const issued = roll !== undefined && roll.status !== "DRAFT";
          const weighed = Boolean(roll?.issuedKg.trim()) && result !== undefined;
          const colour = roll?.colour.trim();
          // "Black, Thaan 2": two Thaan of one colour must not share a screen-reader name.
          const thaanOfColour = values.slice(0, index + 1).filter((other) => other?.colour.trim() === colour).length;
          const name = colour ? `${colour}, Thaan ${thaanOfColour}` : `Row ${index + 1}`;
          const wholeRollWasted = weighed && result.netKg > 0n && result.estimatedPala === 0;
          const rowWarnings = warnings.filter((item) => item.path.startsWith(`${path}.`));
          const typed = Boolean(roll?.confirmedLayers.trim());
          const palaWarning = rowWarnings.find((item) => item.path === `${path}.confirmedLayers`);
          const otherWarnings = rowWarnings.filter((item) => item !== palaWarning);

          return (
            <div
              key={row.key}
              className={cn(
                "grid grid-cols-2 items-start gap-x-3 gap-y-2 rounded-lg border p-3 md:rounded-none md:border-0 md:border-b md:px-0 md:pt-0 md:pb-3",
                ROW,
              )}
            >
              <div className="col-span-2 md:col-span-1">
                <Label htmlFor={`${id}-colour`} className="mb-1 text-xs text-muted-foreground md:sr-only">
                  Colour
                </Label>
                <div className="relative">
                  {issued ? (
                    <>
                      <Input
                        {...fieldProps(`${id}-colour`, errorAt(`${path}.colour`))}
                        aria-label={`Colour, row ${index + 1}`}
                        value={roll.colour}
                        readOnly
                        title={`${LOCKED} (Thaan ${roll.thaan})`}
                        className="bg-muted pr-8"
                      />
                      <Lock
                        className="absolute top-2.5 right-2.5 size-4 text-muted-foreground"
                        aria-label="Issued from store"
                      />
                    </>
                  ) : (
                    <Controller
                      control={form.control}
                      name={`rolls.${index}.colour`}
                      render={({ field }) => (
                        <SuggestInput
                          {...fieldProps(`${id}-colour`, errorAt(`${path}.colour`))}
                          aria-label={`Colour, row ${index + 1}`}
                          suggestions={colours}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          placeholder="e.g. Black"
                        />
                      )}
                    />
                  )}
                </div>
                <CellError id={`${id}-colour-error`} message={errorAt(`${path}.colour`)} />
              </div>
              <div>
                <Label htmlFor={`${id}-issued`} className="mb-1 text-xs text-muted-foreground md:sr-only">
                  Issued ({unitLabel})
                </Label>
                <InputGroup className={cn(issued && "bg-muted")}>
                  <InputGroupInput
                    {...fieldProps(`${id}-issued`, errorAt(`${path}.issuedKg`))}
                    aria-label={`Issued ${unitLabel}, ${name}`}
                    inputMode="decimal"
                    placeholder="e.g. 20.5"
                    autoComplete="off"
                    readOnly={issued}
                    title={issued ? LOCKED : undefined}
                    className="text-right tabular-nums"
                    {...form.register(`rolls.${index}.issuedKg`)}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{unitLabel}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <CellError id={`${id}-issued-error`} message={errorAt(`${path}.issuedKg`)} />
              </div>
              <div>
                <Label htmlFor={`${id}-layers`} className="mb-1 text-xs text-muted-foreground md:sr-only">
                  {palaLabel}
                </Label>
                <Input
                  {...fieldProps(`${id}-layers`, errorAt(`${path}.confirmedLayers`))}
                  aria-label={`${palaLabel}, ${name}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder={weighed ? String(result.estimatedLayers) : "Auto"}
                  className="text-right tabular-nums"
                  {...form.register(`rolls.${index}.confirmedLayers`)}
                />
                {weighed ? (
                  typed ? (
                    <button
                      type="button"
                      className="mt-1 block w-full text-right text-xs font-medium text-link hover:underline"
                      title={`Go back to the number that fits by ${measure}`}
                      onClick={() => {
                        form.setValue(`rolls.${index}.confirmedLayers`, "", { shouldDirty: true });
                        form.setValue(`rolls.${index}.note`, "", { shouldDirty: true });
                      }}
                    >
                      Reset to {result.estimatedPala}
                    </button>
                  ) : (
                    <p className="mt-1 text-right text-xs text-muted-foreground">
                      Auto · fits <span aria-label="Estimated Pala">{result.estimatedPala}</span>
                      {repetitions > 1 ? ` = ${result.estimatedLayers} layers` : ""}
                    </p>
                  )
                ) : null}
                <CellError id={`${id}-layers-error`} message={errorAt(`${path}.confirmedLayers`)} />
              </div>
              <div>
                <Label htmlFor={`${id}-returned`} className="mb-1 text-xs text-muted-foreground md:sr-only">
                  Returned ({unitLabel})
                </Label>
                <InputGroup>
                  <InputGroupInput
                    {...fieldProps(`${id}-returned`, errorAt(`${path}.returnedKg`))}
                    aria-label={`Returned ${unitLabel}, ${name}`}
                    inputMode="decimal"
                    placeholder={weighed ? formatKg(result.returnedKg) : "Auto"}
                    autoComplete="off"
                    className="text-right tabular-nums"
                    {...form.register(`rolls.${index}.returnedKg`)}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{unitLabel}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                {weighed ? (
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    {roll?.returnedKg.trim() ? "Weighed" : "Auto"}
                  </p>
                ) : null}
                <CellError id={`${id}-returned-error`} message={errorAt(`${path}.returnedKg`)} />
              </div>
              <p className="text-[13px] md:pt-2 md:text-right" aria-live="polite">
                {weighed ? (
                  <>
                    <strong className="tabular-nums">{result.pieces}</strong> pcs ·{" "}
                    <span
                      aria-label="Wastage"
                      className={cn("tabular-nums", wholeRollWasted && "font-medium text-warning")}
                    >
                      {microKgText(result.wastageKg, unit)}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </p>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${name}`}
                  disabled={issued || rows.fields.length === 1}
                  title={issued ? "Issued fabric cannot be removed. Enter what came back under Returned." : undefined}
                  onClick={() => rows.remove(index)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              {palaWarning ? (
                // Typed Pala that differ from the weight are allowed; an optional reason explains why.
                <div className="col-span-full grid items-center gap-2 rounded-md bg-warning-soft px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
                  <p className="text-[13px] font-medium text-warning">{palaWarning.message}</p>
                  <Input
                    aria-label={`Reason, ${name}`}
                    placeholder="Reason (optional), e.g. thin fabric at the end"
                    autoComplete="off"
                    maxLength={200}
                    className="h-8 bg-card"
                    {...form.register(`rolls.${index}.note`)}
                  />
                </div>
              ) : null}
              {otherWarnings.map((warning) => (
                <p key={warning.path} className="col-span-full text-xs text-warning">
                  {warning.message}
                </p>
              ))}
            </div>
          );
        })}

        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            // The next Thaan is usually the same colour; it is easy to type over.
            onClick={() => rows.append(emptyRoll(values.at(-1)?.colour.trim() ?? ""))}
          >
            <Plus aria-hidden />
            Add Thaan
          </Button>
        </div>
      </div>
    </div>
  );
}
