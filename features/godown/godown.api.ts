"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { params, POSTING, useFlowMutation, type ListFilters } from "@/features/packing/packing.api";
import { api, unwrap, type ApiSuccess } from "@/lib/api-client";

// Mirrors md_backend/src/modules/godown.

export interface StockItem {
  article: { id: string; code: string; name: string };
  sizes: { size: string; in: number; out: number; balance: number }[];
  in: number;
  out: number;
  balance: number;
  lastMovementAt: string;
}

export interface StockPage {
  items: StockItem[];
  total: number;
  summary: { items: number; pieces: number; sizes: number; inThisMonth: number; outThisMonth: number };
}

export type MovementType =
  "PACKED_IN" | "PACKING_REVERSAL" | "DISPATCH" | "DISPATCH_REVERSAL" | "ADJUST_IN" | "ADJUST_OUT";

export interface Movement {
  id: string;
  date: string;
  type: MovementType;
  article: { id: string; name: string; code: string };
  sizeLabel: string;
  direction: "IN" | "OUT";
  quantity: number;
  lotNumber: string | null;
  reference: string | null;
  dispatchId: string | null;
  reason: string | null;
  createdBy: string;
}

export interface MovementPage {
  movements: Movement[];
  total: number;
  summary: { in: number; out: number };
}

export interface DispatchRow {
  id: string;
  number: number;
  date: string;
  party: string;
  challan: string | null;
  pieces: number;
  status: "POSTED" | "REVERSED";
  items: string | null;
  createdBy: string;
}

export interface DispatchPage {
  dispatches: DispatchRow[];
  total: number;
  summary: { dispatches: number; pieces: number; parties: number };
}

export interface Dispatch {
  id: string;
  number: number;
  status: "POSTED" | "REVERSED";
  date: string;
  party: string;
  challan: string | null;
  notes: string | null;
  pieces: number;
  lines: { article: { id: string; code: string; name: string }; sizeLabel: string; quantity: number }[];
  createdBy: string;
  createdAt: string;
  reversal: { at: string; by: string | null; reason: string | null } | null;
}

export interface DispatchInput {
  dispatchDate: string;
  party: string;
  challan: string | null;
  notes: string | null;
  lines: { articleId: string; sizeLabel: string; quantity: number }[];
}

export interface AdjustInput {
  date: string;
  articleId: string;
  sizeLabel: string;
  counted: number;
  reason: string;
}

export type LotStage = "production" | "packing" | "done";

export interface FinishedLot {
  id: string;
  lotNumber: string;
  article: { id: string; name: string };
  productionDate: string;
  status: string;
  cut: number;
  unissued: number;
  wip: number;
  good: number;
  reject: number;
  rework: number;
  packed: number;
  toPack: number;
  lastPacked: string | null;
  stage: LotStage;
}

export interface FinishedLotPage {
  lots: FinishedLot[];
  total: number;
  summary: {
    lots: number;
    cut: number;
    good: number;
    reject: number;
    packed: number;
    toPack: number;
    inProduction: number;
  };
}

export interface FinishedItem {
  id: string;
  code: string;
  articleName: string;
  lots: number;
  cut: number;
  good: number;
  reject: number;
  packed: number;
  dispatched: number;
  inStock: number;
}

export const dispatchNumber = (number: number) => `DS-${String(number).padStart(4, "0")}`;

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  PACKED_IN: "Packed in",
  PACKING_REVERSAL: "Packing reversed",
  DISPATCH: "Dispatched",
  DISPATCH_REVERSAL: "Dispatch reversed",
  ADJUST_IN: "Count: added",
  ADJUST_OUT: "Count: removed",
};

const keys = {
  stock: (filters: ListFilters) => ["godown", "stock", filters] as const,
  movements: (filters: ListFilters) => ["godown", "movements", filters] as const,
  dispatches: (filters: ListFilters) => ["godown", "dispatches", filters] as const,
  dispatch: (id: string) => ["godown", "dispatch", id] as const,
  parties: () => ["godown", "parties"] as const,
  lots: (filters: ListFilters) => ["godown", "finished", filters] as const,
  items: (filters: ListFilters) => ["godown", "finished-items", filters] as const,
};

function listQuery<T>(key: readonly unknown[], url: string, filters: ListFilters) {
  return {
    queryKey: key,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      unwrap(api.get<ApiSuccess<T>>(url, { params: params(filters), signal })),
    placeholderData: keepPreviousData,
  };
}

export const useStock = (filters: ListFilters) =>
  useQuery(listQuery<StockPage>(keys.stock(filters), "/godown/stock", filters));

export const useMovements = (filters: ListFilters) =>
  useQuery(listQuery<MovementPage>(keys.movements(filters), "/godown/movements", filters));

export const useDispatches = (filters: ListFilters) =>
  useQuery(listQuery<DispatchPage>(keys.dispatches(filters), "/godown/dispatches", filters));

export const useFinishedLots = (filters: ListFilters) =>
  useQuery(listQuery<FinishedLotPage>(keys.lots(filters), "/godown/finished-goods", filters));

export interface FinishedItemPage {
  items: FinishedItem[];
  total: number;
  totals: { cut: number; good: number; reject: number; packed: number; dispatched: number; inStock: number };
}

export const useFinishedItems = (filters: ListFilters) =>
  useQuery(listQuery<FinishedItemPage>(keys.items(filters), "/godown/finished-goods/items", filters));

export const useDispatch = (id: string | undefined) =>
  useQuery({
    queryKey: keys.dispatch(id ?? ""),
    queryFn: async ({ signal }) =>
      (await unwrap(api.get<ApiSuccess<{ dispatch: Dispatch }>>(`/godown/dispatches/${id}`, { signal }))).dispatch,
    enabled: Boolean(id),
  });

export const useParties = () =>
  useQuery({
    queryKey: keys.parties(),
    queryFn: async ({ signal }) =>
      (await unwrap(api.get<ApiSuccess<{ parties: string[] }>>("/godown/parties", { signal }))).parties,
  });

export const useCreateDispatch = () =>
  useFlowMutation(
    async (input: DispatchInput) =>
      (await unwrap(api.post<ApiSuccess<{ dispatch: Dispatch }>>("/godown/dispatches", input, POSTING))).dispatch,
  );

export const useReverseDispatch = () =>
  useFlowMutation(
    async ({ id, reason }: { id: string; reason: string }) =>
      (
        await unwrap(
          api.post<ApiSuccess<{ dispatch: Dispatch }>>(`/godown/dispatches/${id}/reverse`, { reason }, POSTING),
        )
      ).dispatch,
  );

export const useAdjustStock = () =>
  useFlowMutation(
    async (input: AdjustInput) =>
      (
        await unwrap(
          api.post<ApiSuccess<{ adjustment: { from: number; to: number } }>>("/godown/adjustments", input, POSTING),
        )
      ).adjustment,
  );
