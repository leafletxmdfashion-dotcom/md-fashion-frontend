import { api, unwrap, type ApiSuccess } from "@/lib/api-client";

import type {
  AvailableLot,
  IssueDetail,
  IssueInput,
  IssuePage,
  JogadiTeam,
  ListFilters,
  LotBalance,
  ReceiptInput,
  RejectPage,
  ReworkPage,
  TeamInput,
} from "../types/stitching.types";

export const stitchingKeys = {
  all: ["stitching"] as const,
  teams: (activeOnly: boolean) => [...stitchingKeys.all, "teams", activeOnly] as const,
  lots: (search: string) => [...stitchingKeys.all, "lots", search] as const,
  balance: (lotId: string) => [...stitchingKeys.all, "balance", lotId] as const,
  issues: (filters: ListFilters) => [...stitchingKeys.all, "issues", filters] as const,
  issue: (id: string) => [...stitchingKeys.all, "issue", id] as const,
  rework: (filters: ListFilters) => [...stitchingKeys.all, "rework", filters] as const,
  rejects: (filters: ListFilters) => [...stitchingKeys.all, "rejects", filters] as const,
  rejectReasons: () => [...stitchingKeys.all, "reject-reasons"] as const,
};

/** Drops empty filters so they never reach the query string. */
function params(filters: ListFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""));
}

// Postings touch stock, earnings and cost in one transaction; allow for a far-away database.
const POSTING = { timeout: 60_000 };

export const stitchingApi = {
  async teams(activeOnly: boolean, signal?: AbortSignal): Promise<JogadiTeam[]> {
    const query = activeOnly ? { active: "true" } : {};

    return (await unwrap(api.get<ApiSuccess<{ teams: JogadiTeam[] }>>("/jogadi", { params: query, signal }))).teams;
  },

  async createTeam(input: TeamInput): Promise<JogadiTeam> {
    return (await unwrap(api.post<ApiSuccess<{ team: JogadiTeam }>>("/jogadi", input))).team;
  },

  async updateTeam({ id, ...input }: TeamInput & { id: string }): Promise<JogadiTeam> {
    return (await unwrap(api.put<ApiSuccess<{ team: JogadiTeam }>>(`/jogadi/${id}`, input))).team;
  },

  async lots(search: string, signal?: AbortSignal): Promise<AvailableLot[]> {
    return (
      await unwrap(
        api.get<ApiSuccess<{ lots: AvailableLot[] }>>("/stitching/lots", { params: params({ search }), signal }),
      )
    ).lots;
  },

  balance(lotId: string, signal?: AbortSignal): Promise<LotBalance> {
    return unwrap(api.get<ApiSuccess<LotBalance>>(`/stitching/lots/${lotId}/balance`, { signal }));
  },

  issues(filters: ListFilters, signal?: AbortSignal): Promise<IssuePage> {
    return unwrap(api.get<ApiSuccess<IssuePage>>("/stitching/issues", { params: params(filters), signal }));
  },

  async issue(id: string, signal?: AbortSignal): Promise<IssueDetail> {
    return (await unwrap(api.get<ApiSuccess<{ issue: IssueDetail }>>(`/stitching/issues/${id}`, { signal }))).issue;
  },

  /** One issue per team, posted together. */
  async createIssue(input: IssueInput): Promise<IssueDetail[]> {
    return (await unwrap(api.post<ApiSuccess<{ issues: IssueDetail[] }>>("/stitching/issues", input, POSTING))).issues;
  },

  async reverseIssue({ id, reason }: { id: string; reason: string }): Promise<IssueDetail> {
    return (
      await unwrap(api.post<ApiSuccess<{ issue: IssueDetail }>>(`/stitching/issues/${id}/reverse`, { reason }, POSTING))
    ).issue;
  },

  async receive({ issueId, ...input }: ReceiptInput & { issueId: string }): Promise<IssueDetail> {
    return (
      await unwrap(
        api.post<ApiSuccess<{ issue: IssueDetail }>>(`/stitching/issues/${issueId}/receipts`, input, POSTING),
      )
    ).issue;
  },

  async reverseReceipt({ id, reason }: { id: string; reason: string }): Promise<IssueDetail> {
    return (
      await unwrap(
        api.post<ApiSuccess<{ issue: IssueDetail }>>(`/stitching/receipts/${id}/reverse`, { reason }, POSTING),
      )
    ).issue;
  },

  rework(filters: ListFilters, signal?: AbortSignal): Promise<ReworkPage> {
    return unwrap(api.get<ApiSuccess<ReworkPage>>("/stitching/rework", { params: params(filters), signal }));
  },

  async updateRework({
    id,
    ...input
  }: {
    id: string;
    status: "ASSIGNED" | "IN_PROGRESS";
    assignedToId: string | null;
  }) {
    await api.put(`/stitching/rework/${id}`, input);
  },

  async resolveRework({
    id,
    ...input
  }: {
    id: string;
    resolvedOn: string;
    recovered: number;
    failed: number;
    failedReason: string | null;
  }) {
    await api.post(`/stitching/rework/${id}/resolve`, input, POSTING);
  },

  rejects(filters: ListFilters, signal?: AbortSignal): Promise<RejectPage> {
    return unwrap(api.get<ApiSuccess<RejectPage>>("/stitching/rejects", { params: params(filters), signal }));
  },

  async rejectReasons(signal?: AbortSignal): Promise<string[]> {
    return (await unwrap(api.get<ApiSuccess<{ reasons: string[] }>>("/stitching/reject-reasons", { signal }))).reasons;
  },
};
