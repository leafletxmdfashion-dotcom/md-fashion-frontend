"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { productionKeys } from "@/features/production/api/production.api";

import { stitchingApi, stitchingKeys } from "../api/stitching.api";
import type { ListFilters } from "../types/stitching.types";

export function useTeams({ activeOnly = false, enabled = true }: { activeOnly?: boolean; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: stitchingKeys.teams(activeOnly),
    queryFn: ({ signal }) => stitchingApi.teams(activeOnly, signal),
    enabled,
  });
}

export function useAvailableLots(search: string, enabled = true) {
  return useQuery({
    queryKey: stitchingKeys.lots(search),
    queryFn: ({ signal }) => stitchingApi.lots(search, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useLotBalance(lotId: string | undefined) {
  return useQuery({
    queryKey: stitchingKeys.balance(lotId ?? ""),
    queryFn: ({ signal }) => stitchingApi.balance(lotId!, signal),
    enabled: Boolean(lotId),
  });
}

// Paged lists keep showing the previous page while the next one loads (no layout jump).
export function useIssues(filters: ListFilters) {
  return useQuery({
    queryKey: stitchingKeys.issues(filters),
    queryFn: ({ signal }) => stitchingApi.issues(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useIssue(id: string | undefined) {
  return useQuery({
    queryKey: stitchingKeys.issue(id ?? ""),
    queryFn: ({ signal }) => stitchingApi.issue(id!, signal),
    enabled: Boolean(id),
  });
}

export function useRework(filters: ListFilters) {
  return useQuery({
    queryKey: stitchingKeys.rework(filters),
    queryFn: ({ signal }) => stitchingApi.rework(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useRejects(filters: ListFilters, enabled = true) {
  return useQuery({
    queryKey: stitchingKeys.rejects(filters),
    queryFn: ({ signal }) => stitchingApi.rejects(filters, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRejectReasons() {
  return useQuery({
    queryKey: stitchingKeys.rejectReasons(),
    queryFn: ({ signal }) => stitchingApi.rejectReasons(signal),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * Stitching writes move pieces out of cutting and money into karigar ledgers, so
 * stitching, production (lot output, karigar earnings) queries refresh afterwards.
 */
function useStitchingMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: stitchingKeys.all }),
        queryClient.invalidateQueries({ queryKey: productionKeys.all }),
        // Good pieces wait for packing; earnings show in payments.
        queryClient.invalidateQueries({ queryKey: ["packing"] }),
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
      ]),
  });
}

export const useCreateTeam = () => useStitchingMutation(stitchingApi.createTeam);

export const useUpdateTeam = () => useStitchingMutation(stitchingApi.updateTeam);

export const useCreateIssue = () => useStitchingMutation(stitchingApi.createIssue);

export const useReverseIssue = () => useStitchingMutation(stitchingApi.reverseIssue);

export const useReceive = () => useStitchingMutation(stitchingApi.receive);

export const useReverseReceipt = () => useStitchingMutation(stitchingApi.reverseReceipt);

export const useUpdateRework = () => useStitchingMutation(stitchingApi.updateRework);

export const useResolveRework = () => useStitchingMutation(stitchingApi.resolveRework);
