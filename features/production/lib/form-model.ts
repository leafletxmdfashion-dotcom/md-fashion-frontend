import { todayISO } from "@/features/fabric/lib/format";

import type { Batch, CuttingDraftInput, MarkerDefaults, RollStatus, WeightSource } from "../types/production.types";
import type { BatchResult, ColourInput, Issue, MarkerInput, QtyUnit, RollResult } from "./cutting-calc";
import { inchesToMetres, metresToInches } from "./format";

// The production form keeps every input as text (what the operator typed), so the
// calculator and the API both read exactly what is on screen. Ids are named
// rollId / colourId because react-hook-form reserves `id` on field-array items.
//
// On screen every Thaan is one row with its colour; the calculator and the API take
// colours with their Thaan, so rows are grouped by colour name (any case) on the way out.

export interface RollValues {
  rollId: string;
  /** The saved colour this Thaan was under; issued Thaan stay under it. */
  colourId: string;
  status: RollStatus;
  colour: string;
  /** Kept for saved Thaan only; the API numbers new ones. */
  thaan: string;
  issuedKg: string;
  /** Empty means "work it out" (see calculateRoll). */
  returnedKg: string;
  /** Empty means "use the estimate". */
  confirmedLayers: string;
  /** Optional: why the typed Pala differ from the estimate. */
  note: string;
}

export interface SizeValues {
  label: string;
  piecesPerPala: string;
  pieceWeightG: string;
}

export type LengthUnit = "M" | "IN";

export interface MarkerValues {
  /** As typed, in widthUnit; sent to the API in metres. */
  widthM: string;
  /** As typed, in lengthUnit; sent to the API in metres. */
  lengthM: string;
  widthUnit: LengthUnit;
  lengthUnit: LengthUnit;
  gsm: string;
  measuredPalaKg: string;
  /** The Pala in the other unit (m for kg fabric, kg for metre fabric); recorded only. */
  palaAltValue: string;
  weightSource: WeightSource;
  repetitionsPerLayer: string;
}

export interface CuttingFormValues {
  /** Typed lot number; an open lot with this number takes the new cutting. */
  lotNumber: string;
  articleName: string;
  fabricId: string;
  cuttingMasterId: string;
  cuttingDate: string;
  notes: string;
  marker: MarkerValues;
  sizes: SizeValues[];
  rolls: RollValues[];
  saveAsDefault: boolean;
}

const text = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

export const emptyRoll = (colour = ""): RollValues => ({
  rollId: "",
  colourId: "",
  status: "DRAFT",
  colour,
  thaan: "",
  issuedKg: "",
  returnedKg: "",
  confirmedLayers: "",
  note: "",
});

const DEFAULT_SIZES: SizeValues[] = ["S", "M", "L", "XL"].map((label) => ({
  label,
  piecesPerPala: "1",
  pieceWeightG: "",
}));

/** Stored metres → the text shown in the unit they were typed in. */
const shownLength = (metres: string | null | undefined, unit: LengthUnit) =>
  metres === null || metres === undefined ? "" : unit === "IN" ? (metresToInches(metres) ?? metres) : metres;

/** Typed text → metres for the API; text that is not a number goes as typed so the API names the problem. */
export function lengthInMetres(typed: string, unit: LengthUnit): string | null {
  const value = typed.trim();

  if (value === "") return null;

  // Inches that do not convert (letters, more than 2 decimals) go as text the API rejects,
  // never as a number of metres; the form shows why first (inchIssues).
  return unit === "IN" ? (inchesToMetres(value) ?? `${value} in`) : value;
}

/** Panaha or layer length typed in inches that cannot be read, as form issues. */
export function inchIssues(values: CuttingFormValues): Issue[] {
  const fields = [
    ["widthM", "widthUnit", "Panaha"],
    ["lengthM", "lengthUnit", "Layer length"],
  ] as const;

  return fields.flatMap(([field, unitField, label]) => {
    const typed = values.marker[field].trim();

    return values.marker[unitField] === "IN" && typed !== "" && inchesToMetres(typed) === null
      ? [
          {
            path: `marker.${field}`,
            message: `${label}: enter inches with up to 2 decimals, e.g. 58.5.`,
          },
        ]
      : [];
  });
}

export function markerValuesOf(marker: Omit<MarkerDefaults, "sizes"> | null): MarkerValues {
  const widthUnit = marker?.widthUnit ?? "M";
  const lengthUnit = marker?.lengthUnit ?? "M";

  return {
    widthM: shownLength(marker?.widthM, widthUnit),
    lengthM: shownLength(marker?.lengthM, lengthUnit),
    widthUnit,
    lengthUnit,
    gsm: text(marker?.gsm),
    measuredPalaKg: text(marker?.measuredPalaKg),
    palaAltValue: text(marker?.palaAltValue),
    // The Calculated (GSM) option is hidden; every new or reopened marker is weighed. The API still
    // accepts CALCULATED, so older finalized cutting keeps showing its calculated weight.
    weightSource: "MEASURED",
    repetitionsPerLayer: text(marker?.repetitionsPerLayer ?? 1),
  };
}

export function sizeValuesOf(sizes: MarkerDefaults["sizes"] | undefined): SizeValues[] {
  return sizes?.length
    ? sizes.map((size) => ({
        label: size.label,
        piecesPerPala: String(size.piecesPerPala),
        pieceWeightG: text(size.pieceWeightG),
      }))
    : DEFAULT_SIZES;
}

export function newProductionValues(): CuttingFormValues {
  return {
    lotNumber: "",
    articleName: "",
    fabricId: "",
    cuttingMasterId: "",
    cuttingDate: todayISO(),
    notes: "",
    marker: markerValuesOf(null),
    sizes: DEFAULT_SIZES,
    rolls: [emptyRoll()],
    saveAsDefault: false,
  };
}

export function batchValues(batch: Batch): CuttingFormValues {
  return {
    lotNumber: batch.lot.lotNumber,
    articleName: batch.lot.article.name,
    fabricId: batch.lot.fabric.id,
    cuttingMasterId: batch.cuttingMaster?.id ?? "",
    cuttingDate: batch.cuttingDate,
    notes: batch.notes ?? "",
    marker: markerValuesOf(batch.marker),
    sizes: sizeValuesOf(batch.sizes),
    // A colour saved before its Thaan were weighed still shows, as a row without weight.
    rolls: batch.colours.flatMap((colour) =>
      colour.rolls.length === 0
        ? [{ ...emptyRoll(colour.name), colourId: colour.id }]
        : colour.rolls.map((roll) => ({
            rollId: roll.id,
            colourId: colour.id,
            status: roll.status,
            colour: colour.name,
            thaan: roll.thaan,
            issuedKg: roll.issuedKg,
            returnedKg: roll.returnedKg ?? "",
            confirmedLayers: text(roll.confirmedLayers),
            note: roll.note ?? "",
          })),
    ),
    saveAsDefault: false,
  };
}

/** One colour of the batch: its name, its saved id if any, and which form rows are its Thaan. */
export interface ColourGroup {
  name: string;
  colourId: string | undefined;
  rows: number[];
}

/**
 * Rows → colours in first-seen order; rows naming the same colour (any case) form
 * one group. Rows without a colour stay apart so each is flagged on its own. A saved
 * colour id goes to the group holding its issued Thaan first (they cannot move),
 * then to any group still without one; the issued Thaan's spelling names the group.
 */
export function groupRows(rows: RollValues[], include: (row: RollValues) => boolean = () => true): ColourGroup[] {
  const groups = new Map<string, ColourGroup>();

  rows.forEach((row, index) => {
    if (!include(row)) return;

    const name = row.colour.trim();
    const key = name ? name.toLowerCase() : `#${index}`;
    const group = groups.get(key) ?? { name, colourId: undefined, rows: [] };

    group.rows.push(index);
    groups.set(key, group);
  });

  const list = [...groups.values()];
  const claimed = new Set<string>();

  for (const issuedOnly of [true, false]) {
    for (const group of list) {
      if (group.colourId) continue;

      const owner = group.rows
        .map((index) => rows[index]!)
        .find((row) => row.colourId && !claimed.has(row.colourId) && (!issuedOnly || row.status !== "DRAFT"));

      if (!owner) continue;

      group.colourId = owner.colourId;
      claimed.add(owner.colourId);

      if (owner.status !== "DRAFT") group.name = owner.colour.trim();
    }
  }

  return list;
}

/** Maps a "colours.g.rolls.j.field" path (calculator or API) back to the form row it came from. */
export function rowPathMapper(groups: ColourGroup[]): (path: string) => string {
  return (path) => {
    const match = /^colours\.(\d+)(?:\.(name|rolls)(?:\.(\d+)(\..+)?)?)?$/.exec(path);

    if (!match) return path === "colours" ? "rolls" : path;

    const group = groups[Number(match[1])];

    if (!group) return path;

    const first = group.rows[0] ?? 0;

    if (match[3] === undefined) return `rolls.${first}.colour`;

    const row = group.rows[Number(match[3])] ?? first;

    // Thaan numbers are not on screen; a problem with one shows on its colour.
    return `rolls.${row}${match[4] === undefined ? ".issuedKg" : match[4] === ".thaan" ? ".colour" : match[4]}`;
  };
}

/** A whole number from an input, or NaN so the calculator flags it. */
const whole = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

const decimalOrNull = (value: string) => (value.trim() === "" ? null : value.trim());

export interface CalcInputs {
  marker: MarkerInput;
  colours: ColourInput[];
  groups: ColourGroup[];
  /** Calculator issue path → form field path. */
  toFormPath: (path: string) => string;
}

export function calcInputsOf(values: CuttingFormValues, unit: QtyUnit = "KG"): CalcInputs {
  const calculated = values.marker.weightSource === "CALCULATED";
  const groups = groupRows(values.rolls);

  return {
    marker: {
      unit,
      widthM: lengthInMetres(values.marker.widthM, values.marker.widthUnit),
      lengthM: lengthInMetres(values.marker.lengthM, values.marker.lengthUnit),
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
    colours: groups.map((group) => ({
      name: group.name,
      rolls: group.rows.map((index) => {
        const roll = values.rolls[index]!;

        return {
          thaan: roll.thaan,
          issuedKg: roll.issuedKg.trim(),
          returnedKg: decimalOrNull(roll.returnedKg),
          confirmedLayers: roll.confirmedLayers.trim() === "" ? null : whole(roll.confirmedLayers),
        };
      }),
    })),
    groups,
    toFormPath: rowPathMapper(groups),
  };
}

/** The calculation for each form row, in row order. */
export function rowResultsOf(inputs: CalcInputs, calc: BatchResult): (RollResult | undefined)[] {
  const results: (RollResult | undefined)[] = [];

  inputs.groups.forEach((group, groupIndex) =>
    group.rows.forEach((row, position) => {
      results[row] = calc.colours[groupIndex]?.rolls[position];
    }),
  );

  return results;
}

/** Calculator issues and warnings with their paths pointing at form rows. */
export function onRows(issues: Issue[], inputs: CalcInputs): Issue[] {
  return issues.map((issue) => ({
    ...issue,
    path: inputs.toFormPath(issue.path),
  }));
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

/** A row with nothing typed and nothing saved is not sent. */
const blankRoll = (roll: RollValues) => !roll.rollId && !roll.colour.trim() && !roll.issuedKg.trim();

/** A row naming only its colour saves the colour; the Thaan follows once weighed. */
const weighed = (roll: RollValues) => Boolean(roll.rollId || roll.issuedKg.trim());

/**
 * What a save sends. Blank rows are skipped, so a half-filled form can still be
 * saved as a draft; the group map keeps server errors on the right row.
 */
export function draftPayloadOf(values: CuttingFormValues): DraftPayload {
  const calculated = values.marker.weightSource === "CALCULATED";

  const groups = groupRows(values.rolls, (roll) => !blankRoll(roll)).map((group) => ({
    ...group,
    rows: group.rows.filter((index) => weighed(values.rolls[index]!)),
    named: group.rows,
  }));

  return {
    draft: {
      cuttingMasterId: values.cuttingMasterId || null,
      cuttingDate: values.cuttingDate,
      notes: values.notes.trim() || null,
      marker: {
        widthM: lengthInMetres(values.marker.widthM, values.marker.widthUnit),
        lengthM: lengthInMetres(values.marker.lengthM, values.marker.lengthUnit),
        widthUnit: values.marker.widthUnit,
        lengthUnit: values.marker.lengthUnit,
        // GSM only matters when the Pala weight is calculated; a weighed Pala keeps none.
        gsm: calculated ? decimalOrNull(values.marker.gsm) : null,
        measuredPalaKg: decimalOrNull(values.marker.measuredPalaKg),
        palaAltValue: decimalOrNull(values.marker.palaAltValue),
        weightSource: values.marker.weightSource,
        repetitionsPerLayer: integerOr(values.marker.repetitionsPerLayer, 1),
      },
      sizes: values.sizes.map((size) => ({
        label: size.label,
        piecesPerPala: integerOr(size.piecesPerPala, 0),
        pieceWeightG: decimalOrNull(size.pieceWeightG),
      })),
      colours: groups.map((group) => ({
        id: group.colourId,
        name: group.name,
        rolls: group.rows.map((index) => {
          const roll = values.rolls[index]!;

          return {
            id: roll.rollId || undefined,
            thaan: roll.thaan || undefined,
            issuedKg: roll.issuedKg.trim(),
            returnedKg: decimalOrNull(roll.returnedKg),
            confirmedLayers: roll.confirmedLayers.trim() === "" ? null : integerOr(roll.confirmedLayers, 0),
            note: roll.confirmedLayers.trim() === "" ? null : roll.note.trim() || null,
          };
        }),
      })),
      saveAsDefault: values.saveAsDefault,
    },
    // A colour-level error points at the colour's first row, even one not yet weighed.
    toFormPath: rowPathMapper(
      groups.map((group) => ({
        ...group,
        rows: group.rows.length ? group.rows : group.named,
      })),
    ),
  };
}

export type StepId = "details" | "marker" | "thaan";

export const STEPS: { id: StepId; title: string; description: string }[] = [
  {
    id: "details",
    title: "Lot & item",
    description: "Lot number, what is cut, from which fabric and by whom",
  },
  {
    id: "marker",
    title: "Marker & sizes",
    description: "Weight of one Pala and the size ratio",
  },
  {
    id: "thaan",
    title: "Colours & Thaan",
    description: "Each Thaan's colour and the weight issued",
  },
];

/** Which form section owns a field path. */
export function stepOf(path: string): StepId {
  if (path.startsWith("marker") || path.startsWith("sizes")) return "marker";

  if (path.startsWith("rolls") || path.startsWith("colours")) return "thaan";

  return "details";
}

/** Same comparison the API uses for item names: case, spacing and punctuation ignored. */
export function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
