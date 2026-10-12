import { describe, expect, it } from "vitest";

import { parseCsv, toCsv } from "./csv";

describe("csv", () => {
  it("round-trips quotes, commas and line breaks", () => {
    const rows = [
      ["FB-1", 'Cotton "Supima", 40s', "line\nbreak"],
      ["FB-2", "", "plain"],
    ];
    expect(parseCsv(toCsv(["code", "name", "notes"], rows))).toEqual([["code", "name", "notes"], ...rows]);
  });

  it("neutralises spreadsheet formulas and skips blank lines", () => {
    expect(toCsv(["a"], [["=SUM(A1)"], ["-5"], [-5]])).toBe("a\r\n'=SUM(A1)\r\n'-5\r\n-5");
    expect(parseCsv("﻿a,b\r\n\r\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});
