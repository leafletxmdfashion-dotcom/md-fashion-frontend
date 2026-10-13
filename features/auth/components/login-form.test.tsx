import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { renderWithClient } from "@/test/render";

import { authApi } from "../api/auth.api";
import type { CurrentUser } from "../types/auth.types";
import { LoginForm } from "./login-form";

const replace = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("../api/auth.api", () => ({
  authApi: { getCurrentUser: vi.fn(), login: vi.fn() },
}));

const user: CurrentUser = {
  id: "u1",
  email: "ada@garment.test",
  name: "Ada",
  status: "ACTIVE",
  role: { key: "STAFF", name: "Staff" },
  permissions: ["dashboard.view"],
  session: { expiresAt: new Date(Date.now() + 3_600_000).toISOString(), idleTimeoutMinutes: 120 },
};

async function fillAndSubmit(email = "ada@garment.test", password = "correct horse battery staple") {
  await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
}

beforeEach(() => {
  search = "";
  vi.mocked(authApi.getCurrentUser).mockResolvedValue(null);
});

describe("LoginForm", () => {
  it("validates input before calling the API", async () => {
    renderWithClient(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it("uses the right autocomplete hints and does not block paste", () => {
    renderWithClient(<LoginForm />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(password).not.toHaveAttribute("onpaste");
  });

  it("toggles password visibility", async () => {
    renderWithClient(<LoginForm />);
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("shows a loading state and disables submit while signing in", async () => {
    let resolve!: (value: CurrentUser) => void;
    vi.mocked(authApi.login).mockReturnValue(new Promise((r) => (resolve = r)));
    renderWithClient(<LoginForm />);

    await fillAndSubmit();
    const button = await screen.findByRole("button", { name: /Signing in/ });
    expect(button).toBeDisabled();

    resolve(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows the API error and clears the password", async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiError(401, "AUTH_INVALID_CREDENTIALS", "Invalid email or password."),
    );
    renderWithClient(<LoginForm />);

    await fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to the validated return destination after login", async () => {
    search = "next=%2Fusers%3Ftab%3Dinvited";
    vi.mocked(authApi.login).mockResolvedValue(user);
    renderWithClient(<LoginForm />);

    await fillAndSubmit();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/users?tab=invited"));
  });

  it("ignores an external return destination (open redirect)", async () => {
    search = "next=https%3A%2F%2Fevil.example";
    vi.mocked(authApi.login).mockResolvedValue(user);
    renderWithClient(<LoginForm />);

    await fillAndSubmit();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("redirects an already signed-in user away from the login page", async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(user);
    renderWithClient(<LoginForm />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("explains why the user was signed out", async () => {
    search = "reason=idle";
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(null);
    renderWithClient(<LoginForm />);
    expect(await screen.findByRole("status")).toHaveTextContent("logged out after a period of inactivity");
  });

  it("ignores an unknown reason", async () => {
    search = "reason=<script>";
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(null);
    renderWithClient(<LoginForm />);
    await screen.findByLabelText("Email");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
