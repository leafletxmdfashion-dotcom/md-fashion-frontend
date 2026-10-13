import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("csv", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(
      toCsv(
        ["code", "name"],
        [
          ["FB-1", 'Cotton "Supima", 40s'],
          ["FB-2", "line\nbreak"],
        ],
      ),
    ).toBe('code,name\r\nFB-1,"Cotton ""Supima"", 40s"\r\nFB-2,"line\nbreak"');
  });

  it("neutralises spreadsheet formulas but keeps real numbers", () => {
    expect(toCsv(["a"], [["=SUM(A1)"], ["-5"], [-5]])).toBe("a\r\n'=SUM(A1)\r\n'-5\r\n-5");
  });
});
