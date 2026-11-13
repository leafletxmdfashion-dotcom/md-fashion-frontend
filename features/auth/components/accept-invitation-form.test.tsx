import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { renderWithClient } from "@/test/render";

import { authApi } from "../api/auth.api";
import { AcceptInvitationForm } from "./accept-invitation-form";

vi.mock("../api/auth.api", () => ({
  authApi: { inspectInvitation: vi.fn(), acceptInvitation: vi.fn() },
}));

const TOKEN = "B".repeat(43);

describe("AcceptInvitationForm", () => {
  beforeEach(() => {
    vi.mocked(authApi.inspectInvitation).mockReset();
    window.history.replaceState(null, "", `/accept-invitation#token=${TOKEN}`);
  });

  it("calls a link dead only when the server says the token is invalid", async () => {
    vi.mocked(authApi.inspectInvitation).mockRejectedValue(new ApiError(400, "TOKEN_INVALID", "Invalid."));
    renderWithClient(<AcceptInvitationForm />);
    expect(await screen.findByText("This invitation is no longer valid")).toBeInTheDocument();
  });

  it("keeps a valid invitation alive when the check is rate limited, and retries", async () => {
    vi.mocked(authApi.inspectInvitation)
      .mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "Too many attempts. Try again in 12 minutes."))
      .mockResolvedValueOnce({
        email: "new.hire@garment.test",
        phone: null,
        name: "New Hire",
        roleName: "Staff",
        expiresAt: "2026-11-01T00:00:00Z",
      });
    renderWithClient(<AcceptInvitationForm />);

    expect(await screen.findByText("Too many attempts. Try again in 12 minutes.")).toBeInTheDocument();
    expect(screen.queryByText("This invitation is no longer valid")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Full name")).toHaveValue("New Hire");
  });
});
