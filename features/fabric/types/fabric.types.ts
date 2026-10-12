export type FabricUnit = "KG" | "METER";
export type MovementType = "PURCHASE_IN" | "PURCHASE_REVERSAL" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";

export interface Fabric {
  id: string;
  code: string;
  name: string;
  unit: FabricUnit;
  category: string | null;
  lowStockThreshold: number | null;
  description: string | null;
  isActive: boolean;
  balance: number;
  avgRate: number | null;
  stockValue: number;
  movementCount: number;
  createdAt: string;
}

/** Lightweight row for pickers (GET /fabrics/options). */
export interface FabricOption {
  id: string;
  code: string;
  name: string;
  unit: FabricUnit;
  isActive: boolean;
  balance: number;
}

/** Query params for the list endpoint: search, column filters (see components/data-table), page. */
export type FabricFilters = Record<string, string | number | undefined>;

export interface FabricPage {
  fabrics: Fabric[];
  total: number;
  summary: { stockValue: number; active: number; inStock: number; reorder: number; inactive: number };
}

export interface FabricInput {
  code: string;
  name: string;
  unit: FabricUnit;
  category: string | null;
  lowStockThreshold: number | null;
  description: string | null;
}

interface FabricRef {
  id: string;
  code: string;
  name: string;
  unit: FabricUnit;
}

export interface Inward {
  id: string;
  number: number;
  fabric: FabricRef;
  inwardDate: string;
  quantity: number;
  rate: number;
  amount: number;
  supplier: string | null;
  invoiceRef: string | null;
  color: string | null;
  rollRef: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  reversal: { at: string; by: string | null; reason: string } | null;
}

export interface InwardInput {
  fabricId: string;
  inwardDate: string;
  quantity: number;
  rate: number;
  supplier: string | null;
  invoiceRef: string | null;
  color: string | null;
  rollRef: string | null;
  notes: string | null;
}

/** Query params for the list endpoint: search, column filters (see components/data-table), page. */
export type InwardFilters = Record<string, string | number | undefined>;

export interface InwardPage {
  inwards: Inward[];
  total: number;
  totalAmount: number;
  totalQuantity: Partial<Record<FabricUnit, number>>;
}

export interface Movement {
  id: string;
  fabric: FabricRef;
  date: string;
  type: MovementType;
  qtyIn: number;
  qtyOut: number;
  balance: number;
  color: string | null;
  rollRef: string | null;
  reason: string | null;
  inward: { id: string; number: number; invoiceRef: string | null; supplier: string | null } | null;
  createdBy: string | null;
  createdAt: string;
}

/** Query params for the list endpoint: search, column filters (see components/data-table), page. */
export type MovementFilters = Record<string, string | number | undefined>;

export interface MovementPage {
  movements: Movement[];
  total: number;
  summary: { opening: number; totalIn: number; totalOut: number; closing: number } | null;
}

export interface AdjustmentInput {
  direction: "IN" | "OUT";
  quantity: number;
  reason: string;
}
