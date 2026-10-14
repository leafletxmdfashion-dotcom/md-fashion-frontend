"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fabricKeys } from "@/features/fabric/api/fabric.api";

import { productionApi, productionKeys } from "../api/production.api";
import type { ListFilters } from "../types/production.types";

// Paged lists keep showing the previous page while the next one loads (no layout jump).

export function useLots(filters: ListFilters) {
  return useQuery({
    queryKey: productionKeys.lots(filters),
    queryFn: ({ signal }) => productionApi.lots(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useBatches(filters: ListFilters, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: productionKeys.batches(filters),
    queryFn: ({ signal }) => productionApi.batches(filters, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useBatch(id: string | undefined) {
  return useQuery({
    queryKey: productionKeys.batch(id ?? ""),
    queryFn: ({ signal }) => productionApi.batch(id!, signal),
    enabled: Boolean(id),
  });
}

export function useArticles(filters: ListFilters) {
  return useQuery({
    queryKey: productionKeys.articles(filters),
    queryFn: ({ signal }) => productionApi.articles(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useArticleOptions() {
  return useQuery({ queryKey: productionKeys.articleOptions(), queryFn: ({ signal }) => productionApi.articleOptions(signal) });
}

export function useSizeTemplates() {
  return useQuery({ queryKey: productionKeys.sizeTemplates(), queryFn: ({ signal }) => productionApi.sizeTemplates(signal) });
}

export function useKarigars(filters: ListFilters) {
  return useQuery({
    queryKey: productionKeys.karigars(filters),
    queryFn: ({ signal }) => productionApi.karigars(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useKarigarOptions(category?: string) {
  return useQuery({
    queryKey: productionKeys.karigarOptions(category),
    queryFn: ({ signal }) => productionApi.karigarOptions(category, signal),
  });
}

/** Production writes can move fabric stock, so production and fabric queries both refresh. */
function useProductionMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productionKeys.all }),
        queryClient.invalidateQueries({ queryKey: fabricKeys.all }),
      ]);
    },
  });
}

export const useCreateLot = () => useProductionMutation(productionApi.createLot);

export const useUpdateLot = () => useProductionMutation(productionApi.updateLot);

export const useCreateBatch = () => useProductionMutation(productionApi.createBatch);

export const useSaveBatch = () => useProductionMutation(productionApi.saveBatch);

export const useDeleteBatch = () => useProductionMutation(productionApi.deleteBatch);

export const useIssueBatch = () => useProductionMutation(productionApi.issue);

export const useFinalizeBatch = () => useProductionMutation(productionApi.finalize);

export const useReverseBatch = () => useProductionMutation(productionApi.reverse);

export const useSaveArticle = () => useProductionMutation(productionApi.saveArticle);

export const useSaveSizeTemplate = () => useProductionMutation(productionApi.saveSizeTemplate);

export const useDeleteSizeTemplate = () => useProductionMutation(productionApi.deleteSizeTemplate);

export const useSaveKarigar = () => useProductionMutation(productionApi.saveKarigar);
