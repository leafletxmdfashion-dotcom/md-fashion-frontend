import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithClient } from "@/test/render";

import { authApi } from "../api/auth.api";
import type { CurrentUser } from "../types/auth.types";
import { AuthGuard } from "./auth-guard";

const replace = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("../api/auth.api", () => ({ authApi: { getCurrentUser: vi.fn() } }));

const user: CurrentUser = {
  id: "u1",
  email: "ada@garment.test",
  name: "Ada",
  status: "ACTIVE",
  role: { key: "OWNER", name: "Owner" },
  permissions: ["dashboard.view"],
};

const Protected = () => <p>Quarterly margins</p>;

beforeEach(() => {
  window.history.replaceState(null, "", "/orders?status=open");
});

describe("AuthGuard", () => {
  it("renders protected content for an authenticated user", async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(user);
    renderWithClient(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(await screen.findByText("Quarterly margins")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not flash protected content while the session is being checked", () => {
    vi.mocked(authApi.getCurrentUser).mockReturnValue(new Promise(() => {}));
    renderWithClient(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(screen.queryByText("Quarterly margins")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading workspace");
  });

  it("redirects an unauthenticated visitor to login, preserving the destination", async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(null);
    renderWithClient(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Forders%3Fstatus%3Dopen"));
    expect(screen.queryByText("Quarterly margins")).not.toBeInTheDocument();
  });

  it("hides content immediately when the session ends mid-use", async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(user);
    const { client } = renderWithClient(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    await screen.findByText("Quarterly margins");

    // What the global 401 handler does when any API call reports AUTH_UNAUTHENTICATED.
    client.setQueryData(["auth", "me"], null);
    await waitFor(() => expect(screen.queryByText("Quarterly margins")).not.toBeInTheDocument());
    expect(replace).toHaveBeenCalled();
  });
});
