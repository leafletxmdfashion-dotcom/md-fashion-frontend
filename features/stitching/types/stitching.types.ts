import type { KarigarCategory } from "@/features/production/types/production.types";

export type ListFilters = Record<string, string | number | undefined>;

export type SplitMethod = "EQUAL" | "PERCENT" | "AMOUNT";

export type ReworkStatus = "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface TeamMember {
  karigarId: string;
  name: string;
  category: KarigarCategory;
  active: boolean;
  /** Null for every member: earnings split equally. */
  sharePercent: number | null;
  joinedAt: string;
}

export interface JogadiTeam {
  id: string;
  code: string;
  name: string;
  active: boolean;
  notes: string | null;
  members: TeamMember[];
  /** Pieces issued to the team and not yet received back. */
  piecesHeld: number;
}

export interface TeamInput {
  name: string;
  active: boolean;
  notes: string | null;
  members: { karigarId: string; sharePercent: number | null }[];
}

export interface AvailableLot {
  id: string;
  lotNumber: string;
  articleName: string;
  available: number;
}

export interface BalanceRow {
  colour: string;
  size: string;
  cut: number;
  unissued: number;
  issued: number;
  received: number;
  wip: number;
  good: number;
  rework: number;
  reject: number;
}

export interface LotBalance {
  lot: { id: string; lotNumber: string; articleName: string; status: string };
  rows: BalanceRow[];
  totals: Omit<BalanceRow, "colour" | "size">;
}

export interface IssueListItem {
  id: string;
  number: number;
  date: string;
  status: "POSTED" | "REVERSED";
  operation: string;
  /** Null without permission to see money. */
  rate: string | null;
  team: { id: string; name: string };
  lot: { id: string; lotNumber: string; articleName: string };
  issued: number;
  received: number;
  wip: number;
}

export interface IssuePage {
  issues: IssueListItem[];
  total: number;
  summary: { wip: number; open: number };
}

export interface Reversal {
  at: string;
  by: string | null;
  reason: string | null;
}

export interface IssueLine {
  id: string;
  colour: string;
  sizeLabel: string;
  quantity: number;
  received: number;
  outstanding: number;
}

export interface Receipt {
  id: string;
  number: number;
  status: "POSTED" | "REVERSED";
  date: string;
  splitMethod: SplitMethod;
  good: number;
  earning: string | null;
  notes: string | null;
  lines: {
    colour: string;
    sizeLabel: string;
    received: number;
    good: number;
    rework: number;
    reject: number;
    rejectReason: string | null;
  }[];
  allocations: { karigarId: string; amount: string }[] | null;
  createdBy: string;
  createdAt: string;
  reversal: Reversal | null;
}

export interface IssueDetail {
  id: string;
  number: number;
  status: "POSTED" | "REVERSED";
  date: string;
  operation: string;
  rate: string | null;
  splitMethod: "EQUAL" | "PERCENT";
  notes: string | null;
  lot: { id: string; lotNumber: string; articleName: string; status: string };
  team: { id: string; name: string };
  members: { karigarId: string; name: string; sharePercent: number | null }[];
  lines: IssueLine[];
  receipts: Receipt[];
  createdBy: string;
  createdAt: string;
  reversal: Reversal | null;
}

/** One lot's pieces for one kind of work at one rate, to one team or divided between several. */
export interface IssueInput {
  lotId: string;
  operation: string;
  rate: number;
  issueDate: string;
  notes: string | null;
  teams: { teamId: string; lines: { colour: string; sizeLabel: string; quantity: number }[] }[];
}

export interface ReceiptInput {
  receiptDate: string;
  notes: string | null;
  lines: { issueLineId: string; good: number; rework: number; reject: number; rejectReason: string | null }[];
  split?: { method: SplitMethod; members: { karigarId: string; percent?: number | null; amount?: number | null }[] };
}

export interface ReworkItem {
  id: string;
  number: number;
  status: ReworkStatus;
  colour: string;
  sizeLabel: string;
  quantity: number;
  recovered: number;
  failed: number;
  pending: number;
  createdAt: string;
  lot: { id: string; lotNumber: string; articleName: string };
  issue: { id: string; number: number; teamName: string };
  receiptNumber: number;
  assignedTo: { id: string; name: string } | null;
}

export interface ReworkPage {
  items: ReworkItem[];
  total: number;
  pending: number;
}

export interface RejectRow {
  id: string;
  date: string;
  source: "RECEIPT" | "REWORK";
  reference: string;
  lot: { id: string; lotNumber: string; articleName: string };
  teamName: string;
  colour: string;
  sizeLabel: string;
  quantity: number;
  reason: string;
}

export interface RejectPage {
  rejects: RejectRow[];
  total: number;
  pieces: number;
}
