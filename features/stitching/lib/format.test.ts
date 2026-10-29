import { describe, expect, it } from "vitest";

import { previewSplit, toPaisa } from "./format";

describe("stitching pay preview", () => {
  it("splits like the API: exact paisa, leftover to members in order", () => {
    expect(previewSplit(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(previewSplit(35_000, [6000, 4000])).toEqual([21_000, 14_000]);
    expect(previewSplit(1, [0, 1])).toEqual([0, 1]);
    expect(previewSplit(500, [0, 0])).toEqual([0, 0]);
  });

  it("reads rupees with at most 2 decimals", () => {
    expect(toPaisa("12.5")).toBe(1250);
    expect(toPaisa("0.05")).toBe(5);
    expect(toPaisa("1.234")).toBeNull();
  });
});
