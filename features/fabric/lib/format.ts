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
};

export function formatMoney(value: number): string {
  return `${CURRENCY} ${money.format(value)}`;
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

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
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
