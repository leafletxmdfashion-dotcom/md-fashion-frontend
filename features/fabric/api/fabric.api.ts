import { api, unwrap, type ApiSuccess } from "@/lib/api-client";

import type {
  AdjustmentInput,
  Fabric,
  FabricFilters,
  FabricInput,
  FabricOption,
  FabricPage,
  Inward,
  InwardFilters,
  InwardInput,
  InwardPage,
  MovementFilters,
  MovementPage,
} from "../types/fabric.types";

export const fabricKeys = {
  all: ["fabric"] as const,
  list: (filters: FabricFilters) => [...fabricKeys.all, "list", filters] as const,
  options: () => [...fabricKeys.all, "options"] as const,
  detail: (id: string) => [...fabricKeys.all, "detail", id] as const,
  inwards: (filters: InwardFilters) => [...fabricKeys.all, "inwards", filters] as const,
  suppliers: () => [...fabricKeys.all, "suppliers"] as const,
  movements: (filters: MovementFilters) => [...fabricKeys.all, "movements", filters] as const,
};

/** Drops empty filters so they never reach the query string. */
function params(filters: object) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""));
}

// `signal` lets React Query cancel a request the user has already moved past
// (e.g. an older search), so a slow stale response can never overwrite a newer one.
export const fabricApi = {
  list(filters: FabricFilters, signal?: AbortSignal): Promise<FabricPage> {
    return unwrap(api.get<ApiSuccess<FabricPage>>("/fabrics", { params: params(filters), signal }));
  },

  async options(signal?: AbortSignal): Promise<FabricOption[]> {
    return (await unwrap(api.get<ApiSuccess<{ fabrics: FabricOption[] }>>("/fabrics/options", { signal }))).fabrics;
  },

  async get(id: string, signal?: AbortSignal): Promise<Fabric> {
    return (await unwrap(api.get<ApiSuccess<{ fabric: Fabric }>>(`/fabrics/${id}`, { signal }))).fabric;
  },

  async create(input: FabricInput): Promise<Fabric> {
    return (await unwrap(api.post<ApiSuccess<{ fabric: Fabric }>>("/fabrics", input))).fabric;
  },

  async update({ id, ...input }: FabricInput & { id: string }): Promise<Fabric> {
    return (await unwrap(api.put<ApiSuccess<{ fabric: Fabric }>>(`/fabrics/${id}`, input))).fabric;
  },

  async adjust({ fabricId, ...input }: AdjustmentInput & { fabricId: string }): Promise<void> {
    await api.post(`/fabrics/${fabricId}/adjustments`, input);
  },

  inwards(filters: InwardFilters, signal?: AbortSignal): Promise<InwardPage> {
    return unwrap(api.get<ApiSuccess<InwardPage>>("/fabrics/inwards", { params: params(filters), signal }));
  },

  async suppliers(signal?: AbortSignal): Promise<string[]> {
    return (await unwrap(api.get<ApiSuccess<{ suppliers: string[] }>>("/fabrics/inwards/suppliers", { signal })))
      .suppliers;
  },

  async createInward(input: InwardInput): Promise<Inward> {
    return (await unwrap(api.post<ApiSuccess<{ inward: Inward }>>("/fabrics/inwards", input))).inward;
  },

  async reverseInward({ id, reason }: { id: string; reason: string }): Promise<Inward> {
    return (await unwrap(api.post<ApiSuccess<{ inward: Inward }>>(`/fabrics/inwards/${id}/reverse`, { reason })))
      .inward;
  },

  movements(filters: MovementFilters, signal?: AbortSignal): Promise<MovementPage> {
    return unwrap(api.get<ApiSuccess<MovementPage>>("/fabrics/movements", { params: params(filters), signal }));
  },
};
