"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Check, ListFilter, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { filterKeys, type DataColumn } from "./types";

interface Props<T> {
  column: DataColumn<T>;
  values: Record<string, string>;
  sort: { id: string; dir: "asc" | "desc" } | null;
  onSort: (dir: "asc" | "desc" | null) => void;
  onFilter: (patch: Record<string, string>) => void;
}

/** Draft editor for one column's filter; committed on Apply/Enter so typing never refetches. */
export function FilterEditor<T>({
  column,
  draft,
  setDraft,
  onApply,
}: {
  column: DataColumn<T>;
  draft: Record<string, string>;
  setDraft: (draft: Record<string, string>) => void;
  onApply: () => void;
}) {
  const filter = column.filter!;
  const keys = filterKeys(column);
  const onEnter = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onApply();
    }
  };

  if (filter.type === "text") {
    return (
      <Input
        autoFocus
        aria-label={`${column.header} contains`}
        placeholder={filter.placeholder ?? "Contains…"}
        value={draft[column.id] ?? ""}
        onChange={(event) => setDraft({ ...draft, [column.id]: event.target.value })}
        onKeyDown={onEnter}
        className="h-8"
      />
    );
  }

  if (filter.type === "enum") {
    const picked = new Set((draft[column.id] ?? "").split(",").filter(Boolean));
    const toggle = (value: string, on: boolean) => {
      if (on) picked.add(value);
      else picked.delete(value);
      setDraft({ ...draft, [column.id]: [...picked].join(",") });
    };
    return (
      <div className="grid max-h-56 gap-0.5 overflow-y-auto" role="group" aria-label={`${column.header} values`}>
        {filter.options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent"
          >
            <Checkbox
              checked={picked.has(option.value)}
              onCheckedChange={(checked) => toggle(option.value, checked === true)}
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }

  const [lowKey, highKey] = keys as [string, string];
  const type = filter.type === "date" ? "date" : "number";
  const unit = filter.type === "number" ? filter.unit : undefined;
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        [lowKey, filter.type === "date" ? "From" : "Min"],
        [highKey, filter.type === "date" ? "To" : "Max"],
      ].map(([key, label], index) => (
        <label key={key} className="grid gap-1 text-xs text-muted-foreground">
          {label}
          {unit ? ` (${unit})` : ""}
          <Input
            autoFocus={index === 0}
            type={type}
            inputMode={type === "number" ? "decimal" : undefined}
            step="any"
            value={draft[key!] ?? ""}
            onChange={(event) => setDraft({ ...draft, [key!]: event.target.value })}
            onKeyDown={onEnter}
            className="h-8 text-[13px] text-foreground"
          />
        </label>
      ))}
    </div>
  );
}

/** Header label that opens sort and filter controls for its column. */
export function ColumnHeader<T>({ column, values, sort, onSort, onFilter }: Props<T>) {
  const [open, setOpen] = useState(false);
  const keys = filterKeys(column);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const sortedDir = sort?.id === column.id ? sort.dir : null;
  const filtered = keys.some((key) => values[key]);

  if (!column.sortable && !column.filter) {
    return (
      <span className={cn("text-[11px] font-semibold tracking-wider uppercase", column.headerHidden && "sr-only")}>
        {column.header}
      </span>
    );
  }

  const apply = () => {
    onFilter(Object.fromEntries(keys.map((key) => [key, (draft[key] ?? "").trim()])));
    setOpen(false);
  };
  const clear = () => {
    onFilter(Object.fromEntries(keys.map((key) => [key, ""])));
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(Object.fromEntries(keys.map((key) => [key, values[key] ?? ""])));
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "group/header -mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold tracking-wider uppercase outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-accent",
              (sortedDir || filtered) && "text-foreground",
              column.align === "right" && "flex-row-reverse",
            )}
            aria-label={`${column.header}: sort and filter${filtered ? " (filtered)" : ""}${sortedDir ? ` (sorted ${sortedDir === "asc" ? "ascending" : "descending"})` : ""}`}
          />
        }
      >
        {column.header}
        {sortedDir === "asc" ? (
          <ArrowUp className="size-3.5" aria-hidden />
        ) : sortedDir === "desc" ? (
          <ArrowDown className="size-3.5" aria-hidden />
        ) : (
          <ArrowUpDown className="size-3 opacity-0 transition-opacity group-hover/header:opacity-60" aria-hidden />
        )}
        {filtered ? <ListFilter className="size-3.5 text-link" aria-hidden /> : null}
      </PopoverTrigger>
      <PopoverContent align={column.align === "right" ? "end" : "start"} className="w-64 gap-3 p-2.5">
        {column.sortable ? (
          <div className="grid gap-0.5">
            {(
              [
                ["asc", ArrowUp, filterLabel(column, "asc")],
                ["desc", ArrowDown, filterLabel(column, "desc")],
              ] as const
            ).map(([dir, Icon, label]) => (
              <button
                key={dir}
                type="button"
                onClick={() => {
                  onSort(sortedDir === dir ? null : dir);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2 text-left text-[13px] hover:bg-accent",
                  sortedDir === dir && "bg-accent font-medium",
                )}
              >
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                {label}
                {sortedDir === dir ? <Check className="ml-auto size-4" aria-hidden /> : null}
              </button>
            ))}
          </div>
        ) : null}
        {column.filter ? (
          <div className={cn("grid gap-2.5", column.sortable && "border-t pt-2.5")}>
            <p className="px-0.5 text-xs font-medium text-muted-foreground">Filter {column.header.toLowerCase()}</p>
            <FilterEditor column={column} draft={draft} setDraft={setDraft} onApply={apply} />
            <div className="flex justify-end gap-1.5">
              {filtered ? (
                <Button variant="ghost" size="sm" onClick={clear}>
                  <X aria-hidden />
                  Clear
                </Button>
              ) : null}
              <Button size="sm" onClick={apply}>
                Apply
              </Button>
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function filterLabel<T>(column: DataColumn<T>, dir: "asc" | "desc"): string {
  const type = column.filter?.type;
  if (type === "number") return dir === "asc" ? "Smallest first" : "Largest first";
  if (type === "date") return dir === "asc" ? "Oldest first" : "Newest first";
  return dir === "asc" ? "A to Z" : "Z to A";
}
