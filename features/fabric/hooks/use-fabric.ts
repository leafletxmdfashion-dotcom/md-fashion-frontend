"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fabricApi, fabricKeys } from "../api/fabric.api";
import type { FabricFilters, InwardFilters, MovementFilters } from "../types/fabric.types";

// Paged lists keep showing the previous page while the next one loads (no layout jump).

export function useFabricList(filters: FabricFilters) {
  return useQuery({
    queryKey: fabricKeys.list(filters),
    queryFn: ({ signal }) => fabricApi.list(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useFabricOptions({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: fabricKeys.options(), queryFn: ({ signal }) => fabricApi.options(signal), enabled });
}

export function useFabric(id: string | undefined) {
  return useQuery({
    queryKey: fabricKeys.detail(id ?? ""),
    queryFn: ({ signal }) => fabricApi.get(id!, signal),
    enabled: Boolean(id),
  });
}

export function useInwards(filters: InwardFilters) {
  return useQuery({
    queryKey: fabricKeys.inwards(filters),
    queryFn: ({ signal }) => fabricApi.inwards(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: fabricKeys.suppliers(),
    queryFn: ({ signal }) => fabricApi.suppliers(signal),
    staleTime: 5 * 60_000,
  });
}

export function useMovements(filters: MovementFilters) {
  return useQuery({
    queryKey: fabricKeys.movements(filters),
    queryFn: ({ signal }) => fabricApi.movements(filters, signal),
    placeholderData: keepPreviousData,
  });
}

/** Any fabric write can move stock, so every fabric query is refreshed afterwards. */
function useFabricMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: fabricKeys.all }),
  });
}

export const useCreateFabric = () => useFabricMutation(fabricApi.create);
export const useUpdateFabric = () => useFabricMutation(fabricApi.update);
export const useAdjustStock = () => useFabricMutation(fabricApi.adjust);
export const useCreateInward = () => useFabricMutation(fabricApi.createInward);
export const useReverseInward = () => useFabricMutation(fabricApi.reverseInward);
