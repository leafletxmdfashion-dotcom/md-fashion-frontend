import { describe, expect, it } from "vitest";

import { calculateBatch } from "./cutting-calc";
import { kgText } from "./format";
import { calcInputsOf, draftPayloadOf, emptyRoll, nameKey, newProductionValues, onRows, stepOf, type CuttingFormValues } from "./form-model";

function form(overrides: Partial<CuttingFormValues> = {}): CuttingFormValues {
  return {
    ...newProductionValues(),
    marker: { widthM: "", lengthM: "", gsm: "", measuredPalaKg: "2.130", weightSource: "MEASURED", repetitionsPerLayer: "1" },
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

describe("production form model", () => {
  it("feeds what is on screen to the calculator: 30.500 kg → 14 Pala, 56 pieces", () => {
    const inputs = calcInputsOf(form());
    const result = calculateBatch(inputs.marker, inputs.colours);

    expect(result.issues).toEqual([]);
    expect(result.totals).toMatchObject({ confirmedPala: 14, acceptedPieces: 56 });
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
    expect(draft.marker).toMatchObject({ measuredPalaKg: "2.130", widthM: null, repetitionsPerLayer: 1 });
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
    const issued = { ...emptyRoll("Black"), rollId: "r1", colourId: "c1", status: "ISSUED" as const, thaan: "1", issuedKg: "10" };
    const values = form({
      rolls: [{ ...emptyRoll("BLACK"), rollId: "r2", colourId: "c1", thaan: "2", issuedKg: "4" }, issued],
    });

    const { draft } = draftPayloadOf(values);

    expect(draft.colours).toEqual([
      expect.objectContaining({ id: "c1", name: "Black", rolls: [expect.objectContaining({ id: "r2" }), expect.objectContaining({ id: "r1", thaan: "1" })] }),
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
