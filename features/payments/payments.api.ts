"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { params, POSTING, useFlowMutation, type ListFilters } from "@/features/packing/packing.api";
import { api, unwrap, type ApiSuccess } from "@/lib/api-client";

// Mirrors md_backend/src/modules/payments. Amounts are signed decimal text:
// + the business owes the person, − the person owes the business.

export type EntryKind = "EARNING" | "PAYMENT" | "ADVANCE" | "EXPENSE" | "CREDIT" | "RECOVERY";

export type ManualType = Exclude<EntryKind, "EARNING">;

export interface Totals {
  earned: string;
  paid: string;
  advances: string;
  expenses: string;
  credits: string;
  recovered: string;
  balance: string;
  lastDate: string | null;
}

export interface PersonRow extends Totals {
  id: string;
  number: number;
  name: string;
  phone: string | null;
  category: string;
  active: boolean;
}

export interface PeoplePage {
  people: PersonRow[];
  total: number;
  summary: {
    people: number;
    payable: string;
    receivable: string;
    earnedThisMonth: string;
    paidThisMonth: string;
    expensesThisMonth: string;
    advancesThisMonth: string;
  };
}

export interface PersonAccount {
  person: { id: string; number: number; name: string; phone: string | null; category: string; active: boolean } | null;
  summary: Totals | null;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: string;
  kind: EntryKind;
  label: string;
  amount: string;
  balance: string;
  description: string;
  method: "CASH" | "BANK" | "WALLET" | null;
  category: string | null;
  reference: string | null;
  sourceType: string;
  reversible: boolean;
  reversed: boolean;
  karigar: { id: string; number: number; name: string };
  createdBy: string;
  createdAt: string;
}

export interface LedgerPage {
  entries: LedgerEntry[];
  total: number;
  summary: { credit: string; debit: string; net: string };
}

export interface EntryInput {
  karigarId: string;
  type: ManualType;
  amount: number;
  entryDate: string;
  method: "CASH" | "BANK" | "WALLET" | null;
  category: string | null;
  reference: string | null;
  note: string | null;
}

/** What each manual entry means and which way it moves the balance. */
export const ENTRY_TYPES: Record<ManualType, { label: string; hint: string; sign: 1 | -1; categories: string[] }> = {
  PAYMENT: {
    label: "Payment",
    hint: "Wages or salary paid to them",
    sign: -1,
    categories: ["Wages", "Salary", "Weekly payment", "Settlement"],
  },
  ADVANCE: {
    label: "Advance / loan",
    hint: "Money lent, to be cut from pay or returned",
    sign: -1,
    categories: ["Festival", "Wedding", "Medical", "Family need", "Loan"],
  },
  EXPENSE: {
    label: "Expense",
    hint: "Spent on them: food, tea, travel, occasion",
    sign: -1,
    categories: ["Food", "Tea & snacks", "Travel", "Medical", "Occasion", "Room rent"],
  },
  CREDIT: {
    label: "Credit",
    hint: "Owed to them: salary, bonus, overtime",
    sign: 1,
    categories: ["Salary", "Bonus", "Overtime", "Allowance", "Festival bonus"],
  },
  RECOVERY: {
    label: "Money received back",
    hint: "They returned an advance or paid back",
    sign: 1,
    categories: ["Advance returned", "Loan returned", "Deduction"],
  },
};

export const KIND_LABEL: Record<EntryKind, string> = {
  EARNING: "Earning",
  PAYMENT: "Payment",
  ADVANCE: "Advance / loan",
  EXPENSE: "Expense",
  CREDIT: "Credit",
  RECOVERY: "Received back",
};

export const METHOD_LABEL = { CASH: "Cash", BANK: "Bank", WALLET: "eSewa / wallet" } as const;

function listQuery<T>(key: readonly unknown[], url: string, filters: ListFilters, enabled = true) {
  return {
    queryKey: key,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      unwrap(api.get<ApiSuccess<T>>(url, { params: params(filters), signal })),
    placeholderData: keepPreviousData,
    enabled,
  };
}

export const usePeople = (filters: ListFilters, enabled = true) =>
  useQuery(listQuery<PeoplePage>(["payments", "people", filters], "/payments/people", filters, enabled));

export const usePersonAccount = (id: string | undefined) =>
  useQuery({
    queryKey: ["payments", "person", id ?? ""],
    queryFn: ({ signal }) => unwrap(api.get<ApiSuccess<PersonAccount>>(`/payments/people/${id}`, { signal })),
    enabled: Boolean(id),
  });

export const useLedger = (filters: ListFilters) =>
  useQuery(listQuery<LedgerPage>(["payments", "ledger", filters], "/payments/ledger", filters));

export const useMyAccount = () =>
  useQuery({
    queryKey: ["payments", "me"],
    queryFn: ({ signal }) => unwrap(api.get<ApiSuccess<PersonAccount>>("/payments/me", { signal })),
  });

export const useMyLedger = (filters: ListFilters, enabled = true) =>
  useQuery(listQuery<LedgerPage>(["payments", "me", "ledger", filters], "/payments/me/ledger", filters, enabled));

export const useRecordEntry = () =>
  useFlowMutation(
    async (input: EntryInput) =>
      (await unwrap(api.post<ApiSuccess<{ entry: { id: string } }>>("/payments/entries", input, POSTING))).entry,
  );

export const useReverseEntry = () =>
  useFlowMutation(
    async ({ id, reason }: { id: string; reason: string }) =>
      (
        await unwrap(
          api.post<ApiSuccess<{ entry: { id: string } }>>(`/payments/entries/${id}/reverse`, { reason }, POSTING),
        )
      ).entry,
  );
