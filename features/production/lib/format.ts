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
import { formatKg, parseKg } from "./cutting-calc";

export const cutNumber = (number: number) => `CUT-${String(number).padStart(4, "0")}`;

const grouped = new Intl.NumberFormat("en-IN");

/** Exact decimal kg text from the API → "29.820 kg" (3 decimals, rounded half up, grouped). */
export function kgText(value: string | null | undefined): string {
  if (value === null || value === undefined) return "—";

  const micro = parseKg(value.replace(/^-/, ""));

  if (micro === null) return `${value} kg`;

  const [whole = "0", fraction = "000"] = formatKg(micro).split(".");
  const sign = value.startsWith("-") && micro > 0n ? "−" : "";

  return `${sign}${grouped.format(BigInt(whole))}.${fraction} kg`;
}

/** Micro-kilograms from the calculator → "29.820 kg". */
export function microKgText(micro: bigint): string {
  return kgText(micro < 0n ? `-${formatKg(-micro, 6)}` : formatKg(micro, 6));
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
  OTHER: "Other",
};

export const PAY_MODE_LABEL: Record<PayMode, string> = {
  PER_PIECE: "Per accepted piece",
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
