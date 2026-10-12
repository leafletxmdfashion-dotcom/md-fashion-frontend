"use client";

import { useSearchParams } from "next/navigation";

import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "@/lib/pagination";

/**
 * Filter, page and page-size state kept in the query string, so a filtered view
 * survives a reload and can be shared. Updates go through the native History API,
 * which Next.js syncs into useSearchParams without a server round trip.
 * Changing anything except the page returns to page 1.
 * Callers must sit inside a <Suspense> boundary (useSearchParams).
 */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const params = useSearchParams();

  const filters = Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ""])) as Record<K, string>;
  const page = Math.max(1, Math.floor(Number(params.get("page"))) || 1);
  const sizeParam = Number(params.get("size"));
  const pageSize = (PAGE_SIZES as readonly number[]).includes(sizeParam) ? sizeParam : DEFAULT_PAGE_SIZE;

  const write = (patch: Record<string, string>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in patch)) next.delete("page");
    const query = next.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  };

  return {
    filters,
    page,
    pageSize,
    setFilters: (patch: Partial<Record<K, string>>) => write(patch as Record<string, string>),
    setPage: (next: number) => write({ page: next > 1 ? String(next) : "" }),
    setPageSize: (next: number) => write({ size: next === DEFAULT_PAGE_SIZE ? "" : String(next) }),
    clearFilters: () => write(Object.fromEntries(keys.map((key) => [key, ""]))),
    isFiltered: keys.some((key) => filters[key]),
  };
}
