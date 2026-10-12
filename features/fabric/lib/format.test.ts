import { describe, expect, it } from "vitest";

import { formatDate, formatMoney, formatQty, inwardNumber, stockState } from "./format";

describe("fabric formatting", () => {
  it("uses Indian digit grouping, unit labels and padded numbers", () => {
    expect(formatMoney(105000)).toBe("Rs 1,05,000.00");
    expect(formatQty(1475.5, "METER")).toBe("1,475.5 m");
    expect(inwardNumber(7)).toBe("FI-0007");
    expect(formatDate("2026-10-01")).toBe("1 Oct 2026");
  });

  it("classifies stock against the threshold", () => {
    expect(stockState({ balance: 0, lowStockThreshold: 10 })).toBe("out");
    expect(stockState({ balance: 10, lowStockThreshold: 10 })).toBe("low");
    expect(stockState({ balance: 11, lowStockThreshold: 10 })).toBe("ok");
    expect(stockState({ balance: 5, lowStockThreshold: null })).toBe("ok");
  });
});
