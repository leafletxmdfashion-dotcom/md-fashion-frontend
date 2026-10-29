import type { StatusTone } from "@/components/status-chip";

import type { ReworkStatus } from "../types/stitching.types";

export const issueNumber = (number: number) => `SI-${String(number).padStart(4, "0")}`;

export const receiptNumber = (number: number) => `SR-${String(number).padStart(4, "0")}`;

export const reworkNumber = (number: number) => `RW-${String(number).padStart(4, "0")}`;

export const pieces = (count: number) => `${count.toLocaleString("en-IN")} pc${count === 1 ? "" : "s"}`;

export const REWORK_STATUS: Record<ReworkStatus, { label: string; tone: StatusTone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  ASSIGNED: { label: "Assigned", tone: "info" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

/** Rupees with 2 decimals → paisa, exactly. Null for anything that is not such a number. */
export function toPaisa(text: string): number | null {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(text.trim());

  return match ? Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0")) : null;
}

/**
 * The same split the API makes: equal or by share (hundredths of a percent), in
 * paisa, leftover paisa to members in order. For the receipt preview only.
 */
export function previewSplit(totalPaisa: number, weights: number[]): number[] {
  const sum = weights.reduce((total, weight) => total + weight, 0);

  if (sum === 0) return weights.map(() => 0);

  const amounts = weights.map((weight) => Math.floor((totalPaisa * weight) / sum));
  let left = totalPaisa - amounts.reduce((total, amount) => total + amount, 0);

  for (let index = 0; left > 0; index = (index + 1) % weights.length) {
    if (weights[index] === 0) continue;

    amounts[index]! += 1;
    left -= 1;
  }

  return amounts;
}
