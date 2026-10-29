import { format } from "date-fns";

import type { Fabric, FabricUnit, MovementType } from "../types/fabric.types";

// ponytail: currency is fixed until the Settings module stores it.
const CURRENCY = "Rs";

const money = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });

export const UNIT_LABEL: Record<FabricUnit, string> = { KG: "kg", METER: "m" };
export const UNIT_NAME: Record<FabricUnit, string> = { KG: "Kilogram", METER: "Meter" };

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  PURCHASE_IN: "Purchase",
  PURCHASE_REVERSAL: "Purchase reversed",
  ADJUSTMENT_IN: "Adjustment +",
  ADJUSTMENT_OUT: "Adjustment −",
  CUTTING_ISSUE: "Issued to cutting",
  CUTTING_RETURN: "Returned from cutting",
};

export function formatMoney(value: number): string {
  // Round to the paisa first so -0 and tiny negatives never show as "Rs -0.00".
  const paisa = Math.round(value * 100) / 100;
  return `${CURRENCY} ${money.format(paisa === 0 ? 0 : paisa)}`;
}

/** Edit distance (insert, delete, change one letter) between two short strings. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length]!;
}

/**
 * An existing name one or two typos away from `typed` (case and spacing ignored), so a
 * purchase can ask "did you mean …?" before creating a near-duplicate fabric.
 */
export function closeName(typed: string, names: string[]): string | undefined {
  const key = typed.trim().replace(/\s+/g, " ").toLowerCase();
  if (key.length < 5) return undefined;
  let best: { name: string; distance: number } | undefined;
  for (const name of names) {
    const distance = editDistance(key, name.toLowerCase());
    if (distance > 0 && distance <= 2 && (!best || distance < best.distance)) best = { name, distance };
  }
  return best?.name;
}

/** True when `value` has at most `places` decimals, allowing for float noise (0.1 + 0.2). */
export function hasPlaces(value: number, places: number): boolean {
  const scaled = value * 10 ** places;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/** Quantity (3 decimals) × rate (2 decimals), rounded half up to the paisa, as the database stores the amount. */
export function amountOf(quantity: number, rate: number): number {
  const units = BigInt(Math.round(quantity * 1000)) * BigInt(Math.round(rate * 100));
  const negative = units < 0n;
  const paisa = ((negative ? -units : units) + 500n) / 1000n;
  return Number(negative ? -paisa : paisa) / 100;
}

export function formatNumber(value: number): string {
  return quantity.format(value);
}

export function formatQty(value: number, unit: FabricUnit): string {
  return `${quantity.format(value)} ${UNIT_LABEL[unit]}`;
}

/** 'YYYY-MM-DD' business date → "12 Oct 2026", without a timezone shift. */
export function formatDate(value: string): string {
  return format(new Date(`${value}T00:00:00`), "d MMM yyyy");
}

/** Today (YYYY-MM-DD) at the factory, as the API counts it, whatever the device's timezone. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(now);
}

export function inwardNumber(number: number): string {
  return `FI-${String(number).padStart(4, "0")}`;
}

export type StockState = "out" | "low" | "ok";

export function stockState(fabric: Pick<Fabric, "balance" | "lowStockThreshold">): StockState {
  if (fabric.balance <= 0) return "out";
  if (fabric.lowStockThreshold !== null && fabric.balance <= fabric.lowStockThreshold) return "low";
  return "ok";
}
