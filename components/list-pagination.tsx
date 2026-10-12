"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZES } from "@/lib/pagination";

const number = new Intl.NumberFormat("en-IN");

/** Footer for paged tables: rows per page, the visible range, and page navigation. */
export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const first = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(current * pageSize, total);
  // A page past the end (rows removed, filter narrowed in another tab) snaps back to the last page.
  useEffect(() => {
    if (total > 0 && page > pages) onPageChange(pages);
  }, [total, page, pages, onPageChange]);

  const sizes = PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }));

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[13px] text-muted-foreground"
    >
      <div className="flex items-center gap-2">
        <span id="rows-per-page">Rows per page</span>
        <Select items={sizes} value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger size="sm" aria-labelledby="rows-per-page" className="w-[72px] bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sizes.map((size) => (
              <SelectItem key={size.value} value={size.value}>
                {size.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3">
        <p className="tabular-nums" aria-live="polite">
          {number.format(first)}–{number.format(last)} of {number.format(total)}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="First page"
            disabled={current <= 1}
            onClick={() => onPageChange(1)}
            className="hidden sm:inline-flex"
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={current <= 1}
            onClick={() => onPageChange(current - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-20 text-center tabular-nums">
            Page {number.format(current)} of {number.format(pages)}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={current >= pages}
            onClick={() => onPageChange(current + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Last page"
            disabled={current >= pages}
            onClick={() => onPageChange(pages)}
            className="hidden sm:inline-flex"
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </nav>
  );
}
