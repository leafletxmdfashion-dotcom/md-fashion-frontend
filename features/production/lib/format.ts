import type { StatusTone } from "@/components/status-chip";

import type {
  BatchStatus,
  CuttingMovement,
  CuttingState,
  KarigarCategory,
  LotCostEntry,
  LotStatus,
  PayMode,
} from "../types/production.types";
import { formatKg, parseKg, parseScaled, toDecimal } from "./cutting-calc";

export const cutNumber = (number: number) => `CUT-${String(number).padStart(4, "0")}`;

/** Karigar code, so two people with the same name can be told apart in pickers. */
export const karigarCode = (number: number) => `K-${String(number).padStart(3, "0")}`;

const grouped = new Intl.NumberFormat("en-IN");

/** A fabric's unit: cutting quantities are in kg, or in metres for fabric bought by the metre. */
export type QtyUnit = "KG" | "METER";

export const unitShort = (unit: string | null | undefined) => (unit === "METER" ? "m" : "kg");

/** Exact decimal text from the API → "29.820 kg" or "29.820 m" (3 decimals, rounded half up, grouped). */
export function kgText(value: string | null | undefined, unit: string = "KG"): string {
  if (value === null || value === undefined) return "—";

  const micro = parseKg(value.replace(/^-/, ""));

  if (micro === null) return `${value} ${unitShort(unit)}`;

  const [whole = "0", fraction = "000"] = formatKg(micro).split(".");
  const sign = value.startsWith("-") && micro > 0n ? "−" : "";

  return `${sign}${grouped.format(BigInt(whole))}.${fraction} ${unitShort(unit)}`;
}

/** Micro-units from the calculator → "29.820 kg" / "29.820 m". */
export function microKgText(micro: bigint, unit: string = "KG"): string {
  return kgText(micro < 0n ? `-${formatKg(-micro, 6)}` : formatKg(micro, 6), unit);
}

/** Kilograms, plus metres when any metre fabric is involved: "12.000 kg · 30.000 m". Never added together. */
export function bothUnits(kg: string, metres: string): string {
  const hasMetres = metres.replace(/[0.-]/g, "") !== "";

  return hasMetres ? `${kgText(kg)} · ${kgText(metres, "METER")}` : kgText(kg);
}

/** Stored metres shown in the unit they were typed in: "58 in" or "1.5 m". */
export function lengthText(metres: string | null, unit: "M" | "IN" | undefined): string {
  if (metres === null) return "—";

  return unit === "IN" ? `${metresToInches(metres) ?? metres} in` : `${trimZeros(metres)} m`;
}

/** Strips trailing zeros of an exact decimal: "1.473200" → "1.4732", "58.00" → "58". */
const trimZeros = (text: string) => (text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text);

/** Inches (up to 2 decimals) → exact metres text (1 in = 0.0254 m), or null if not a number. */
export function inchesToMetres(inches: string): string | null {
  const hundredths = parseScaled(inches, 2);

  // Hundredths of an inch × 254 = micrometres.
  return hundredths === null ? null : trimZeros(toDecimal(hundredths * 254n, 6));
}

/** Metres → inches to 2 decimals, rounded half up (exact for values that came from inches). */
export function metresToInches(metres: string): string | null {
  const micro = parseScaled(metres, 6);

  return micro === null ? null : trimZeros(toDecimal((micro * 2n + 254n) / 508n, 2));
}

export function moneyText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";

  return `Rs ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))}`;
}

export const LOT_STATUS: Record<LotStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  ACTIVE: { label: "Active", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

export const BATCH_STATUS: Record<BatchStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  ISSUED: { label: "Fabric issued", tone: "warning" },
  FINALIZED: { label: "Finalized", tone: "success" },
  REVERSED: { label: "Reversed", tone: "danger" },
};

export const CATEGORY_LABEL: Record<KarigarCategory, string> = {
  CUTTING_MASTER: "Cutting master",
  TAILOR: "Tailor",
  HELPER: "Helper",
  PACKER: "Packer",
  STAFF: "Staff",
  OTHER: "Other",
};

export const PAY_MODE_LABEL: Record<PayMode, string> = {
  PER_PIECE: "Per piece",
  PER_PALA: "Per Pala",
  PER_KG: "Per kg cut",
  FIXED_JOB: "Fixed per job",
  SALARY: "Daily / salary",
};

/** Unit the pay rate is quoted in, e.g. "Rs 2.50 / piece". */
export const PAY_UNIT: Record<PayMode, string | null> = {
  PER_PIECE: "piece",
  PER_PALA: "Pala",
  PER_KG: "kg",
  FIXED_JOB: "job",
  SALARY: null,
};

export const STATE_LABEL: Record<CuttingState, string> = {
  STORE: "Fabric store",
  CUTTING: "In cutting",
  CONSUMED: "Consumed",
  WASTAGE: "Wastage",
};

export const MOVEMENT_TYPE_LABEL: Record<CuttingMovement["type"], string> = {
  ISSUE: "Issued",
  RETURN: "Returned",
  CONSUME: "Consumed",
  WASTAGE: "Wastage",
};

export const COST_KIND_LABEL: Record<LotCostEntry["kind"], string> = {
  FABRIC_CONSUMED: "Fabric consumed",
  FABRIC_WASTAGE: "Fabric wastage",
  CUTTING_LABOUR: "Cutting labour",
};
