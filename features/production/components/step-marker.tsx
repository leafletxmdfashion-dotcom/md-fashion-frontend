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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { useSizeTemplates } from "../hooks/use-production";
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

const SOURCES = [
  { value: "MEASURED", label: "Weighed", hint: "The cutting master weighs one Pala" },
  { value: "CALCULATED", label: "Calculated", hint: "Width × marker length × GSM ÷ 1000" },
] as const;

function PalaWeight({ form, calc, errorAt }: StepProps) {
  const source = form.watch("marker.weightSource");
  const reps = form.watch("marker.repetitionsPerLayer");
  const [more, setMore] = useState(reps.trim() !== "" && reps.trim() !== "1");
  const { marker } = calc;

  return (
    <Panel
      title="Pala weight"
      description="One Pala is one full marker on one layer. Each Thaan is cut into whole Pala of this weight."
    >
      <div className="grid gap-5">
        <Controller
          control={form.control}
          name="marker.weightSource"
          render={({ field }) => (
            <div role="radiogroup" aria-label="How the Pala weight is found" className="grid gap-2 sm:grid-cols-2">
              {SOURCES.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    field.value === option.value ? "border-primary bg-primary-soft/40" : "hover:bg-accent/40",
                  )}
                >
                  <input
                    type="radio"
                    name={field.name}
                    className="mt-0.5 size-4 accent-primary"
                    checked={field.value === option.value}
                    onChange={() => field.onChange(option.value)}
                  />
                  <span>
                    <span className="block text-[13px] font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        />

        {/* Panaha and layer length are always recorded; the third field depends on how the Pala is weighed. */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="marker-width" label="Panaha (usable width)" error={errorAt("marker.widthM")}>
            <UnitInput id="marker-width" unit="m" placeholder="1.50" error={errorAt("marker.widthM")} {...form.register("marker.widthM")} />
          </Field>
          <Field id="marker-length" label="Marker / layer length" error={errorAt("marker.lengthM")}>
            <UnitInput id="marker-length" unit="m" placeholder="7.10" error={errorAt("marker.lengthM")} {...form.register("marker.lengthM")} />
          </Field>
          {source === "MEASURED" ? (
            <Field id="marker-measured" label="Weight of one Pala" error={errorAt("marker.measuredPalaKg")}>
              <UnitInput
                id="marker-measured"
                unit="kg"
                placeholder="2.130"
                error={errorAt("marker.measuredPalaKg")}
                aria-label="Measured Pala weight"
                {...form.register("marker.measuredPalaKg")}
              />
            </Field>
          ) : (
            <Field id="marker-gsm" label="GSM" error={errorAt("marker.gsm")}>
              <UnitInput id="marker-gsm" unit="g/m²" placeholder="200" error={errorAt("marker.gsm")} {...form.register("marker.gsm")} />
            </Field>
          )}
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
                {source === "MEASURED" ? "Enter the weight of one Pala." : "Enter width, marker length and GSM."}
              </span>
            ) : (
              <>
                Cutting uses <strong className="text-base tabular-nums">{microKgText(marker.activePalaKg)}</strong> per Pala
                <span className="text-muted-foreground"> · {source === "MEASURED" ? "weighed" : "calculated"}</span>
              </>
            )}
          </p>
          {source === "CALCULATED" && marker.differenceKg !== null && marker.differenceKg !== 0n ? (
            <p className="text-xs text-muted-foreground">
              Calculated {microKgText(marker.calculatedPalaKg!)} · weighed is{" "}
              {microKgText(marker.differenceKg < 0n ? -marker.differenceKg : marker.differenceKg)}{" "}
              {marker.differenceKg > 0n ? "heavier" : "lighter"}
            </p>
          ) : null}
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
          <button type="button" className="justify-self-start text-[13px] font-medium text-link hover:underline" onClick={() => setMore(true)}>
            The marker repeats more than once per layer
          </button>
        )}
      </div>
    </Panel>
  );
}

function SizeRatio({ form, calc, errorAt, canSaveDefault }: StepProps & { canSaveDefault: boolean }) {
  const sizes = useFieldArray({ control: form.control, name: "sizes", keyName: "key" });
  const templates = useSizeTemplates();
  const values = form.watch("sizes");
  const suggestions = [...new Set((templates.data ?? []).flatMap((template) => template.sizes))];
  const { marker } = calc;

  const applyTemplate = (id: string | null) => {
    const template = templates.data?.find((item) => item.id === id);

    if (template) sizes.replace(template.sizes.map((label) => ({ label, piecesPerPala: "1", pieceWeightG: "" })));
  };

  return (
    <Panel
      title="Size ratio"
      description="How many pieces of each size one Pala gives. Piece weights are optional."
      action={
        (templates.data?.length ?? 0) > 0 ? (
          <Select items={templates.data!.map((t) => ({ value: t.id, label: t.name }))} value={null} onValueChange={applyTemplate}>
            <SelectTrigger size="sm" aria-label="Use a size template">
              <SelectValue placeholder="Use a size template" />
            </SelectTrigger>
            <SelectContent>
              {templates.data!.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name} · {template.sizes.join(", ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null
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
                      placeholder="M"
                      suggestions={suggestions}
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
                  min={1}
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
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => sizes.move(index, index - 1)}>
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
        <Button type="button" variant="outline" size="sm" onClick={() => sizes.append({ label: "", piecesPerPala: "1", pieceWeightG: "" })}>
          <Plus aria-hidden />
          Add size
        </Button>
        <p className="text-[13px]" aria-live="polite">
          <strong className="tabular-nums">{marker.piecesPerPala}</strong> pieces per Pala
          {marker.netPalaKg !== null ? (
            <span className="text-muted-foreground">
              {" "}
              · {microKgText(marker.netPalaKg)} of garment
              {marker.scrapPerPalaKg !== null ? `, about ${microKgText(marker.scrapPerPalaKg)} marker scrap (for information)` : ""}
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
              <Checkbox id="save-default" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
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
