import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { renderWithClient } from "@/test/render";

import { authApi } from "../api/auth.api";
import { signOut } from "../lib/sign-out";
import type { CurrentUser } from "../types/auth.types";
import { AuthGuard } from "./auth-guard";

vi.mock("../api/auth.api", () => ({ authApi: { getCurrentUser: vi.fn() } }));
vi.mock("../lib/sign-out", () => ({ signOut: vi.fn() }));

const lastActivity = vi.hoisted(() => ({ value: Date.now() }));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  lastServerActivity: () => lastActivity.value,
}));

const HOUR = 3_600_000;

function userWith(session: Partial<CurrentUser["session"]> = {}): CurrentUser {
  return {
    id: "u1",
    email: "ada@garment.test",
    name: "Ada",
    status: "ACTIVE",
    role: { key: "OWNER", name: "Owner" },
    permissions: ["dashboard.view"],
    session: { expiresAt: new Date(Date.now() + HOUR).toISOString(), idleTimeoutMinutes: 120, ...session },
  };
}

const Protected = () => <p>Quarterly margins</p>;

function renderGuard() {
  return renderWithClient(
    <AuthGuard>
      <Protected />
    </AuthGuard>,
  );
}

function tabBecomesVisible() {
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  vi.mocked(signOut).mockReset();
  lastActivity.value = Date.now();
});

describe("AuthGuard", () => {
  it("renders protected content for an authenticated user", async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(userWith());
    renderGuard();
    expect(await screen.findByText("Quarterly margins")).toBeInTheDocument();
    tabBecomesVisible();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("does not flash protected content while the session is being checked", () => {
    vi.mocked(authApi.getCurrentUser).mockReturnValue(new Promise(() => {}));
    renderGuard();
    expect(screen.queryByText("Quarterly margins")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading workspace");
  });

  it("signs out with the reason when the session has ended", async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(null);
    renderGuard();
    await waitFor(() => expect(signOut).toHaveBeenCalledWith("expired"));
    expect(screen.queryByText("Quarterly margins")).not.toBeInTheDocument();
  });

  it("does not sign out when the server fails: it shows a reconnecting screen", async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "boom"));
    renderGuard();
    expect(await screen.findByRole("heading", { name: "Can't reach the server" })).toBeInTheDocument();
    expect(screen.getByText(/You are still signed in/)).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("recovers when the server is back after Try again", async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "offline"));
    vi.mocked(authApi.getCurrentUser).mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "offline"));
    renderGuard();
    await screen.findByRole("heading", { name: "Can't reach the server" });

    vi.mocked(authApi.getCurrentUser).mockResolvedValue(userWith());
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Quarterly margins")).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("keeps a signed-in user working when a later session check fails", async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(userWith());
    const { client } = renderGuard();
    await screen.findByText("Quarterly margins");

    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new ApiError(503, "INTERNAL_ERROR", "down"));
    await act(() => client.refetchQueries({ queryKey: ["auth", "me"] }));
    expect(screen.getByText("Quarterly margins")).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("hides content immediately when the session ends mid-use", async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(userWith());
    const { client } = renderGuard();
    await screen.findByText("Quarterly margins");

    act(() => client.setQueryData(["auth", "me"], null));
    await waitFor(() => expect(screen.queryByText("Quarterly margins")).not.toBeInTheDocument());
    expect(signOut).toHaveBeenCalledWith("expired");
  });

  it("signs out at the session's absolute expiry", async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(userWith({ expiresAt: new Date(Date.now() - 1).toISOString() }));
    renderGuard();
    await screen.findByText("Quarterly margins");
    tabBecomesVisible();
    expect(signOut).toHaveBeenCalledWith("expired");
  });

  it("warns before an inactivity sign-out and lets the user stay", async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(userWith({ idleTimeoutMinutes: 120 }));
    renderGuard();
    await screen.findByText("Quarterly margins");

    // 118 minutes idle: the sign-out is due at 119 (a minute early), so this is
    // inside the two-minute warning window.
    lastActivity.value = Date.now() - 118 * 60_000;
    tabBecomesVisible();
    expect(await screen.findByRole("dialog", { name: "Are you still there?" })).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();

    // "Stay signed in" pings the server; that response counts as fresh activity.
    vi.mocked(authApi.getCurrentUser).mockImplementation(() => {
      lastActivity.value = Date.now();
      return Promise.resolve(userWith());
    });
    await userEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
    tabBecomesVisible();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs out (revoking the session) once the API has been idle past the timeout", async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(userWith({ idleTimeoutMinutes: 120 }));
    renderGuard();
    await screen.findByText("Quarterly margins");

    lastActivity.value = Date.now() - 2 * HOUR;
    tabBecomesVisible();
    expect(signOut).toHaveBeenCalledWith("idle", { revoke: true });
  });
});
