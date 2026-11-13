import { describe, expect, it } from "vitest";

import { exportError } from "./csv";

describe("exportError", () => {
  it("shows the server's message from a JSON error body", async () => {
    const body = new Blob([
      JSON.stringify({ success: false, error: { code: "BAD_REQUEST", message: "More than 50,000 rows match." } }),
    ]);
    const error = await exportError(400, body);
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe("More than 50,000 rows match.");
  });

  it("falls back to a plain message for anything else", async () => {
    expect((await exportError(502, new Blob(["<html>"]))).message).toBe("Could not export. Please try again.");
    expect((await exportError(500, undefined)).code).toBe("UNKNOWN_ERROR");
  });
});
