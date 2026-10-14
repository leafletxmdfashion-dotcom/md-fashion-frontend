"use client";

import { Lock, Plus, Trash2 } from "lucide-react";
import { useFieldArray } from "react-hook-form";

import { fieldProps } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { microKgText } from "../lib/format";
import { emptyColour, emptyRoll } from "../lib/form-model";
import { CellError } from "./form-parts";
import type { StepProps } from "./step-details";

const ROW = "md:grid-cols-[minmax(0,1fr)_8rem_8rem_7rem_2.25rem]";

function ColourCard({
  form,
  calc,
  errorAt,
  index,
  canRemove,
  onRemove,
}: StepProps & { index: number; canRemove: boolean; onRemove: () => void }) {
  const rolls = useFieldArray({ control: form.control, name: `colours.${index}.rolls`, keyName: "key" });
  const colour = form.watch(`colours.${index}`);
  const result = calc.colours[index];
  const repetitions = Math.max(1, Number(form.watch("marker.repetitionsPerLayer")) || 1);
  const hasIssued = colour.rolls.some((roll) => roll.status !== "DRAFT");
  const path = `colours.${index}`;
  const palaLabel = repetitions > 1 ? "Layers" : "Pala cut";
  const colourName = colour.name.trim() || `Colour ${index + 1}`;

  return (
    <section className="rounded-lg border bg-card" aria-label={colourName}>
      <header className="grid gap-2 border-b px-4 py-3 sm:px-5">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1 sm:max-w-64">
            <Label htmlFor={`colour-${index}-name`} className="mb-1 text-xs text-muted-foreground">
              Colour
            </Label>
            <Input
              {...fieldProps(`colour-${index}-name`, errorAt(`${path}.name`))}
              placeholder="Black"
              autoComplete="off"
              readOnly={hasIssued}
              className={cn(hasIssued && "bg-muted")}
              title={hasIssued ? "Fabric has been issued for this colour, so its name is fixed." : undefined}
              {...form.register(`colours.${index}.name`)}
            />
            <CellError id={`colour-${index}-name-error`} message={errorAt(`${path}.name`)} />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            disabled={!canRemove || hasIssued}
            title={hasIssued ? "Issued fabric cannot be removed. Record it as returned instead." : undefined}
            onClick={onRemove}
          >
            <Trash2 aria-hidden />
            <span className="hidden sm:inline">Remove colour</span>
          </Button>
        </div>
        {result ? (
          <p className="text-[13px] text-muted-foreground" aria-live="polite">
            <strong className="text-foreground tabular-nums">{result.totals.acceptedPieces}</strong> pieces ·{" "}
            {result.totals.confirmedPala} Pala · {microKgText(result.totals.issuedKg)} issued ·{" "}
            {microKgText(result.totals.wastageKg)} wastage
          </p>
        ) : null}
      </header>

      <div className="grid gap-2 px-4 py-3 sm:px-5">
        {errorAt(`${path}.rolls`) ? <p className="text-[13px] text-destructive">{errorAt(`${path}.rolls`)}</p> : null}
        <div className={cn("hidden gap-3 text-xs font-medium text-muted-foreground md:grid", ROW)}>
          <span>Thaan number</span>
          <span>Issued</span>
          <span>Returned</span>
          <span>{palaLabel}</span>
          <span />
        </div>

        {rolls.fields.map((row, rollIndex) => {
          const roll = colour.rolls[rollIndex];
          const calcRoll = result?.rolls[rollIndex];
          const rollPath = `${path}.rolls.${rollIndex}`;
          const issued = roll !== undefined && roll.status !== "DRAFT";
          const id = `colour-${index}-roll-${rollIndex}`;
          const thaan = roll?.thaan || String(rollIndex + 1);
          const filled = Boolean(roll?.issuedKg.trim());
          const wholeRollWasted = calcRoll !== undefined && calcRoll.netKg > 0n && calcRoll.estimatedPala === 0;
          const warning = calc.warnings.find((item) => item.path === `${rollPath}.issuedKg`);

          return (
            <div
              key={row.key}
              className={cn(
                "grid grid-cols-2 items-start gap-x-3 gap-y-2 rounded-lg border p-3 md:rounded-none md:border-0 md:border-b md:px-0 md:pt-0 md:pb-3",
                ROW,
              )}
            >
              <div className="col-span-2 md:col-span-1">
                <Label htmlFor={`${id}-thaan`} className="mb-1 text-xs text-muted-foreground md:sr-only">
                  Thaan number
                </Label>
                <div className="relative">
                  <Input
                    {...fieldProps(`${id}-thaan`, errorAt(`${rollPath}.thaan`))}
                    aria-label={`Thaan number, row ${rollIndex + 1}`}
                    placeholder="TH-001"
                    autoComplete="off"
                    readOnly={issued}
                    className={cn(issued && "bg-muted pr-8")}
                    {...form.register(`colours.${index}.rolls.${rollIndex}.thaan`)}
                  />
                  {issued ? (
                    <Lock
                      className="absolute top-2.5 right-2.5 size-4 text-muted-foreground"
                      aria-label="Issued from store"
                    />
                  ) : null}
                </div>
                <CellError id={`${id}-thaan-error`} message={errorAt(`${rollPath}.thaan`)} />
              </div>
              <div>
                <Label htmlFor={`${id}-issued`} className="mb-1 text-xs text-muted-foreground md:sr-only">
                  Issued (kg)
                </Label>
                <InputGroup className={cn(issued && "bg-muted")}>
                  <InputGroupInput
                    {...fieldProps(`${id}-issued`, errorAt(`${rollPath}.issuedKg`))}
                    aria-label={`Issued kg, Thaan ${thaan}`}
                    inputMode="decimal"
                    placeholder="0.000"
                    autoComplete="off"
                    readOnly={issued}
                    className="text-right tabular-nums"
                    {...form.register(`colours.${index}.rolls.${rollIndex}.issuedKg`)}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>kg</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <CellError id={`${id}-issued-error`} message={errorAt(`${rollPath}.issuedKg`)} />
              </div>
              <div>
                <Label htmlFor={`${id}-returned`} className="mb-1 text-xs text-muted-foreground md:sr-only">
                  Returned (kg)
                </Label>
                <InputGroup>
                  <InputGroupInput
                    {...fieldProps(`${id}-returned`, errorAt(`${rollPath}.returnedKg`))}
                    aria-label={`Returned kg, Thaan ${thaan}`}
                    inputMode="decimal"
                    placeholder="0"
                    autoComplete="off"
                    className="text-right tabular-nums"
                    {...form.register(`colours.${index}.rolls.${rollIndex}.returnedKg`)}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>kg</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <CellError id={`${id}-returned-error`} message={errorAt(`${rollPath}.returnedKg`)} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <Label htmlFor={`${id}-layers`} className="mb-1 text-xs text-muted-foreground md:sr-only">
                  {palaLabel}
                </Label>
                <Input
                  {...fieldProps(`${id}-layers`, errorAt(`${rollPath}.confirmedLayers`))}
                  aria-label={`${repetitions > 1 ? "Layers" : "Confirmed Pala"}, Thaan ${thaan}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder={calcRoll && filled ? String(calcRoll.estimatedLayers) : "—"}
                  className="text-right tabular-nums"
                  {...form.register(`colours.${index}.rolls.${rollIndex}.confirmedLayers`)}
                />
                {calcRoll && filled ? (
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    Fits <span aria-label="Estimated Pala">{calcRoll.estimatedPala}</span>
                    {repetitions > 1 ? ` · = ${calcRoll.confirmedPala} Pala` : ""}
                  </p>
                ) : null}
                <CellError id={`${id}-layers-error`} message={errorAt(`${rollPath}.confirmedLayers`)} />
              </div>
              <div className="col-span-2 flex justify-end md:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove Thaan ${thaan}`}
                  disabled={issued || rolls.fields.length === 1}
                  title={issued ? "Issued fabric cannot be removed. Record it as returned instead." : undefined}
                  onClick={() => rolls.remove(rollIndex)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <p className="col-span-full rounded-md bg-muted px-3 py-1.5 text-[13px]" aria-live="polite">
                {calcRoll && filled ? (
                  <>
                    <strong className="tabular-nums">{calcRoll.pieces}</strong> pieces ·{" "}
                    <span className="tabular-nums">{calcRoll.confirmedPala}</span> Pala ·{" "}
                    <span aria-label="Consumed">{microKgText(calcRoll.consumedKg)}</span> used ·{" "}
                    <span aria-label="Wastage" className={cn(wholeRollWasted && "font-medium text-warning")}>
                      {microKgText(calcRoll.wastageKg)}
                    </span>{" "}
                    waste
                  </>
                ) : (
                  <span className="text-muted-foreground">Enter the issued weight to see Pala and pieces</span>
                )}
              </p>
              {warning ? <p className="col-span-full text-xs text-warning">{warning.message}</p> : null}
            </div>
          );
        })}

        <div>
          <Button type="button" variant="ghost" size="sm" onClick={() => rolls.append(emptyRoll())}>
            <Plus aria-hidden />
            Add Thaan
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Step 3: colours, and the Thaan of each with the weight issued. */
export function StepThaan({
  storeKg,
  toIssueKg,
  fabricName,
  ...props
}: StepProps & { storeKg: bigint | null; toIssueKg: bigint; fabricName: string | null }) {
  const colours = useFieldArray({ control: props.form.control, name: "colours", keyName: "key" });
  const short = storeKg !== null && toIssueKg > storeKg;

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
          <strong className="tabular-nums">{storeKg === null ? "—" : microKgText(storeKg)}</strong>
        </p>
        <p>
          This batch issues <strong className="tabular-nums">{microKgText(toIssueKg)}</strong>
          {short ? " — more than the store holds" : ""}
        </p>
      </div>
      <p className="text-[13px] text-muted-foreground">
        Each Thaan is cut on its own into whole Pala; what is left and not returned becomes wastage. Leave “Pala cut”
        empty to accept the number that fits.
      </p>
      {props.errorAt("colours") ? <p className="text-[13px] text-destructive">{props.errorAt("colours")}</p> : null}
      {colours.fields.map((row, index) => (
        <ColourCard
          key={row.key}
          {...props}
          index={index}
          canRemove={colours.fields.length > 1}
          onRemove={() => colours.remove(index)}
        />
      ))}
      <div>
        <Button type="button" variant="outline" onClick={() => colours.append(emptyColour())}>
          <Plus aria-hidden />
          Add colour
        </Button>
      </div>
    </div>
  );
}
