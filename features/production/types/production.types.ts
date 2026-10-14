// Mirrors the production API (md_backend/src/modules/{cutting,articles,karigars}).
// Weights travel as exact decimal strings in kg; money and counts as numbers or strings as the API sends them.

export type LotStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export type BatchStatus = "DRAFT" | "ISSUED" | "FINALIZED" | "REVERSED";

export type RollStatus = BatchStatus;

export type WeightSource = "MEASURED" | "CALCULATED";

export type KarigarCategory = "CUTTING_MASTER" | "TAILOR" | "HELPER" | "OTHER";

export type PayMode = "PER_PIECE" | "PER_PALA" | "PER_KG" | "FIXED_JOB" | "SALARY";

export type ListFilters = Record<string, string | number | undefined>;

export interface MarkerSettings {
  widthM: string | null;
  lengthM: string | null;
  gsm: string | null;
  measuredPalaKg: string | null;
  weightSource: WeightSource;
  repetitionsPerLayer: number;
}

export interface SizeRatio {
  label: string;
  piecesPerPala: number;
  pieceWeightG: string | null;
}

export interface MarkerDefaults extends MarkerSettings {
  sizes: SizeRatio[];
}

export interface Article {
  id: string;
  code: string;
  name: string;
  active: boolean;
  defaultFabric: { id: string; code: string; name: string; unit: string } | null;
  defaultMarker: MarkerDefaults | null;
  lots: number;
  createdAt: string;
}

export interface ArticleInput {
  name: string;
  code: string | null;
  defaultFabricId: string | null;
  defaultMarker: MarkerDefaults | null;
  active: boolean;
}

export interface SizeTemplate {
  id: string;
  name: string;
  sizes: string[];
}

export interface Karigar {
  id: string;
  number: number;
  name: string;
  phone: string | null;
  category: KarigarCategory;
  payMode: PayMode;
  payRate: number | null;
  earned: number | null;
  active: boolean;
  notes: string | null;
  createdAt: string;
}

export interface KarigarInput {
  name: string;
  phone: string | null;
  category: KarigarCategory;
  payMode: PayMode;
  payRate: number;
  active: boolean;
  notes: string | null;
}

export interface KarigarOption {
  id: string;
  number: number;
  name: string;
  category: KarigarCategory;
  payMode: PayMode;
}

export interface LotListItem {
  id: string;
  lotNumber: string;
  productionDate: string;
  status: LotStatus;
  article: { code: string; name: string };
  fabric: { id: string; code: string; name: string };
  targetQuantity: number | null;
  cutPieces: number;
  batches: number;
  openBatches: number;
}

export interface ProductionSummary {
  lots: Partial<Record<LotStatus, number>>;
  piecesThisMonth: number;
  wastageKgThisMonth: string;
  consumedKgThisMonth: string;
  inCuttingKg: string;
  openBatches: number;
}

export interface LotPage {
  lots: LotListItem[];
  total: number;
  summary: ProductionSummary;
}

export interface BatchListItem {
  id: string;
  number: number;
  cuttingDate: string;
  status: BatchStatus;
  lot: { id: string; lotNumber: string; articleName: string; fabricName: string };
  cuttingMaster: string | null;
  pala: number | null;
  acceptedPieces: number | null;
  issuedKg: string;
  wastageKg: string | null;
}

export interface BatchPage {
  batches: BatchListItem[];
  total: number;
}

export type CuttingState = "STORE" | "CUTTING" | "CONSUMED" | "WASTAGE";

export interface CuttingMovement {
  id: string;
  date: string;
  type: "ISSUE" | "RETURN" | "CONSUME" | "WASTAGE";
  fromState: CuttingState;
  toState: CuttingState;
  quantityKg: string;
  colour: string;
  thaan: string;
  batchId: string;
  batchNumber: number;
  wastageType: string | null;
  reversal: boolean;
  reason: string | null;
  by: string | null;
  at: string;
}

export interface LotCostEntry {
  id: string;
  kind: "FABRIC_CONSUMED" | "FABRIC_WASTAGE" | "CUTTING_LABOUR";
  batchNumber: number;
  date: string;
  quantity: string;
  rate: string;
  amount: string;
  reversal: boolean;
}

export interface LotDetail {
  id: string;
  lotNumber: string;
  status: LotStatus;
  productionDate: string;
  targetQuantity: number | null;
  notes: string | null;
  article: { id: string; code: string; name: string };
  fabric: { id: string; code: string; name: string; unit: string; balanceKg: string };
  createdBy: string | null;
  createdAt: string;
  batches: BatchListItem[];
  output: {
    rows: { colour: string; size: string; planned: number; rejected: number; accepted: number; available: number }[];
    planned: number;
    rejected: number;
    accepted: number;
    available: number;
  };
  inCuttingKg: string;
  costs: { entries: LotCostEntry[]; total: string; perPiece: string | null } | null;
  history: CuttingMovement[];
}

export interface BatchRoll {
  id: string;
  thaan: string;
  issuedKg: string;
  returnedKg: string;
  confirmedLayers: number | null;
  status: RollStatus;
  estimatedPala: number | null;
  confirmedPala: number | null;
  consumedKg: string | null;
  wastageKg: string | null;
}

export interface Reject {
  sizeLabel: string;
  quantity: number;
  reason: string;
}

export interface Batch {
  id: string;
  number: number;
  status: BatchStatus;
  cuttingDate: string;
  notes: string | null;
  lot: {
    id: string;
    lotNumber: string;
    status: LotStatus;
    targetQuantity: number | null;
    article: { id: string; code: string; name: string };
    fabric: { id: string; code: string; name: string; unit: string };
  };
  cuttingMaster: { id: string; name: string; payMode: PayMode } | null;
  marker: MarkerSettings & { calculatedPalaKg: string | null; activePalaKg: string | null };
  sizes: SizeRatio[];
  colours: { id: string; name: string; rolls: BatchRoll[]; rejects: Reject[] }[];
  posted: {
    calculationVersion: number;
    issuedKg: string;
    returnedKg: string;
    consumedKg: string;
    wastageKg: string;
    pala: number;
    plannedPieces: number;
    acceptedPieces: number;
    finalizedAt: string;
    finalizedBy: string | null;
  } | null;
  costs: { fabricCost: string | null; earningAmount: string | null } | null;
  outputs: {
    colourName: string;
    sizeLabel: string;
    planned: number;
    rejected: number;
    accepted: number;
    available: number;
    rejectReason: string | null;
  }[];
  reversal: { at: string; by: string | null; reason: string } | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body of a cutting draft save (PUT /cutting-batches/:id and friends). */
export interface CuttingDraftInput {
  cuttingMasterId: string | null;
  cuttingDate: string;
  notes: string | null;
  marker: MarkerSettings;
  sizes: SizeRatio[];
  colours: {
    id?: string;
    name: string;
    rolls: { id?: string; thaan: string; issuedKg: string; returnedKg: string; confirmedLayers: number | null }[];
    rejects: Reject[];
  }[];
  saveAsDefault: boolean;
}

export interface CreateLotInput {
  lotNumber: string;
  article: { id: string } | { name: string; code: string | null };
  fabricId: string;
  productionDate: string;
  targetQuantity: number | null;
  notes: string | null;
  cutting?: CuttingDraftInput;
}

export interface UpdateLotInput {
  fabricId?: string;
  productionDate?: string;
  targetQuantity?: number | null;
  notes?: string | null;
  status?: "ACTIVE" | "COMPLETED" | "CANCELLED";
}
