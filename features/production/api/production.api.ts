import { api, unwrap, type ApiSuccess } from "@/lib/api-client";
import type { CreatedLogin } from "@/features/users/types/user.types";

import type {
  Article,
  Batch,
  BatchPage,
  CreateLotInput,
  CuttingDraftInput,
  Karigar,
  KarigarInput,
  KarigarOption,
  ListFilters,
  LotDetail,
  LotPage,
  UpdateLotInput,
} from "../types/production.types";

export const productionKeys = {
  all: ["production"] as const,
  lots: (filters: ListFilters) => [...productionKeys.all, "lots", filters] as const,
  lot: (id: string) => [...productionKeys.all, "lot", id] as const,
  batches: (filters: ListFilters) => [...productionKeys.all, "batches", filters] as const,
  batch: (id: string) => [...productionKeys.all, "batch", id] as const,
  articleOptions: () => [...productionKeys.all, "article-options"] as const,
  karigars: (filters: ListFilters) => [...productionKeys.all, "karigars", filters] as const,
  karigarOptions: (category?: string) => [...productionKeys.all, "karigar-options", category ?? "all"] as const,
};

/** Drops empty filters so they never reach the query string. */
function params(filters: ListFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""));
}

// Writes that post stock run several database steps in one transaction; allow for a
// cold, far-away database instead of failing at the default 15 s.
const POSTING = { timeout: 60_000 };

export const productionApi = {
  lots(filters: ListFilters, signal?: AbortSignal): Promise<LotPage> {
    return unwrap(
      api.get<ApiSuccess<LotPage>>("/production-lots", {
        params: params(filters),
        signal,
      }),
    );
  },

  async lot(id: string, signal?: AbortSignal): Promise<LotDetail> {
    return (
      await unwrap(
        api.get<ApiSuccess<{ lot: LotDetail }>>(`/production-lots/${id}`, {
          signal,
        }),
      )
    ).lot;
  },

  createLot(input: CreateLotInput): Promise<{ lot: LotDetail; batch: Batch | null }> {
    return unwrap(api.post<ApiSuccess<{ lot: LotDetail; batch: Batch | null }>>("/production-lots", input, POSTING));
  },

  async updateLot({ id, ...input }: UpdateLotInput & { id: string }): Promise<LotDetail> {
    return (await unwrap(api.patch<ApiSuccess<{ lot: LotDetail }>>(`/production-lots/${id}`, input))).lot;
  },

  async createBatch({ lotId, ...input }: CuttingDraftInput & { lotId: string }): Promise<Batch> {
    return (await unwrap(api.post<ApiSuccess<{ batch: Batch }>>(`/production-lots/${lotId}/cutting-batches`, input)))
      .batch;
  },

  batches(filters: ListFilters, signal?: AbortSignal): Promise<BatchPage> {
    return unwrap(
      api.get<ApiSuccess<BatchPage>>("/cutting-batches", {
        params: params(filters),
        signal,
      }),
    );
  },

  async batch(id: string, signal?: AbortSignal): Promise<Batch> {
    return (
      await unwrap(
        api.get<ApiSuccess<{ batch: Batch }>>(`/cutting-batches/${id}`, {
          signal,
        }),
      )
    ).batch;
  },

  async saveBatch({ id, ...input }: CuttingDraftInput & { id: string }): Promise<Batch> {
    return (await unwrap(api.put<ApiSuccess<{ batch: Batch }>>(`/cutting-batches/${id}`, input, POSTING))).batch;
  },

  async deleteBatch(id: string): Promise<void> {
    await api.delete(`/cutting-batches/${id}`);
  },

  /** Issues the batch's fabric; unsaved form edits sent as `cutting` are saved first, in the same request. */
  async issue({ id, cutting }: { id: string; cutting?: CuttingDraftInput }): Promise<Batch> {
    return (await unwrap(api.post<ApiSuccess<{ batch: Batch }>>(`/cutting-batches/${id}/issue`, { cutting }, POSTING)))
      .batch;
  },

  async finalize({ id, cutting }: { id: string; cutting?: CuttingDraftInput }): Promise<Batch> {
    return (
      await unwrap(api.post<ApiSuccess<{ batch: Batch }>>(`/cutting-batches/${id}/finalize`, { cutting }, POSTING))
    ).batch;
  },

  async reverse({ id, reason }: { id: string; reason: string }): Promise<Batch> {
    return (await unwrap(api.post<ApiSuccess<{ batch: Batch }>>(`/cutting-batches/${id}/reverse`, { reason }, POSTING)))
      .batch;
  },

  async articleOptions(signal?: AbortSignal): Promise<Article[]> {
    return (
      await unwrap(
        api.get<ApiSuccess<{ articles: Article[] }>>("/articles/options", {
          signal,
        }),
      )
    ).articles;
  },

  karigars(filters: ListFilters, signal?: AbortSignal): Promise<{ karigars: Karigar[]; total: number }> {
    return unwrap(
      api.get<ApiSuccess<{ karigars: Karigar[]; total: number }>>("/karigars", {
        params: params(filters),
        signal,
      }),
    );
  },

  async karigarOptions(category?: string, signal?: AbortSignal): Promise<KarigarOption[]> {
    return (
      await unwrap(
        api.get<ApiSuccess<{ karigars: KarigarOption[] }>>("/karigars/options", {
          params: params({ category }),
          signal,
        }),
      )
    ).karigars;
  },

  /** Saves the person; `login` is set when a new login was created with them. */
  async saveKarigar({ id, ...input }: KarigarInput & { id?: string }): Promise<{
    karigar: Karigar;
    login: CreatedLogin | null;
  }> {
    const request = id
      ? api.put<ApiSuccess<{ karigar: Karigar; login: CreatedLogin | null }>>(`/karigars/${id}`, input)
      : api.post<ApiSuccess<{ karigar: Karigar; login: CreatedLogin | null }>>("/karigars", input);

    return unwrap(request);
  },
};
