import { describe, expect, it } from "vitest";

import { getSafeRedirect, loginPathFor } from "./safe-redirect";

describe("getSafeRedirect", () => {
  it.each([
    ["/orders?status=open", "/orders?status=open"],
    ["/inventory/movements#top", "/inventory/movements#top"],
  ])("keeps internal path %s", (input, expected) => {
    expect(getSafeRedirect(input)).toBe(expected);
  });

  it.each([
    null,
    "",
    "https://evil.example/phish",
    "//evil.example",
    String.raw`/\evil.example`,
    "javascript:alert(1)",
    "dashboard",
    "/login",
    "/reset-password",
  ])("falls back to /dashboard for %s", (input) => {
    expect(getSafeRedirect(input)).toBe("/dashboard");
  });

  it("builds a login path that preserves the destination", () => {
    expect(loginPathFor("/users?tab=invited")).toBe("/login?next=%2Fusers%3Ftab%3Dinvited");
    expect(loginPathFor("/dashboard")).toBe("/login");
  });
});
