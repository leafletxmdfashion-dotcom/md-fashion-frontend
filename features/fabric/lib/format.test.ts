import { describe, expect, it } from "vitest";

import { amountOf, closeName, formatDate, formatMoney, formatQty, hasPlaces, inwardNumber, stockState, todayISO } from "./format";

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

  it("computes a purchase amount to the paisa exactly as the database stores it", () => {
    expect(amountOf(0.334, 3.34)).toBe(1.12);
    expect(amountOf(125.375, 412.5)).toBe(51_717.19);
    expect(amountOf(0.1, 0.2)).toBe(0.02);
    expect(amountOf(999_999.999, 99_999.99)).toBe(99_999_989_900);
    expect(formatMoney(0 * -5)).toBe("Rs 0.00");
    expect(formatMoney(-0.001)).toBe("Rs 0.00");
  });

  it("dates today in the factory's timezone (Nepal, UTC+05:45), like the API", () => {
    expect(todayISO(new Date("2026-10-28T18:14:00Z"))).toBe("2026-10-28");
    expect(todayISO(new Date("2026-10-28T18:16:00Z"))).toBe("2026-10-29");
  });

  it("finds an existing name one or two typos away, for a 'did you mean' hint", () => {
    const names = ["Polyester Rib", "Cotton Jersey", "Rib"];
    expect(closeName("polyster rib", names)).toBe("Polyester Rib");
    expect(closeName("Cotton Jersy ", names)).toBe("Cotton Jersey");
    expect(closeName("Linen", names)).toBeUndefined();
    expect(closeName("Rob", names)).toBeUndefined(); // short names would match too much
    expect(closeName("Polyester Rib", names)).toBeUndefined(); // exact match is not a typo
  });

  it("tells whether a number fits the stored decimals", () => {
    expect(hasPlaces(1.235, 3)).toBe(true);
    expect(hasPlaces(0.1 + 0.2, 3)).toBe(true);
    expect(hasPlaces(1.2345, 3)).toBe(false);
    expect(hasPlaces(2.345, 2)).toBe(false);
  });
});
