import { expect, test } from "@playwright/test";

import { E2E } from "./env";
import { login } from "./helpers";

// Only session problems sign the user out (expired, revoked, idle, logged out
// elsewhere), always onto the login page with a reason. Server and network
// failures never do.

const serverError = {
  status: 500,
  contentType: "application/json",
  body: JSON.stringify({ success: false, error: { code: "INTERNAL_ERROR", message: "Database unavailable" } }),
};

function hasSessionCookie(cookies: { name: string }[]): boolean {
  return cookies.some((cookie) => cookie.name.endsWith("gm_session"));
}

test.describe("session", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await login(page, "staff@garment.test");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("a server error on first load shows a reconnecting screen, not a sign-out", async ({ page, context }) => {
    await page.route("**/api/v1/auth/me", (route) => route.fulfill(serverError));
    await page.goto("/fabric");

    await expect(page.getByRole("heading", { name: "Can't reach the server" })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/You are still signed in/)).toBeVisible();
    await expect(page).toHaveURL(/\/fabric$/);
    expect(hasSessionCookie(await context.cookies())).toBe(true);

    // Server back: one click (or the automatic retry) restores the page.
    await page.unroute("**/api/v1/auth/me");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "Fabric Master" })).toBeVisible();
  });

  test("an unreachable API does not sign the user out", async ({ page, context }) => {
    await page.route("**/api/v1/**", (route) => route.abort("connectionrefused"));
    await page.goto("/fabric/purchases");
    await expect(page.getByRole("heading", { name: "Can't reach the server" })).toBeVisible({ timeout: 5_000 });
    expect(hasSessionCookie(await context.cookies())).toBe(true);
  });

  test("server errors while working stay on the page with a retry", async ({ page }) => {
    await page.goto("/fabric");
    await expect(page.getByRole("heading", { name: "Fabric Master" })).toBeVisible();

    await page.route("**/api/v1/fabrics?**", (route) => route.fulfill(serverError));
    await page.getByPlaceholder(/Search/).first().fill("denim");
    await expect(page.getByRole("button", { name: /Try again|Retry/ }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/fabric/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("a session revoked from another device signs out on the next request", async ({ page, request }) => {
    await page.goto("/fabric");

    // Another device (its own cookie jar) signs in and chooses "Sign out everywhere".
    const origin = new URL(page.url()).origin;
    const csrf = async () =>
      ((await (await request.get("/api/v1/auth/csrf")).json()) as { data: { csrfToken: string } }).data.csrfToken;
    const signIn = await request.post("/api/v1/auth/login", {
      headers: { "X-CSRF-Token": await csrf(), Origin: origin },
      data: { email: "staff@garment.test", password: E2E.password },
    });
    expect(signIn.status()).toBe(200);
    const everywhere = await request.post("/api/v1/auth/logout-all", {
      headers: { "X-CSRF-Token": signIn.headers()["x-csrf-token"] ?? (await csrf()), Origin: origin },
    });
    expect(everywhere.status()).toBe(200);

    // This browser still holds its (now dead) cookie; its next API call is refused.
    await page.getByPlaceholder(/Search/).first().fill("denim");
    await expect(page).toHaveURL(/reason=expired$/);
    await expect(page.getByText("Your session has ended. Please log in again.")).toBeVisible();
  });

  test("logging out in one tab logs out the other tabs", async ({ page, context }) => {
    const other = await context.newPage();
    await other.goto("/fabric");
    await expect(other.getByRole("heading", { name: "Fabric Master" })).toBeVisible();

    await page.getByRole("button", { name: /Sam Staff/ }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();

    await expect(other).toHaveURL(/reason=elsewhere$/);
    await expect(other.getByText("You were logged out in another tab.")).toBeVisible();
    expect(hasSessionCookie(await context.cookies())).toBe(false);
  });
});
