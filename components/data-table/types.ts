import type { ColumnShape } from "@/components/states";

export type ColumnFilter =
  | { type: "text"; placeholder?: string }
  | { type: "enum"; options: { value: string; label: string }[] }
  | { type: "number"; unit?: string }
  | { type: "date" };

export interface DataColumn<T> {
  /** Matches the API's column key, so URL params pass straight through. */
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "right";
  /** Responsive visibility and width, applied to header and cells. */
  className?: string;
  sortable?: boolean;
  filter?: ColumnFilter;
  /** Placeholder bar shape while loading. */
  skeleton?: Pick<ColumnShape, "sub" | "width" | "avatar">;
  /** Header text for screen readers only (e.g. an actions column). */
  headerHidden?: boolean;
  /** False keeps the column out of the column picker (e.g. the identifying column). */
  hideable?: boolean;
  /** Value written when exporting selected rows. */
  csv?: (row: T) => string | number | null | undefined;
}

/** Query-string keys a column's filter uses; mirrors md_backend/src/lib/list-query.ts. */
export function filterKeys(column: { id: string; filter?: ColumnFilter }): string[] {
  switch (column.filter?.type) {
    case "text":
    case "enum":
      return [column.id];
    case "number":
      return [`${column.id}Min`, `${column.id}Max`];
    case "date":
      return [`${column.id}From`, `${column.id}To`];
    default:
      return [];
  }
}

/** Human summary of an active column filter, e.g. "≥ 10 kg" or "Knit, Woven". */
export function describeFilter(column: DataColumn<never>, values: Record<string, string>): string | null {
  const filter = column.filter;
  if (!filter) return null;
  if (filter.type === "text") return values[column.id] ? `contains “${values[column.id]}”` : null;
  if (filter.type === "enum") {
    const picked = (values[column.id] ?? "").split(",").filter(Boolean);
    if (picked.length === 0) return null;
    return picked.map((value) => filter.options.find((option) => option.value === value)?.label ?? value).join(", ");
  }
  const [low, high] = filterKeys(column).map((key) => values[key]);
  const unit = filter.type === "number" && filter.unit ? ` ${filter.unit}` : "";
  if (low && high) return `${low} – ${high}${unit}`;
  if (low) return `${filter.type === "date" ? "from" : "≥"} ${low}${unit}`;
  if (high) return `${filter.type === "date" ? "until" : "≤"} ${high}${unit}`;
  return null;
}
