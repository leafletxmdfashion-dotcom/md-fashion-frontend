import { renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { renderWithClient } from "@/test/render";

import { authApi } from "../api/auth.api";
import { useLogout } from "../hooks/use-logout";
import { ForgotPasswordForm } from "./forgot-password-form";
import { ResetPasswordForm } from "./reset-password-form";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("../api/auth.api", () => ({
  authApi: { forgotPassword: vi.fn(), resetPassword: vi.fn(), logout: vi.fn() },
}));

const GENERIC = "If an account exists for this email, password reset instructions have been sent.";
const TOKEN = "A".repeat(43);

describe("ForgotPasswordForm", () => {
  it("submits the email and shows the generic confirmation", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue(GENERIC);
    renderWithClient(<ForgotPasswordForm />);

    await userEvent.type(screen.getByLabelText("Email"), "grace@garment.test");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("status")).toHaveTextContent(GENERIC);
    expect(vi.mocked(authApi.forgotPassword).mock.calls[0]?.[0]).toEqual({ email: "grace@garment.test" });
  });

  it("validates the email", async () => {
    renderWithClient(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText("Email"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(authApi.forgotPassword).not.toHaveBeenCalled();
  });
});

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", `/reset-password#token=${TOKEN}`);
  });

  it("reads the token from the fragment and strips it from the address bar", async () => {
    renderWithClient(<ResetPasswordForm />);
    await screen.findByLabelText("New password");
    expect(window.location.hash).toBe("");
  });

  it("validates length and confirmation", async () => {
    renderWithClient(<ResetPasswordForm />);
    await userEvent.type(await screen.findByLabelText("New password"), "short");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "different");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("Use at least 12 characters.")).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(authApi.resetPassword).not.toHaveBeenCalled();
  });

  it("submits the token with the new password", async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue();
    renderWithClient(<ResetPasswordForm />);
    await userEvent.type(await screen.findByLabelText("New password"), "a brand new passphrase");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "a brand new passphrase");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("Password updated")).toBeInTheDocument();
    expect(vi.mocked(authApi.resetPassword).mock.calls[0]?.[0]).toEqual({
      token: TOKEN,
      newPassword: "a brand new passphrase",
    });
  });

  it("shows the invalid-link state for an expired or used token", async () => {
    vi.mocked(authApi.resetPassword).mockRejectedValue(
      new ApiError(400, "TOKEN_INVALID", "This link is invalid or has expired."),
    );
    renderWithClient(<ResetPasswordForm />);
    await userEvent.type(await screen.findByLabelText("New password"), "a brand new passphrase");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "a brand new passphrase");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("This link is invalid or has expired")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
  });

  it("shows the invalid-link state when the link has no token", async () => {
    window.history.replaceState(null, "", "/reset-password");
    renderWithClient(<ResetPasswordForm />);
    expect(await screen.findByText("This link is invalid or has expired")).toBeInTheDocument();
  });
});

describe("useLogout", () => {
  it("clears the cached user and redirects to login, even if the request fails", async () => {
    vi.mocked(authApi.logout).mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "offline"));
    const client = new QueryClient();
    client.setQueryData(["auth", "me"], { id: "u1" });
    client.setQueryData(["users", "list"], [{ id: "u2" }]);

    const { result } = renderHook(() => useLogout(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    result.current.mutate();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(client.getQueryData(["auth", "me"])).toBeNull();
    expect(client.getQueryData(["users", "list"])).toBeUndefined();
  });
});
