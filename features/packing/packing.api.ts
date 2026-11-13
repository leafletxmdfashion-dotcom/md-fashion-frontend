"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type ApiSuccess } from "@/lib/api-client";

// Mirrors md_backend/src/modules/packing. Money fields are null without costing.view.

export type ListFilters = Record<string, string | number | undefined>;

export interface QueueLot {
  lot: { id: string; lotNumber: string; articleName: string; articleCode: string };
  sizes: { size: string; good: number; packed: number; waiting: number }[];
  good: number;
  packed: number;
  waiting: number;
}

export interface PackingQueue {
  lots: QueueLot[];
  /** Lots matching the filters (all of them when no page was asked for). */
  total: number;
  totals: { good: number; packed: number; waiting: number };
}

export interface PackingSummary {
  waiting: number;
  packedToday: number;
  packedThisMonth: number;
  packedTotal: number;
  entriesToday: number;
  packersToday: number;
  earningThisMonth: string | null;
}

export interface PackingEntryRow {
  id: string;
  number: number;
  date: string;
  status: "POSTED" | "REVERSED";
  lot: { id: string; lotNumber: string; articleName: string };
  packer: { id: string; name: string };
  pieces: number;
  sizes: string;
  rate: string | null;
  earning: string | null;
}

export interface PackingEntryPage {
  entries: PackingEntryRow[];
  total: number;
  summary: { entries: number; pieces: number; earning: string | null };
}

export interface PackingEntry {
  id: string;
  number: number;
  status: "POSTED" | "REVERSED";
  date: string;
  lot: { id: string; lotNumber: string; articleName: string };
  packer: { id: string; name: string };
  pieces: number;
  rate: string | null;
  earning: string | null;
  notes: string | null;
  lines: { sizeLabel: string; quantity: number }[];
  createdBy: string;
  createdAt: string;
  reversal: { at: string; by: string | null; reason: string | null } | null;
}

export interface PackingLineRow {
  id: string;
  date: string;
  entry: { id: string; number: number };
  packer: { id: string; name: string };
  lot: { id: string; lotNumber: string };
  articleName: string;
  sizeLabel: string;
  quantity: number;
}

export interface PackingLinePage {
  lines: PackingLineRow[];
  total: number;
  pieces: number;
}

export interface PackerPage {
  staff: PackerRow[];
  total: number;
  totals: { pieces: number; earned: string | null };
}

export interface PackerRow {
  id: string;
  number: number;
  name: string;
  entries: number;
  pieces: number;
  lots: number;
  items: string;
  firstDate: string;
  lastDate: string;
  earned: string | null;
}

export interface PackInput {
  lotId: string;
  packerId: string;
  packDate: string;
  notes: string | null;
  lines: { sizeLabel: string; quantity: number }[];
}

export const packingNumber = (number: number) => `PK-${String(number).padStart(4, "0")}`;

export const packingKeys = {
  all: ["packing"] as const,
  queue: (filters: ListFilters) => [...packingKeys.all, "queue", filters] as const,
  summary: () => [...packingKeys.all, "summary"] as const,
  entries: (filters: ListFilters) => [...packingKeys.all, "entries", filters] as const,
  entry: (id: string) => [...packingKeys.all, "entry", id] as const,
  lines: (filters: ListFilters) => [...packingKeys.all, "lines", filters] as const,
  staff: (filters: ListFilters) => [...packingKeys.all, "staff", filters] as const,
};

/** Drops empty filters so they never reach the query string. */
export function params(filters: ListFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""));
}

export const POSTING = { timeout: 60_000 };

export const packingApi = {
  queue: (filters: ListFilters, signal?: AbortSignal) =>
    unwrap(api.get<ApiSuccess<PackingQueue>>("/packing/queue", { params: params(filters), signal })),
  summary: (signal?: AbortSignal) => unwrap(api.get<ApiSuccess<PackingSummary>>("/packing/summary", { signal })),
  entries: (filters: ListFilters, signal?: AbortSignal) =>
    unwrap(api.get<ApiSuccess<PackingEntryPage>>("/packing/entries", { params: params(filters), signal })),
  async entry(id: string, signal?: AbortSignal) {
    return (await unwrap(api.get<ApiSuccess<{ entry: PackingEntry }>>(`/packing/entries/${id}`, { signal }))).entry;
  },
  lines: (filters: ListFilters, signal?: AbortSignal) =>
    unwrap(api.get<ApiSuccess<PackingLinePage>>("/packing/lines", { params: params(filters), signal })),
  staff: (filters: ListFilters, signal?: AbortSignal) =>
    unwrap(api.get<ApiSuccess<PackerPage>>("/packing/staff", { params: params(filters), signal })),
  async pack(input: PackInput) {
    return (await unwrap(api.post<ApiSuccess<{ entry: PackingEntry }>>("/packing/entries", input, POSTING))).entry;
  },
  async reverse({ id, reason }: { id: string; reason: string }) {
    return (
      await unwrap(api.post<ApiSuccess<{ entry: PackingEntry }>>(`/packing/entries/${id}/reverse`, { reason }, POSTING))
    ).entry;
  },
};

/** Lots waiting to be packed; without a page, every one (e.g. for the pack dialog's lot picker). */
export const usePackingQueue = (filters: ListFilters = {}) =>
  useQuery({
    queryKey: packingKeys.queue(filters),
    queryFn: ({ signal }) => packingApi.queue(filters, signal),
    placeholderData: keepPreviousData,
  });

export const usePackingSummary = (enabled = true) =>
  useQuery({ queryKey: packingKeys.summary(), queryFn: ({ signal }) => packingApi.summary(signal), enabled });

export const usePackingEntries = (filters: ListFilters) =>
  useQuery({
    queryKey: packingKeys.entries(filters),
    queryFn: ({ signal }) => packingApi.entries(filters, signal),
    placeholderData: keepPreviousData,
  });

export const usePackingEntry = (id: string | undefined) =>
  useQuery({
    queryKey: packingKeys.entry(id ?? ""),
    queryFn: ({ signal }) => packingApi.entry(id!, signal),
    enabled: Boolean(id),
  });

export const usePackingLines = (filters: ListFilters) =>
  useQuery({
    queryKey: packingKeys.lines(filters),
    queryFn: ({ signal }) => packingApi.lines(filters, signal),
    placeholderData: keepPreviousData,
  });

export const usePackers = (filters: ListFilters) =>
  useQuery({
    queryKey: packingKeys.staff(filters),
    queryFn: ({ signal }) => packingApi.staff(filters, signal),
    placeholderData: keepPreviousData,
  });

/**
 * Downstream postings move pieces, stock and money at once: packing, the godown, payments,
 * stitching (receipt reversal rules) and production (lot cost) all refresh. Not awaited.
 */
export function useFlowMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSettled: () => {
      for (const key of ["packing", "godown", "payments", "stitching", "production"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export const usePack = () => useFlowMutation(packingApi.pack);

export const useReversePacking = () => useFlowMutation(packingApi.reverse);
