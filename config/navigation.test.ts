import { describe, expect, it } from "vitest";

import { navigation } from "./navigation";

describe("navigation", () => {
  it("gives every item a unique href, since the placeholder page looks items up by href", () => {
    const hrefs = navigation.flatMap((group) => group.items).map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
