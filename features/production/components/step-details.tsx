"use client";

import Link from "next/link";
import { Controller, type UseFormReturn } from "react-hook-form";

import { Field, fieldProps } from "@/components/form/field";
import { SuggestInput } from "@/components/form/suggest-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FabricCombobox } from "@/features/fabric/components/fabric-combobox";
import { todayISO } from "@/features/fabric/lib/format";
import type { FabricOption } from "@/features/fabric/types/fabric.types";

import { useKarigarOptions } from "../hooks/use-production";
import type { BatchResult } from "../lib/cutting-calc";
import { CATEGORY_LABEL, karigarCode, microKgText, PAY_MODE_LABEL } from "../lib/format";
import type { CuttingFormValues } from "../lib/form-model";
import type { Article, LotListItem } from "../types/production.types";

export interface StepProps {
  form: UseFormReturn<CuttingFormValues>;
  calc: BatchResult;
  errorAt: (path: string) => string | undefined;
}

function MasterSelect({ value, onChange, invalid }: { value: string; onChange: (id: string) => void; invalid: boolean }) {
  // Any active karigar can cut; cutting masters are listed first.
  const masters = useKarigarOptions();

  const sorted = [...(masters.data ?? [])].sort(
    (a, b) => Number(b.category === "CUTTING_MASTER") - Number(a.category === "CUTTING_MASTER") || a.name.localeCompare(b.name),
  );

  const items = sorted.map((master) => ({ value: master.id, label: master.name }));

  return (
    <>
      <Select items={items} value={value || null} onValueChange={(next) => onChange(next ?? "")}>
        <SelectTrigger id="cutting-master" className="w-full" aria-invalid={invalid || undefined}>
          <SelectValue placeholder={masters.isLoading ? "Loading…" : "Choose who cuts"} />
        </SelectTrigger>
        <SelectContent>
          {sorted.map((master) => (
            <SelectItem key={master.id} value={master.id}>
              {master.name}
              <span className="ml-1.5 text-xs text-muted-foreground">
                {karigarCode(master.number)} · {CATEGORY_LABEL[master.category]} · {PAY_MODE_LABEL[master.payMode]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {masters.data?.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No karigars yet.{" "}
          <Link href="/karigar" className="text-link hover:underline">
            Add one in Karigar Master
          </Link>
          .
        </p>
      ) : null}
    </>
  );
}

/** Section 1: lot number, item, fabric, and who cuts when. */
export function StepDetails({
  form,
  errorAt,
  locked,
  openLots,
  matchedLot,
  articles,
  matchedArticle,
  fabrics,
  storeKg,
}: StepProps & {
  /** True once the cutting is saved: its lot, item and fabric are fixed. */
  locked: boolean;
  openLots: LotListItem[];
  matchedLot: LotListItem | undefined;
  articles: Article[];
  matchedArticle: Article | undefined;
  fabrics: FabricOption[];
  storeKg: bigint | null;
}) {
  const lotNumber = form.watch("lotNumber");
  const articleName = form.watch("articleName");
  const fixed = locked || matchedLot !== undefined;

  const lotHint = locked
    ? "Fixed once the cutting is saved"
    : matchedLot
      ? `Existing lot · ${matchedLot.article.name} · ${matchedLot.cutPieces.toLocaleString("en-IN")} pieces cut so far. This cutting is added to it.`
      : lotNumber.trim()
        ? "New lot · created when you save"
        : "Type the lot number, or pick an open lot to add more cutting to it";

  // A saved cutting's item already exists, even when its lot is not in the open-lot list.
  const itemHint = locked || matchedLot
    ? "From the lot"
    : matchedArticle
      ? `Existing item · ${matchedArticle.code}${matchedArticle.defaultMarker ? " · saved measurements filled in" : ""}`
      : articleName.trim()
        ? "New item · created when you save"
        : undefined;

  return (
    <div className="rounded-lg border bg-card p-4 sm:p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="lot-number" label="Lot number" error={errorAt("lotNumber")} description={lotHint}>
          <Controller
            control={form.control}
            name="lotNumber"
            render={({ field }) => (
              <SuggestInput
                {...fieldProps("lot-number", errorAt("lotNumber"))}
                suggestions={openLots.map((lot) => lot.lotNumber)}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                placeholder="e.g. LOT-45"
                readOnly={locked}
                className={locked ? "bg-muted" : undefined}
                autoFocus={!locked}
              />
            )}
          />
        </Field>
        <Field
          id="article-name"
          label="Item / design"
          error={errorAt("articleName") ?? errorAt("article.name") ?? errorAt("article")}
          description={itemHint}
        >
          <Controller
            control={form.control}
            name="articleName"
            render={({ field }) => (
              <SuggestInput
                {...fieldProps("article-name", errorAt("articleName"))}
                suggestions={articles.map((article) => article.name)}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                placeholder="e.g. Polo T-Shirt"
                readOnly={fixed}
                className={fixed ? "bg-muted" : undefined}
              />
            )}
          />
        </Field>
        <Field
          id="lot-fabric"
          label="Fabric"
          error={errorAt("fabricId")}
          description={storeKg === null ? "Fabrics weighed in kg" : `${microKgText(storeKg)} in store`}
        >
          <Controller
            control={form.control}
            name="fabricId"
            render={({ field }) =>
              fixed ? (
                <Input
                  id="lot-fabric"
                  readOnly
                  className="bg-muted"
                  value={fabrics.find((fabric) => fabric.id === field.value)?.name ?? matchedLot?.fabric.name ?? ""}
                />
              ) : (
                <FabricCombobox
                  id="lot-fabric"
                  fabrics={fabrics}
                  value={field.value}
                  onChange={field.onChange}
                  invalid={Boolean(errorAt("fabricId"))}
                  placeholder="Search fabric"
                />
              )
            }
          />
        </Field>

        <Field id="cutting-date" label="Cutting date" error={errorAt("cuttingDate")}>
          <Input {...fieldProps("cutting-date", errorAt("cuttingDate"))} type="date" max={todayISO()} {...form.register("cuttingDate")} />
        </Field>
        <Field id="cutting-master" label="Cutting master" error={errorAt("cuttingMasterId")} description="Needed before fabric is issued">
          <Controller
            control={form.control}
            name="cuttingMasterId"
            render={({ field }) => (
              <MasterSelect value={field.value} onChange={field.onChange} invalid={Boolean(errorAt("cuttingMasterId"))} />
            )}
          />
        </Field>
        <Field id="cutting-notes" label="Notes" error={errorAt("notes")} description="Optional">
          <Input
            {...fieldProps("cutting-notes", errorAt("notes"))}
            autoComplete="off"
            placeholder="e.g. Rush order, cut by Friday"
            {...form.register("notes")}
          />
        </Field>
      </div>
    </div>
  );
}
