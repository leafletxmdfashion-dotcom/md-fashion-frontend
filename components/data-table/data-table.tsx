"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Download, ListFilter, MoreHorizontal, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ListPagination } from "@/components/list-pagination";
import { SearchInput } from "@/components/search-input";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

import { ColumnHeader, FilterEditor } from "./column-header";
import { describeFilter, filterKeys, type DataColumn } from "./types";

export type { DataColumn } from "./types";

/**
 * URL-backed state for a data table: search (q), sort/dir, every column filter, page
 * and page size, plus any extra keys the page owns. `params` is what the API expects.
 */
export function useDataTableState<T>(columns: DataColumn<T>[], extraKeys: readonly string[] = []) {
  const keys = ["q", "sort", "dir", ...extraKeys, ...columns.flatMap(filterKeys)];
  const url = useUrlFilters(keys);
  const { q, sort, dir, ...rest } = url.filters;
  const params: Record<string, string> = Object.fromEntries(Object.entries(rest).filter(([, value]) => value));
  if (q) params.search = q;
  if (sort) {
    params.sort = sort;
    params.dir = dir === "desc" ? "desc" : "asc";
  }
  return {
    ...url,
    params,
    sort: sort ? { id: sort, dir: dir === "desc" ? ("desc" as const) : ("asc" as const) } : null,
  };
}

export type DataTableState = ReturnType<typeof useDataTableState>;

export interface ExtraFilter {
  label: string;
  value: string;
  onClear: () => void;
}

interface DataTableProps<T> {
  /** Stable name; remembers hidden columns per table. */
  id: string;
  columns: DataColumn<T>[];
  rows: T[] | undefined;
  rowId: (row: T) => string;
  total: number | undefined;
  state: DataTableState;
  isFetching?: boolean;
  isPlaceholderData?: boolean;
  error?: unknown;
  onRetry?: () => void;
  searchLabel: string;
  searchPlaceholder: string;
  /** Shown when nothing exists yet (no filters applied). */
  empty: {
    icon?: React.ComponentProps<typeof EmptyState>["icon"];
    title: string;
    description?: string;
    action?: React.ReactNode;
  };
  /** True when the underlying collection is empty regardless of filters. */
  isEmpty?: boolean;
  /** Filters that live outside the columns (quick filters, pickers), listed in the Filters popover. */
  extraFilters?: ExtraFilter[];
  toolbarStart?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
  /** Server CSV export of every row matching the current filters. */
  onExport?: () => Promise<void>;
  /** Menu items for a row's ⋯ button. */
  rowActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  /** Enables row checkboxes; renders bulk actions for the selection. */
  bulkActions?: (rows: T[], clear: () => void) => React.ReactNode;
  footer?: (rows: T[]) => React.ReactNode;
  exportName?: string;
}

function readHidden(id: string, columns: DataColumn<unknown>[]): Set<string> {
  try {
    const stored = JSON.parse(localStorage.getItem(`table-columns:${id}`) ?? "[]") as unknown;
    const known = new Set(columns.filter((column) => column.hideable !== false).map((column) => column.id));
    return new Set(Array.isArray(stored) ? stored.filter((value) => known.has(String(value))).map(String) : []);
  } catch {
    return new Set();
  }
}

function ToolbarButton({
  label,
  count,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string; count?: number }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={count ? `${label} (${count} active)` : label}
            className="relative text-muted-foreground hover:text-foreground data-popup-open:bg-accent data-popup-open:text-foreground"
            {...props}
          />
        }
      >
        {children}
        {count ? (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {count}
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function DataTable<T>({
  id,
  columns,
  rows,
  rowId,
  total,
  state,
  isFetching,
  isPlaceholderData,
  error,
  onRetry,
  searchLabel,
  searchPlaceholder,
  empty,
  isEmpty,
  extraFilters = [],
  toolbarStart,
  toolbarEnd,
  onExport,
  rowActions,
  onRowClick,
  bulkActions,
  footer,
  exportName = id,
}: DataTableProps<T>) {
  const [hidden, setHidden] = useState(() => readHidden(id, columns as DataColumn<unknown>[]));
  const [selected, setSelected] = useState<Map<string, T>>(new Map());
  const [exporting, setExporting] = useState(false);
  const [filterColumn, setFilterColumn] = useState<string>("");
  const [filterDraft, setFilterDraft] = useState<Record<string, string>>({});

  // A new search or filter is a new result set: drop the selection (pages keep it).
  const resultKey = JSON.stringify({ ...state.params, page: undefined });
  const [selectionKey, setSelectionKey] = useState(resultKey);
  if (selectionKey !== resultKey) {
    setSelectionKey(resultKey);
    if (selected.size > 0) setSelected(new Map());
  }

  const visible = columns.filter((column) => !hidden.has(column.id));
  const selectable = Boolean(bulkActions);
  const colSpan = visible.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);
  const filterable = columns.filter((column) => column.filter);
  const sortable = columns.filter((column) => column.sortable);

  const activeColumnFilters = filterable
    .map((column) => ({ column, text: describeFilter(column as DataColumn<never>, state.filters) }))
    .filter((entry): entry is { column: DataColumn<T>; text: string } => entry.text !== null);
  const activeCount = activeColumnFilters.length + extraFilters.length;
  const anyFilter = activeCount > 0 || Boolean(state.filters.q);

  const clearColumn = (column: DataColumn<T>) =>
    state.setFilters(Object.fromEntries(filterKeys(column).map((key) => [key, ""])));
  const clearAll = () => {
    state.setFilters({
      q: "",
      ...Object.fromEntries(filterable.flatMap(filterKeys).map((key) => [key, ""])),
    });
    for (const extra of extraFilters) extra.onClear();
  };

  const toggleColumn = (columnId: string, show: boolean) => {
    const next = new Set(hidden);
    if (show) next.delete(columnId);
    else next.add(columnId);
    setHidden(next);
    localStorage.setItem(`table-columns:${id}`, JSON.stringify([...next]));
  };

  const pageRows = rows ?? [];
  const pageSelected = pageRows.filter((row) => selected.has(rowId(row))).length;
  const togglePage = (on: boolean) => {
    const next = new Map(selected);
    for (const row of pageRows) {
      if (on) next.set(rowId(row), row);
      else next.delete(rowId(row));
    }
    setSelected(next);
  };
  const toggleRow = (row: T, on: boolean) => {
    const next = new Map(selected);
    if (on) next.set(rowId(row), row);
    else next.delete(rowId(row));
    setSelected(next);
  };
  const clearSelection = () => setSelected(new Map());

  const exportSelected = () => {
    const exportable = columns.filter((column) => column.csv);
    downloadCsv(
      `${exportName}-selected`,
      exportable.map((column) => column.header),
      [...selected.values()].map((row) => exportable.map((column) => column.csv!(row) ?? null)),
    );
  };

  const runExport = async () => {
    if (!onExport) return;
    setExporting(true);
    try {
      await onExport();
    } catch {
      toast.error("Could not export. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const pickFilterColumn = (columnId: string) => {
    setFilterColumn(columnId);
    const column = filterable.find((item) => item.id === columnId);
    setFilterDraft(column ? Object.fromEntries(filterKeys(column).map((key) => [key, state.filters[key] ?? ""])) : {});
  };
  const pickedColumn = filterable.find((column) => column.id === filterColumn);

  const showEmpty = rows !== undefined && total === 0;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* Toolbar: search, filter/sort/columns on the left; page actions on the right. */}
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <SearchInput
          label={searchLabel}
          placeholder={searchPlaceholder}
          value={state.filters.q ?? ""}
          onChange={(q) => state.setFilters({ q })}
          className="w-full border-transparent bg-muted shadow-none sm:w-72"
        />
        <div className="flex items-center gap-0.5">
          <Popover
            onOpenChange={(open) => {
              if (open) pickFilterColumn(activeColumnFilters[0]?.column.id ?? filterable[0]?.id ?? "");
            }}
          >
            <PopoverTrigger render={<ToolbarButton label="Filters" count={activeCount} />}>
              <ListFilter />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 gap-3 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold">Filters</p>
                {activeCount > 0 ? (
                  <Button variant="ghost" size="xs" onClick={clearAll}>
                    Clear all
                  </Button>
                ) : null}
              </div>
              {activeCount > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {extraFilters.map((extra) => (
                    <li key={extra.label}>
                      <FilterChip label={extra.label} value={extra.value} onClear={extra.onClear} />
                    </li>
                  ))}
                  {activeColumnFilters.map(({ column, text }) => (
                    <li key={column.id}>
                      <FilterChip label={column.header} value={text} onClear={() => clearColumn(column)} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No filters yet. Add one below, or use any column header.
                </p>
              )}
              {filterable.length > 0 ? (
                <div className="grid gap-2.5 border-t pt-3">
                  <Select
                    items={filterable.map((column) => ({ value: column.id, label: column.header }))}
                    value={filterColumn}
                    onValueChange={(value) => pickFilterColumn(String(value ?? ""))}
                  >
                    <SelectTrigger size="sm" aria-label="Column to filter" className="w-full">
                      <SelectValue placeholder="Choose a column" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterable.map((column) => (
                        <SelectItem key={column.id} value={column.id}>
                          {column.header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {pickedColumn ? (
                    <>
                      <FilterEditor
                        key={pickedColumn.id}
                        column={pickedColumn}
                        draft={filterDraft}
                        setDraft={setFilterDraft}
                        onApply={() => state.setFilters(trimmed(filterDraft))}
                      />
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => state.setFilters(trimmed(filterDraft))}>
                          Apply filter
                        </Button>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </PopoverContent>
          </Popover>

          {sortable.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<ToolbarButton label="Sort" count={state.sort ? 1 : undefined} />}>
                <ArrowUpDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-52">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  {sortable.map((column) => {
                    const dir = state.sort?.id === column.id ? state.sort.dir : null;
                    return (
                      <DropdownMenuItem
                        key={column.id}
                        closeOnClick={false}
                        onClick={() =>
                          state.setFilters(
                            dir === "desc"
                              ? { sort: "", dir: "" }
                              : { sort: column.id, dir: dir === "asc" ? "desc" : "asc" },
                          )
                        }
                      >
                        {column.header}
                        <span className="ml-auto text-muted-foreground">
                          {dir === "asc" ? (
                            <ArrowUp className="size-4" aria-label="ascending" />
                          ) : dir === "desc" ? (
                            <ArrowDown className="size-4" aria-label="descending" />
                          ) : null}
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
                {state.sort ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => state.setFilters({ sort: "", dir: "" })}>
                      Reset to default order
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger render={<ToolbarButton label="Columns" count={hidden.size || undefined} />}>
              <Columns3 />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                {columns
                  .filter((column) => column.hideable !== false)
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={!hidden.has(column.id)}
                      onCheckedChange={(checked) => toggleColumn(column.id, checked)}
                      closeOnClick={false}
                    >
                      {column.header}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuGroup>
              {hidden.size > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setHidden(new Set());
                      localStorage.removeItem(`table-columns:${id}`);
                    }}
                  >
                    Show all columns
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {toolbarStart}
        {anyFilter ? (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
            <X aria-hidden />
            Reset
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {onExport ? (
            <Button
              variant="secondary"
              onClick={() => void runExport()}
              disabled={exporting || total === 0}
              aria-label="Export"
              title="Export all matching rows as CSV"
            >
              <Download aria-hidden />
              <span className="hidden sm:inline">{exporting ? "Exporting…" : "Export"}</span>
            </Button>
          ) : null}
          {toolbarEnd}
        </div>
      </div>

      {error && !rows ? (
        <ErrorState title="Could not load this list" error={error} onRetry={onRetry} />
      ) : showEmpty && isEmpty ? (
        <EmptyState {...empty} />
      ) : showEmpty ? (
        <EmptyState
          title="No results match"
          description="Try another search, or clear the filters."
          action={
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <Table
          className={cn("text-[13px] transition-opacity", isPlaceholderData && "opacity-60")}
          aria-busy={isFetching}
        >
          <TableHeader className="bg-transparent">
            <TableRow className="hover:bg-transparent">
              {selectable ? (
                <TableHead className="w-10 pr-0">
                  <Checkbox
                    aria-label="Select all rows on this page"
                    checked={pageRows.length > 0 && pageSelected === pageRows.length}
                    indeterminate={pageSelected > 0 && pageSelected < pageRows.length}
                    onCheckedChange={(checked) => togglePage(checked === true)}
                    disabled={pageRows.length === 0}
                  />
                </TableHead>
              ) : null}
              {visible.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn(column.align === "right" && "text-right", column.className)}
                  aria-sort={
                    state.sort?.id === column.id
                      ? state.sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : column.sortable
                        ? "none"
                        : undefined
                  }
                >
                  <ColumnHeader
                    column={column}
                    values={state.filters}
                    sort={state.sort}
                    onSort={(dir) => state.setFilters(dir ? { sort: column.id, dir } : { sort: "", dir: "" })}
                    onFilter={(patch) => state.setFilters(patch)}
                  />
                </TableHead>
              ))}
              {rowActions ? (
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows ? (
              <SkeletonRows
                rows={Math.min(state.pageSize, 10)}
                columns={[
                  ...(selectable ? [{ className: "w-10 pr-0", width: "size-4" }] : []),
                  ...visible.map((column) => ({
                    ...column.skeleton,
                    className: column.className,
                    align: column.align,
                  })),
                  ...(rowActions ? [{ className: "w-12", align: "right" as const, width: "w-6" }] : []),
                ]}
              />
            ) : (
              rows.map((row) => {
                const key = rowId(row);
                const isSelected = selected.has(key);
                return (
                  <TableRow
                    key={key}
                    data-state={isSelected ? "selected" : undefined}
                    className={cn(onRowClick && "cursor-pointer")}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {selectable ? (
                      <TableCell className="w-10 pr-0" onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          aria-label="Select row"
                          checked={isSelected}
                          onCheckedChange={(checked) => toggleRow(row, checked === true)}
                        />
                      </TableCell>
                    ) : null}
                    {visible.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(
                          "py-2.5",
                          column.align === "right" && "text-right tabular-nums",
                          column.className,
                        )}
                      >
                        {column.cell(row)}
                      </TableCell>
                    ))}
                    {rowActions ? (
                      <TableCell className="w-12 py-2.5 text-right" onClick={(event) => event.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon-sm" aria-label="Row actions" />}
                          >
                            <MoreHorizontal aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-44">
                            {rowActions(row)}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            )}
          </TableBody>
          {rows && footer ? (
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colSpan} className="py-2.5">
                  {footer(rows)}
                </TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      )}

      {rows && total ? (
        <div className="border-t px-3 py-2.5">
          <ListPagination
            page={state.page}
            pageSize={state.pageSize}
            total={total}
            onPageChange={state.setPage}
            onPageSizeChange={state.setPageSize}
          />
        </div>
      ) : null}

      {selectable && selected.size > 0 ? (
        <div
          role="toolbar"
          aria-label="Selected rows"
          className="fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-lg bg-foreground p-1.5 pl-4 text-background shadow-lg [&_[data-slot=button]]:text-background [&_[data-slot=button]:hover]:bg-background/15"
        >
          <span className="pr-2 text-[13px] whitespace-nowrap opacity-80" aria-live="polite">
            Selected: {selected.size}
          </span>
          <span aria-hidden className="h-5 w-px bg-background/25" />
          {columns.some((column) => column.csv) ? (
            <Button variant="ghost" size="sm" onClick={exportSelected}>
              <Download aria-hidden />
              Export
            </Button>
          ) : null}
          {bulkActions?.([...selected.values()], clearSelection)}
          <Button
            size="sm"
            onClick={clearSelection}
            className="ml-1 bg-background! font-semibold text-destructive! hover:bg-background/90!"
          >
            Discard
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function trimmed(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));
}

function FilterChip({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/60 py-0.5 pr-0.5 pl-2 text-xs">
      <span className="truncate">
        <span className="text-muted-foreground">{label}:</span> {value}
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${label} filter`}
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
