import { todayISO } from "@/features/fabric/lib/format";

import type {
  Batch,
  CuttingDraftInput,
  MarkerDefaults,
  RollStatus,
  WeightSource,
} from "../types/production.types";
import type { ColourInput, MarkerInput } from "./cutting-calc";

// The production form keeps every input as text (what the operator typed), so the
// calculator and the API both read exactly what is on screen. Ids are named
// colourId / rollId because react-hook-form reserves `id` on field-array items.

export interface RollValues {
  rollId: string;
  status: RollStatus;
  thaan: string;
  issuedKg: string;
  returnedKg: string;
  /** Empty means "use the estimate". */
  confirmedLayers: string;
}

export interface ColourValues {
  colourId: string;
  name: string;
  rolls: RollValues[];
}

export interface SizeValues {
  label: string;
  piecesPerPala: string;
  pieceWeightG: string;
}

export interface MarkerValues {
  widthM: string;
  lengthM: string;
  gsm: string;
  measuredPalaKg: string;
  weightSource: WeightSource;
  repetitionsPerLayer: string;
}

export interface CuttingFormValues {
  /** Typed lot number; an open lot with this number takes the new cutting. */
  lotNumber: string;
  articleName: string;
  fabricId: string;
  targetQuantity: string;
  lotNotes: string;
  cuttingMasterId: string;
  cuttingDate: string;
  notes: string;
  marker: MarkerValues;
  sizes: SizeValues[];
  colours: ColourValues[];
  saveAsDefault: boolean;
}

const text = (value: string | number | null | undefined) => (value === null || value === undefined ? "" : String(value));

export const emptyRoll = (): RollValues => ({
  rollId: "",
  status: "DRAFT",
  thaan: "",
  issuedKg: "",
  returnedKg: "",
  confirmedLayers: "",
});

export const emptyColour = (): ColourValues => ({ colourId: "", name: "", rolls: [emptyRoll()] });

const DEFAULT_SIZES: SizeValues[] = ["S", "M", "L", "XL"].map((label) => ({ label, piecesPerPala: "1", pieceWeightG: "" }));

export function markerValuesOf(marker: Omit<MarkerDefaults, "sizes"> | null): MarkerValues {
  return {
    widthM: text(marker?.widthM),
    lengthM: text(marker?.lengthM),
    gsm: text(marker?.gsm),
    measuredPalaKg: text(marker?.measuredPalaKg),
    weightSource: marker?.weightSource ?? "MEASURED",
    repetitionsPerLayer: text(marker?.repetitionsPerLayer ?? 1),
  };
}

export function sizeValuesOf(sizes: MarkerDefaults["sizes"] | undefined): SizeValues[] {
  return sizes?.length
    ? sizes.map((size) => ({ label: size.label, piecesPerPala: String(size.piecesPerPala), pieceWeightG: text(size.pieceWeightG) }))
    : DEFAULT_SIZES;
}

export function newProductionValues(): CuttingFormValues {
  return {
    lotNumber: "",
    articleName: "",
    fabricId: "",
    targetQuantity: "",
    lotNotes: "",
    cuttingMasterId: "",
    cuttingDate: todayISO(),
    notes: "",
    marker: markerValuesOf(null),
    sizes: DEFAULT_SIZES,
    colours: [emptyColour()],
    saveAsDefault: false,
  };
}

export function batchValues(batch: Batch): CuttingFormValues {
  return {
    lotNumber: batch.lot.lotNumber,
    articleName: batch.lot.article.name,
    fabricId: batch.lot.fabric.id,
    targetQuantity: text(batch.lot.targetQuantity),
    lotNotes: "",
    cuttingMasterId: batch.cuttingMaster?.id ?? "",
    cuttingDate: batch.cuttingDate,
    notes: batch.notes ?? "",
    marker: markerValuesOf(batch.marker),
    sizes: sizeValuesOf(batch.sizes),
    colours: batch.colours.map((colour) => ({
      colourId: colour.id,
      name: colour.name,
      rolls: colour.rolls.map((roll) => ({
        rollId: roll.id,
        status: roll.status,
        thaan: roll.thaan,
        issuedKg: roll.issuedKg,
        returnedKg: roll.returnedKg === "0" ? "" : roll.returnedKg,
        confirmedLayers: text(roll.confirmedLayers),
      })),
    })),
    saveAsDefault: false,
  };
}

/** A whole number from an input, or NaN so the calculator flags it. */
const whole = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

const decimalOrNull = (value: string) => (value.trim() === "" ? null : value.trim());

export interface CalcInputs {
  marker: MarkerInput;
  colours: ColourInput[];
}

export function calcInputsOf(values: CuttingFormValues): CalcInputs {
  const calculated = values.marker.weightSource === "CALCULATED";

  return {
    marker: {
      widthM: decimalOrNull(values.marker.widthM),
      lengthM: decimalOrNull(values.marker.lengthM),
      gsm: calculated ? decimalOrNull(values.marker.gsm) : null,
      measuredPalaKg: decimalOrNull(values.marker.measuredPalaKg),
      weightSource: values.marker.weightSource,
      repetitionsPerLayer: whole(values.marker.repetitionsPerLayer || "1"),
      sizes: values.sizes.map((size) => ({
        label: size.label,
        piecesPerPala: whole(size.piecesPerPala),
        pieceWeightG: decimalOrNull(size.pieceWeightG),
      })),
    },
    colours: values.colours.map((colour) => ({
      name: colour.name,
      rolls: colour.rolls.map((roll) => ({
        thaan: roll.thaan,
        issuedKg: roll.issuedKg.trim(),
        returnedKg: roll.returnedKg.trim() || "0",
        confirmedLayers: roll.confirmedLayers.trim() === "" ? null : whole(roll.confirmedLayers),
      })),
    })),
  };
}

const integerOr = (value: string, fallback: number) => {
  const number = Number(value);

  return value.trim() !== "" && Number.isFinite(number) ? number : fallback;
};

export interface DraftPayload {
  draft: CuttingDraftInput;
  /** Maps an API error path (on the sent arrays) back to the form row it came from. */
  toFormPath: (path: string) => string;
}

const blankRoll = (roll: RollValues) => !roll.rollId && !roll.thaan.trim() && !roll.issuedKg.trim();

/**
 * What a save sends. Rows left completely blank are skipped, so a half-filled form
 * can still be saved as a draft; the index maps keep server errors on the right row.
 */
export function draftPayloadOf(values: CuttingFormValues): DraftPayload {
  const calculated = values.marker.weightSource === "CALCULATED";
  const colourIndex: number[] = [];
  const rollIndex: number[][] = [];

  const colours = values.colours.flatMap((colour, index) => {
    const rolls = colour.rolls.flatMap((roll, position) => (blankRoll(roll) ? [] : [{ roll, position }]));

    if (!colour.colourId && !colour.name.trim() && rolls.length === 0) return [];

    colourIndex.push(index);
    rollIndex.push(rolls.map((entry) => entry.position));

    return [
      {
        id: colour.colourId || undefined,
        name: colour.name,
        rolls: rolls.map(({ roll }) => ({
          id: roll.rollId || undefined,
          thaan: roll.thaan,
          issuedKg: roll.issuedKg.trim(),
          returnedKg: roll.returnedKg.trim() || "0",
          confirmedLayers: roll.confirmedLayers.trim() === "" ? null : integerOr(roll.confirmedLayers, 0),
        })),
      },
    ];
  });

  const toFormPath = (path: string) =>
    path.replace(/^colours\.(\d+)(?:\.rolls\.(\d+))?/, (match, colour: string, row?: string) => {
      const formColour = colourIndex[Number(colour)];

      if (formColour === undefined) return match;

      if (row === undefined) return `colours.${formColour}`;

      return `colours.${formColour}.rolls.${rollIndex[Number(colour)]?.[Number(row)] ?? row}`;
    });

  return {
    draft: {
      cuttingMasterId: values.cuttingMasterId || null,
      cuttingDate: values.cuttingDate,
      notes: values.notes.trim() || null,
      marker: {
        widthM: decimalOrNull(values.marker.widthM),
        lengthM: decimalOrNull(values.marker.lengthM),
        // GSM only matters when the Pala weight is calculated; a weighed Pala keeps none.
        gsm: calculated ? decimalOrNull(values.marker.gsm) : null,
        measuredPalaKg: decimalOrNull(values.marker.measuredPalaKg),
        weightSource: values.marker.weightSource,
        repetitionsPerLayer: integerOr(values.marker.repetitionsPerLayer, 1),
      },
      sizes: values.sizes.map((size) => ({
        label: size.label,
        piecesPerPala: integerOr(size.piecesPerPala, 0),
        pieceWeightG: decimalOrNull(size.pieceWeightG),
      })),
      colours,
      saveAsDefault: values.saveAsDefault,
    },
    toFormPath,
  };
}

export type StepId = "details" | "marker" | "thaan";

export const STEPS: { id: StepId; title: string; description: string }[] = [
  { id: "details", title: "Lot & item", description: "Lot number, what is cut, from which fabric and by whom" },
  { id: "marker", title: "Marker & sizes", description: "Weight of one Pala and the size ratio" },
  { id: "thaan", title: "Colours & Thaan", description: "Weight issued from each roll" },
];

/** Which form section owns a field path. */
export function stepOf(path: string): StepId {
  if (path.startsWith("marker") || path.startsWith("sizes")) return "marker";

  if (path.startsWith("colours")) return "thaan";

  return "details";
}

/** Same comparison the API uses for item names: case, spacing and punctuation ignored. */
export function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
