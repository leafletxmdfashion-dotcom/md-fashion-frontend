import { describe, expect, it } from "vitest";

import { calculateBatch } from "./cutting-calc";
import { kgText } from "./format";
import { calcInputsOf, draftPayloadOf, emptyRoll, nameKey, newProductionValues, stepOf, type CuttingFormValues } from "./form-model";

function form(overrides: Partial<CuttingFormValues> = {}): CuttingFormValues {
  return {
    ...newProductionValues(),
    marker: { widthM: "", lengthM: "", gsm: "", measuredPalaKg: "2.130", weightSource: "MEASURED", repetitionsPerLayer: "1" },
    sizes: [
      { label: "S", piecesPerPala: "1", pieceWeightG: "" },
      { label: "M", piecesPerPala: "2", pieceWeightG: "" },
      { label: "L", piecesPerPala: "1", pieceWeightG: "" },
    ],
    colours: [
      {
        colourId: "",
        name: "Black",
        rolls: [{ rollId: "", status: "DRAFT", thaan: "TH-001", issuedKg: "30.500", returnedKg: "", confirmedLayers: "" }],
      },
    ],
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

  it("sends empty returns as zero and an empty confirmed Pala as 'use the estimate'", () => {
    const { draft } = draftPayloadOf(form());

    expect(draft.colours[0]!.rolls[0]).toMatchObject({ returnedKg: "0", confirmedLayers: null, issuedKg: "30.500" });
    expect(draft.colours[0]!.id).toBeUndefined();
    expect(draft.marker).toMatchObject({ measuredPalaKg: "2.130", widthM: null, repetitionsPerLayer: 1 });
  });

  it("skips blank rows when saving and maps server errors back to the row on screen", () => {
    const values = form();
    const black = values.colours[0]!;

    values.colours = [
      { colourId: "", name: "", rolls: [emptyRoll()] },
      { ...black, rolls: [emptyRoll(), black.rolls[0]!] },
    ];

    const { draft, toFormPath } = draftPayloadOf(values);

    expect(draft.colours).toHaveLength(1);
    expect(draft.colours[0]!.rolls.map((roll) => roll.thaan)).toEqual(["TH-001"]);
    expect(toFormPath("colours.0.rolls.0.issuedKg")).toBe("colours.1.rolls.1.issuedKg");
    expect(toFormPath("colours.0.name")).toBe("colours.1.name");
    expect(toFormPath("marker.gsm")).toBe("marker.gsm");
  });

  it("assigns each field to its wizard step", () => {
    expect(stepOf("articleName")).toBe("details");
    expect(stepOf("sizes.2.label")).toBe("marker");
    expect(stepOf("colours.1.rolls.0.issuedKg")).toBe("thaan");
  });

  it("matches item names the way the API does", () => {
    expect(nameKey("Polo T-Shirt")).toBe(nameKey("polo  tshirt"));
    expect(nameKey("Polo T-Shirt")).not.toBe(nameKey("Polo Shirt"));
  });
});
