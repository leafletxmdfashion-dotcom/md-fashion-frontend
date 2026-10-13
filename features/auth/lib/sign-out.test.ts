import { beforeEach, describe, expect, it, vi } from "vitest";

const logout = vi.fn();
vi.mock("../api/auth.api", () => ({ authApi: { logout: () => logout() } }));

const replace = vi.fn();
const fetchMock = vi.fn();

async function load() {
  vi.resetModules();
  return import("./sign-out");
}

beforeEach(() => {
  logout.mockReset();
  replace.mockReset();
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { pathname: "/fabric/purchases", search: "?q=denim", replace },
  });
});

describe("signOut", () => {
  it("returns to the interrupted page with the reason, after clearing the cookie locally", async () => {
    const { signOut } = await load();
    await signOut("expired");
    expect(logout).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/session/end", expect.objectContaining({ method: "POST" }));
    expect(replace).toHaveBeenCalledWith("/login?next=%2Ffabric%2Fpurchases%3Fq%3Ddenim&reason=expired");
  });

  it("revokes on the server when asked, and needs no local fallback when that works", async () => {
    logout.mockResolvedValue(undefined);
    const { signOut } = await load();
    await signOut("idle", { revoke: true });
    expect(logout).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still clears the cookie when the server cannot be reached", async () => {
    logout.mockRejectedValue(new Error("offline"));
    const { signOut } = await load();
    await signOut("idle", { revoke: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledOnce();
  });

  it("a deliberate sign-out does not return to the previous page", async () => {
    const { signOut } = await load();
    await signOut("signed-out");
    expect(replace).toHaveBeenCalledWith("/login?reason=signed-out");
  });

  it("collapses a burst of calls (many 401s at once) into one sign-out", async () => {
    const { signOut } = await load();
    await Promise.all([signOut("expired"), signOut("expired"), signOut("idle")]);
    expect(replace).toHaveBeenCalledOnce();
  });
});
