"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

import { formatQty } from "../lib/format";
import type { FabricOption } from "../types/fabric.types";

/** Type-to-search fabric picker; matches on name or code. Empty value = none selected. */
export function FabricCombobox({
  id,
  fabrics,
  value,
  onChange,
  placeholder = "Search fabric…",
  clearable = false,
  invalid,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  fabrics: FabricOption[];
  value: string;
  onChange: (fabricId: string) => void;
  placeholder?: string;
  clearable?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const selected = fabrics.find((fabric) => fabric.id === value) ?? null;

  return (
    <Combobox
      items={fabrics}
      value={selected}
      onValueChange={(fabric) => onChange(fabric?.id ?? "")}
      itemToStringLabel={(fabric) => `${fabric.name} · ${fabric.code}`}
      isItemEqualToValue={(a, b) => a.id === b.id}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        showClear={clearable && Boolean(selected)}
        className={cn("h-9", className)}
      />
      <ComboboxContent>
        <ComboboxEmpty>No fabric found.</ComboboxEmpty>
        <ComboboxList>
          {(fabric: FabricOption) => (
            <ComboboxItem key={fabric.id} value={fabric}>
              <span className="min-w-0 flex-1 truncate">
                {fabric.name}
                <span className="ml-1.5 text-xs text-muted-foreground">{fabric.code}</span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatQty(fabric.balance, fabric.unit)}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
