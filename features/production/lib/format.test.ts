import { describe, expect, it } from "vitest";

import { calculateBatch } from "./cutting-calc";
import { inchesToMetres, kgText, metresToInches } from "./format";
import {
  batchValues,
  calcInputsOf,
  draftPayloadOf,
  emptyRoll,
  inchIssues,
  nameKey,
  newProductionValues,
  onRows,
  stepOf,
  type CuttingFormValues,
} from "./form-model";

function form(overrides: Partial<CuttingFormValues> = {}): CuttingFormValues {
  return {
    ...newProductionValues(),
    marker: {
      widthM: "",
      lengthM: "",
      widthUnit: "M",
      lengthUnit: "M",
      gsm: "",
      measuredPalaKg: "2.130",
      palaAltValue: "",
      weightSource: "MEASURED",
      repetitionsPerLayer: "1",
    },
    sizes: [
      { label: "S", piecesPerPala: "1", pieceWeightG: "" },
      { label: "M", piecesPerPala: "2", pieceWeightG: "" },
      { label: "L", piecesPerPala: "1", pieceWeightG: "" },
    ],
    rolls: [{ ...emptyRoll("Black"), issuedKg: "30.500" }],
    ...overrides,
  };
}

describe("kgText", () => {
  it("shows exact API decimals as grouped kilograms with 3 decimals", () => {
    expect(kgText("29.82")).toBe("29.820 kg");
    expect(kgText("1234.5")).toBe("1,234.500 kg");
    expect(kgText("0.0005")).toBe("0.001 kg");
    expect(kgText("-0.18")).toBe("−0.180 kg");
    expect(kgText(null)).toBe("—");
  });
});

describe("units", () => {
  it("names metres for fabric bought by the metre", () => {
    expect(kgText("1.2", "METER")).toBe("1.200 m");
    expect(kgText("1.2", "KG")).toBe("1.200 kg");
  });

  it("converts inches to metres and back exactly", () => {
    expect(inchesToMetres("58")).toBe("1.4732");
    expect(inchesToMetres("58.5")).toBe("1.4859");
    expect(inchesToMetres("abc")).toBeNull();
    expect(metresToInches("1.4732")).toBe("58");
    expect(metresToInches("1.4859")).toBe("58.5");
  });

  it("sends Panaha typed in inches as metres with its unit, and shows it back in inches", () => {
    const values = form();

    values.marker = {
      ...values.marker,
      widthM: "58",
      widthUnit: "IN",
      lengthM: "7.1",
    };

    const { draft } = draftPayloadOf(values);

    expect(draft.marker).toMatchObject({
      widthM: "1.4732",
      widthUnit: "IN",
      lengthM: "7.1",
      lengthUnit: "M",
    });

    const shown = batchValues({
      lot: { lotNumber: "L-1", article: { name: "Polo" }, fabric: { id: "f" } },
      cuttingMaster: null,
      cuttingDate: "2026-11-12",
      notes: null,
      marker: { ...draft.marker, calculatedPalaKg: null, activePalaKg: null },
      sizes: [],
      colours: [],
    } as never);

    expect(shown.marker).toMatchObject({
      widthM: "58",
      widthUnit: "IN",
      lengthM: "7.1",
      lengthUnit: "M",
    });
  });

  it("never sends inches it cannot read as metres, and says why", () => {
    const values = form();

    values.marker = { ...values.marker, widthM: "58.125", widthUnit: "IN" };

    expect(draftPayloadOf(values).draft.marker.widthM).not.toMatch(/^\d+(\.\d+)?$/);
    expect(inchIssues(values)).toEqual([
      {
        path: "marker.widthM",
        message: "Panaha: enter inches with up to 2 decimals, e.g. 58.5.",
      },
    ]);
  });

  it("calculates a metre fabric in metres", () => {
    const values = form({ rolls: [{ ...emptyRoll("Black"), issuedKg: "3" }] });

    values.marker.measuredPalaKg = "7.2";

    const inputs = calcInputsOf(values, "METER");
    const result = calculateBatch(inputs.marker, inputs.colours);

    expect(result.warnings[0]?.message).toMatch(/3\.000 m of Black/);
  });
});

describe("production form model", () => {
  it("feeds what is on screen to the calculator: 30.500 kg → 14 Pala, 56 pieces", () => {
    const inputs = calcInputsOf(form());
    const result = calculateBatch(inputs.marker, inputs.colours);

    expect(result.issues).toEqual([]);
    expect(result.totals).toMatchObject({
      confirmedPala: 14,
      acceptedPieces: 56,
    });
  });

  it("sends an empty return and Pala as 'work it out' and leaves new Thaan unnumbered", () => {
    const { draft } = draftPayloadOf(form());

    expect(draft.colours[0]!.rolls[0]).toEqual({
      id: undefined,
      thaan: undefined,
      issuedKg: "30.500",
      returnedKg: null,
      confirmedLayers: null,
      note: null,
    });
    expect(draft.colours[0]!.id).toBeUndefined();
    expect(draft.marker).toMatchObject({
      measuredPalaKg: "2.130",
      widthM: null,
      repetitionsPerLayer: 1,
    });
  });

  it("groups rows into colours by name, skips blank rows and maps errors back to the row on screen", () => {
    const values = form({
      rolls: [
        emptyRoll(),
        { ...emptyRoll("Black"), issuedKg: "10" },
        { ...emptyRoll("Blue"), issuedKg: "5" },
        { ...emptyRoll("black "), issuedKg: "7" },
        emptyRoll("Red"),
      ],
    });

    const { draft, toFormPath } = draftPayloadOf(values);

    expect(draft.colours.map((colour) => [colour.name, colour.rolls.map((roll) => roll.issuedKg)])).toEqual([
      ["Black", ["10", "7"]],
      ["Blue", ["5"]],
      ["Red", []],
    ]);
    expect(toFormPath("colours.0.rolls.1.issuedKg")).toBe("rolls.3.issuedKg");
    expect(toFormPath("colours.1.name")).toBe("rolls.2.colour");
    expect(toFormPath("colours.2.name")).toBe("rolls.4.colour");
    expect(toFormPath("marker.gsm")).toBe("marker.gsm");

    // The calculator flags the colourless row on that row.
    const inputs = calcInputsOf(values);
    const result = calculateBatch(inputs.marker, inputs.colours);

    expect(onRows(result.issues, inputs).map((issue) => issue.path)).toContain("rolls.0.colour");
  });

  it("keeps issued Thaan under their saved colour, whatever row order or spelling", () => {
    const issued = {
      ...emptyRoll("Black"),
      rollId: "r1",
      colourId: "c1",
      status: "ISSUED" as const,
      thaan: "1",
      issuedKg: "10",
    };
    const values = form({
      rolls: [
        {
          ...emptyRoll("BLACK"),
          rollId: "r2",
          colourId: "c1",
          thaan: "2",
          issuedKg: "4",
        },
        issued,
      ],
    });

    const { draft } = draftPayloadOf(values);

    expect(draft.colours).toEqual([
      expect.objectContaining({
        id: "c1",
        name: "Black",
        rolls: [expect.objectContaining({ id: "r2" }), expect.objectContaining({ id: "r1", thaan: "1" })],
      }),
    ]);
  });

  it("assigns each field to its wizard step", () => {
    expect(stepOf("articleName")).toBe("details");
    expect(stepOf("sizes.2.label")).toBe("marker");
    expect(stepOf("rolls.1.issuedKg")).toBe("thaan");
  });

  it("matches item names the way the API does", () => {
    expect(nameKey("Polo T-Shirt")).toBe(nameKey("polo  tshirt"));
    expect(nameKey("Polo T-Shirt")).not.toBe(nameKey("Polo Shirt"));
  });
});
