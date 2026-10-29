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
import { cn } from "@/lib/utils";

import { parseScaled } from "../lib/cutting-calc";
import { microKgText } from "../lib/format";
import { CellError, Computed, Panel } from "./form-parts";
import type { StepProps } from "./step-details";

function UnitInput({
  id,
  unit,
  error,
  ...props
}: React.ComponentProps<typeof InputGroupInput> & { id: string; unit: string; error?: string | undefined }) {
  return (
    <InputGroup>
      <InputGroupInput {...fieldProps(id, error)} type="text" inputMode="decimal" autoComplete="off" {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupText>{unit}</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
}

function PalaWeight({ form, calc, errorAt }: StepProps) {
  const reps = form.watch("marker.repetitionsPerLayer");
  const [more, setMore] = useState(reps.trim() !== "" && reps.trim() !== "1");
  const { marker } = calc;

  return (
    <Panel
      title="Pala weight"
      description="One Pala is one full marker on one layer. Each Thaan is cut into whole Pala of this weight."
    >
      <div className="grid gap-5">
        {/* Panaha and layer length are recorded; the Pala weight is what the cutting master weighs. */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="marker-width" label="Panaha (usable width)" error={errorAt("marker.widthM")}>
            <UnitInput
              id="marker-width"
              unit="m"
              placeholder="e.g. 1.50"
              error={errorAt("marker.widthM")}
              {...form.register("marker.widthM")}
            />
          </Field>
          <Field id="marker-length" label="Marker / layer length" error={errorAt("marker.lengthM")}>
            <UnitInput
              id="marker-length"
              unit="m"
              placeholder="e.g. 7.10"
              error={errorAt("marker.lengthM")}
              {...form.register("marker.lengthM")}
            />
          </Field>
          <Field
            id="marker-measured"
            label="Weight of one Pala"
            error={errorAt("marker.measuredPalaKg")}
            description="Weighed by the cutting master"
          >
            <UnitInput
              id="marker-measured"
              unit="kg"
              placeholder="e.g. 2.130"
              error={errorAt("marker.measuredPalaKg")}
              aria-label="Measured Pala weight"
              {...form.register("marker.measuredPalaKg")}
            />
          </Field>
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
              <span className="text-muted-foreground">Enter the weight of one Pala.</span>
            ) : (
              <>
                Cutting uses <strong className="text-base tabular-nums">{microKgText(marker.activePalaKg)}</strong> per
                Pala
                <span className="text-muted-foreground"> · weighed</span>
              </>
            )}
          </p>
        </div>

        {more ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              id="marker-reps"
              label="Marker repeats per layer"
              error={errorAt("marker.repetitionsPerLayer")}
              description="Pala = layers × repeats"
            >
              <Input
                {...fieldProps("marker-reps", errorAt("marker.repetitionsPerLayer"))}
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                step={1}
                {...form.register("marker.repetitionsPerLayer")}
              />
            </Field>
          </div>
        ) : (
          <button
            type="button"
            className="justify-self-start text-[13px] font-medium text-link hover:underline"
            onClick={() => setMore(true)}
          >
            The marker repeats more than once per layer
          </button>
        )}
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
  const sizes = useFieldArray({ control: form.control, name: "sizes", keyName: "key" });
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
