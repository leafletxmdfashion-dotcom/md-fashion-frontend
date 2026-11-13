"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray } from "react-hook-form";

import { Field, fieldProps } from "@/components/form/field";
import { SuggestInput } from "@/components/form/suggest-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";

import { parseScaled } from "../lib/cutting-calc";
import { metresToInches, microKgText } from "../lib/format";
import { lengthInMetres, type LengthUnit } from "../lib/form-model";
import { CellError, Computed, Panel } from "./form-parts";
import type { StepProps } from "./step-details";

function UnitInput({
  id,
  unit,
  error,
  ...props
}: React.ComponentProps<typeof InputGroupInput> & {
  id: string;
  unit: string;
  error?: string | undefined;
}) {
  return (
    <InputGroup>
      <InputGroupInput {...fieldProps(id, error)} type="text" inputMode="decimal" autoComplete="off" {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupText>{unit}</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
}

/** Metres rounded to the millimetre, trailing zeros dropped: "1.500124" → "1.5". */
function toMillimetre(metres: string): string {
  const value = Number(metres);

  return Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : metres;
}

const LENGTH_UNITS = [
  { value: "M", label: "m" },
  { value: "IN", label: "in" },
] as const;

function LengthUnitSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: LengthUnit;
  onChange: (unit: LengthUnit) => void;
}) {
  return (
    <InputGroupAddon align="inline-end" className="pr-1">
      <SegmentedControl
        size="inline"
        aria-label={`${label} unit`}
        value={value}
        onValueChange={onChange}
        options={LENGTH_UNITS}
      />
    </InputGroupAddon>
  );
}

/** Panaha or layer length, typed in metres or inches; switching converts what was typed. */
function LengthInput({
  form,
  name,
  unitName,
  id,
  label,
  placeholder,
  error,
}: {
  form: StepProps["form"];
  name: "marker.widthM" | "marker.lengthM";
  unitName: "marker.widthUnit" | "marker.lengthUnit";
  id: string;
  label: string;
  placeholder: { M: string; IN: string };
  error: string | undefined;
}) {
  const unit = form.watch(unitName);

  const switchTo = (next: LengthUnit) => {
    if (next === unit) return;

    const metres = lengthInMetres(form.getValues(name), unit);
    const converted =
      metres === null ? "" : next === "IN" ? metresToInches(metres) : unit === "IN" ? toMillimetre(metres) : metres;

    form.setValue(unitName, next, { shouldDirty: true });

    if (converted !== null) form.setValue(name, converted, { shouldDirty: true });
  };

  return (
    <InputGroup>
      <InputGroupInput
        {...fieldProps(id, error)}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder[unit]}
        aria-label={`${label} in ${unit === "IN" ? "inches" : "metres"}`}
        {...form.register(name)}
      />
      <LengthUnitSwitch label={label} value={unit} onChange={switchTo} />
    </InputGroup>
  );
}

type PalaUnit = "KG" | "M";

const PALA_UNITS = [
  { value: "KG", label: "kg" },
  { value: "M", label: "m" },
] as const;

const PALA_LABEL: Record<PalaUnit, string> = {
  KG: "Weight of one Pala",
  M: "Length of one Pala",
};

function PalaWeight({ form, calc, errorAt, unit }: StepProps) {
  const { marker } = calc;
  const byLength = unit === "METER";
  // Cutting counts Pala in the unit the fabric is bought in; the other unit is only recorded.
  const main: PalaUnit = byLength ? "M" : "KG";
  const other: PalaUnit = byLength ? "KG" : "M";
  const [palaUnit, setPalaUnit] = useState<PalaUnit>(() =>
    form.getValues("marker.palaAltValue").trim() ? other : main,
  );
  const switched = palaUnit !== main;
  const shownName = switched ? "marker.palaAltValue" : "marker.measuredPalaKg";
  const shownError = errorAt(shownName);

  const switchTo = (next: PalaUnit) => {
    // Back to the fabric's unit: drop the extra measure so nothing hidden is saved.
    if (next === main) form.setValue("marker.palaAltValue", "", { shouldDirty: true });

    setPalaUnit(next);
  };

  return (
    <Panel
      title={byLength ? "Pala length" : "Pala weight"}
      description={
        byLength
          ? "One Pala is one full marker on one layer. This fabric is bought by the metre, so each Thaan is cut into whole Pala of this length."
          : "One Pala is one full marker on one layer. Each Thaan is cut into whole Pala of this weight."
      }
    >
      <div className="grid gap-5">
        {/* Panaha and layer length are recorded (metres or inches); the Pala is what the cutting master measures. */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="marker-width" label="Panaha (usable width)" error={errorAt("marker.widthM")}>
            <LengthInput
              form={form}
              name="marker.widthM"
              unitName="marker.widthUnit"
              id="marker-width"
              label="Panaha"
              placeholder={{ M: "e.g. 1.50", IN: "e.g. 58" }}
              error={errorAt("marker.widthM")}
            />
          </Field>
          <Field id="marker-length" label="Marker / layer length" error={errorAt("marker.lengthM")}>
            <LengthInput
              form={form}
              name="marker.lengthM"
              unitName="marker.lengthUnit"
              id="marker-length"
              label="Layer length"
              placeholder={{ M: "e.g. 7.10", IN: "e.g. 280" }}
              error={errorAt("marker.lengthM")}
            />
          </Field>
          <Field
            id="marker-measured"
            label={PALA_LABEL[palaUnit]}
            error={shownError}
            description={
              switched
                ? "Recorded with the cutting"
                : byLength
                  ? "In metres, as the fabric is bought"
                  : "Weighed by the cutting master"
            }
          >
            <InputGroup>
              <InputGroupInput
                key={palaUnit}
                {...fieldProps("marker-measured", shownError)}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={palaUnit === "M" ? "e.g. 7.20" : "e.g. 2.130"}
                aria-label={palaUnit === "M" ? "Pala length in metres" : "Measured Pala weight"}
                {...form.register(shownName)}
              />
              <InputGroupAddon align="inline-end" className="pr-1">
                <SegmentedControl
                  size="inline"
                  aria-label="Pala unit"
                  value={palaUnit}
                  onValueChange={switchTo}
                  options={PALA_UNITS}
                />
              </InputGroupAddon>
            </InputGroup>
          </Field>
          {switched ? (
            <Field
              id="marker-measured-main"
              label={`${PALA_LABEL[main]} (used for cutting)`}
              error={errorAt("marker.measuredPalaKg")}
              description={
                byLength
                  ? "This fabric is bought by the metre, so cutting counts Pala by length."
                  : "This fabric is bought by kg, so cutting counts Pala by weight."
              }
              className="sm:col-start-3"
            >
              <UnitInput
                id="marker-measured-main"
                unit={byLength ? "m" : "kg"}
                placeholder={byLength ? "e.g. 7.20" : "e.g. 2.130"}
                error={errorAt("marker.measuredPalaKg")}
                aria-label={
                  byLength ? "Pala length in metres, used for cutting" : "Pala weight in kg, used for cutting"
                }
                {...form.register("marker.measuredPalaKg")}
              />
            </Field>
          ) : null}
        </div>

        <div
          className={cn(
            "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-lg border px-4 py-3",
            marker.activePalaKg === null ? "border-dashed" : "bg-muted/40",
          )}
          aria-live="polite"
        >
          <p className="text-[13px]">
            {marker.activePalaKg === null ? (
              <span className="text-muted-foreground">
                {byLength ? "Enter the length of one Pala." : "Enter the weight of one Pala."}
              </span>
            ) : (
              <>
                Cutting uses{" "}
                <strong className="text-base tabular-nums">{microKgText(marker.activePalaKg, unit)}</strong> per Pala
                <span className="text-muted-foreground"> · {byLength ? "measured" : "weighed"}</span>
              </>
            )}
          </p>
        </div>
      </div>
    </Panel>
  );
}

const SIZE_SETS = [
  { label: "S – XL", sizes: ["S", "M", "L", "XL"] },
  { label: "S – XXL", sizes: ["S", "M", "L", "XL", "XXL"] },
  { label: "28 – 36", sizes: ["28", "30", "32", "34", "36"] },
] as const;

const SIZE_SUGGESTIONS = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "4XL",
  "Free",
  "26",
  "28",
  "30",
  "32",
  "34",
  "36",
  "38",
  "40",
];

function SizeRatio({ form, calc, errorAt, canSaveDefault }: StepProps & { canSaveDefault: boolean }) {
  const sizes = useFieldArray({
    control: form.control,
    name: "sizes",
    keyName: "key",
  });
  const values = form.watch("sizes");
  const { marker } = calc;

  // One-click size sets the factory uses; any label can still be typed.
  const applySet = (labels: readonly string[]) =>
    sizes.replace(labels.map((label) => ({ label, piecesPerPala: "1", pieceWeightG: "" })));

  return (
    <Panel
      title="Size ratio"
      description="How many pieces of each size one Pala gives. Piece weights are optional."
      action={
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick size sets">
          {SIZE_SETS.map((set) => (
            <Button key={set.label} type="button" variant="outline" size="sm" onClick={() => applySet(set.sizes)}>
              {set.label}
            </Button>
          ))}
        </div>
      }
    >
      {errorAt("sizes") ? <p className="mb-3 text-[13px] text-destructive">{errorAt("sizes")}</p> : null}

      <div className="grid gap-2">
        <div className="hidden grid-cols-[minmax(0,1fr)_9rem_10rem_8rem_6.5rem] gap-3 text-xs font-medium text-muted-foreground md:grid">
          <span>Size</span>
          <span>Pieces per Pala</span>
          <span>Weight per piece</span>
          <span className="text-right">Per Pala</span>
          <span />
        </div>
        {sizes.fields.map((row, index) => {
          const value = values[index];
          const grams = value?.pieceWeightG ? parseScaled(value.pieceWeightG, 3) : null;
          const pieces = Number(value?.piecesPerPala);
          const net = grams !== null && Number.isInteger(pieces) ? grams * BigInt(pieces) : null;
          const name = value?.label || `size ${index + 1}`;

          return (
            <div
              key={row.key}
              className="grid grid-cols-2 items-start gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_9rem_10rem_8rem_6.5rem] md:rounded-none md:border-0 md:p-0"
            >
              <div className="col-span-2 md:col-span-1">
                <Label htmlFor={`size-${index}-label`} className="mb-1 text-xs text-muted-foreground md:sr-only">
                  Size
                </Label>
                <Controller
                  control={form.control}
                  name={`sizes.${index}.label`}
                  render={({ field }) => (
                    <SuggestInput
                      {...fieldProps(`size-${index}-label`, errorAt(`sizes.${index}.label`))}
                      aria-label={`Size ${index + 1}`}
                      placeholder="e.g. M"
                      suggestions={SIZE_SUGGESTIONS}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  )}
                />
                <CellError id={`size-${index}-label-error`} message={errorAt(`sizes.${index}.label`)} />
              </div>
              <div>
                <Label htmlFor={`size-${index}-pieces`} className="mb-1 text-xs text-muted-foreground md:sr-only">
                  Pieces per Pala
                </Label>
                <Input
                  {...fieldProps(`size-${index}-pieces`, errorAt(`sizes.${index}.piecesPerPala`))}
                  aria-label={`Pieces per Pala, size ${value?.label || index + 1}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  className="text-right tabular-nums"
                  {...form.register(`sizes.${index}.piecesPerPala`)}
                />
                <CellError id={`size-${index}-pieces-error`} message={errorAt(`sizes.${index}.piecesPerPala`)} />
              </div>
              <div>
                <Label htmlFor={`size-${index}-weight`} className="mb-1 text-xs text-muted-foreground md:sr-only">
                  Weight per piece
                </Label>
                <UnitInput
                  id={`size-${index}-weight`}
                  unit="g"
                  placeholder="Optional"
                  aria-label={`Weight per piece, size ${value?.label || index + 1}`}
                  error={errorAt(`sizes.${index}.pieceWeightG`)}
                  className="text-right"
                  {...form.register(`sizes.${index}.pieceWeightG`)}
                />
                <CellError id={`size-${index}-weight-error`} message={errorAt(`sizes.${index}.pieceWeightG`)} />
              </div>
              <Computed className="hidden justify-end md:flex">
                {net === null ? "—" : `${(Number(net) / 1000).toLocaleString("en-IN")} g`}
              </Computed>
              <div className="col-span-2 flex justify-end md:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${name} up`}
                  disabled={index === 0}
                  onClick={() => sizes.move(index, index - 1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${name} down`}
                  disabled={index === sizes.fields.length - 1}
                  onClick={() => sizes.move(index, index + 1)}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${value?.label || "size"}`}
                  disabled={sizes.fields.length === 1}
                  onClick={() => sizes.remove(index)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => sizes.append({ label: "", piecesPerPala: "1", pieceWeightG: "" })}
        >
          <Plus aria-hidden />
          Add size
        </Button>
        <p className="text-[13px]" aria-live="polite">
          <strong className="tabular-nums">{marker.piecesPerPala}</strong> pieces per Pala
          {marker.netPalaKg !== null ? (
            <span className="text-muted-foreground">
              {" "}
              · {microKgText(marker.netPalaKg)} of garment
              {marker.scrapPerPalaKg !== null
                ? `, about ${microKgText(marker.scrapPerPalaKg)} marker scrap (for information)`
                : ""}
            </span>
          ) : null}
        </p>
      </div>

      {canSaveDefault ? (
        <Controller
          control={form.control}
          name="saveAsDefault"
          render={({ field }) => (
            <div className="mt-4 flex items-center gap-2">
              <Checkbox
                id="save-default"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
              <Label htmlFor="save-default" className="text-[13px] font-normal">
                Remember this Pala weight and size ratio for this item
              </Label>
            </div>
          )}
        />
      ) : null}
    </Panel>
  );
}

/** Step 2: Pala weight and the size ratio of the marker. */
export function StepMarker(props: StepProps & { canSaveDefault: boolean }) {
  return (
    <div className="grid gap-5">
      <PalaWeight {...props} />
      <SizeRatio {...props} />
    </div>
  );
}
