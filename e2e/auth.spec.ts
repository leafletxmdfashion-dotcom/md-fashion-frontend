import { expect, test } from "@playwright/test";

import { E2E } from "./env";
import { latestMailLink, login } from "./helpers";

test.describe("authentication", () => {
  test("unauthenticated visitors are sent to login and returned afterwards", async ({ page }) => {
    await page.goto("/users");
    await expect(page).toHaveURL(/\/login\?next=%2Fusers$/);

    await login(page, "owner@garment.test", "definitely the wrong password");
    await expect(page.getByText("Invalid email or password.")).toBeVisible();

    await login(page, "owner@garment.test");
    await expect(page).toHaveURL(/\/users$/);
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByRole("cell", { name: /staff@garment\.test/ })).toBeVisible();
  });

  test("session cookie is HttpOnly and never exposed to scripts", async ({ page, context }) => {
    await page.goto("/login");
    await login(page, "owner@garment.test");
    await expect(page).toHaveURL(/\/dashboard$/);

    const session = (await context.cookies()).find((cookie) => cookie.name === "gm_session");
    expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
    expect(await page.evaluate(() => document.cookie)).not.toContain("gm_session");
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(
      session!.value,
    );
  });

  test("navigation is filtered by permission and the API still enforces access", async ({ page }) => {
    await page.goto("/login");
    await login(page, "staff@garment.test");
    await expect(page).toHaveURL(/\/dashboard$/);

    const sidebar = page.locator("[data-sidebar=sidebar]").first();
    await expect(sidebar.getByRole("link", { name: "Fabric Master" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Users" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "Settings" })).toHaveCount(0);

    await page.goto("/users");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
    const api = await page.request.get("/api/v1/users");
    expect(api.status()).toBe(403);
  });

  test("logout ends the server session", async ({ page }) => {
    await page.goto("/login");
    await login(page, "staff@garment.test");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", { name: /Sam Staff/ }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    expect((await page.request.get("/api/v1/auth/me")).status()).toBe(401);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("an already signed-in user visiting /login goes to the dashboard", async ({ page }) => {
    await page.goto("/login");
    await login(page, "staff@garment.test");
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("forgot and reset password, then sign in with the new password", async ({ page }) => {
    const email = "reset@garment.test";
    const newPassword = "a freshly chosen passphrase";
    const requestedAt = Date.now();

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account exists for this email");

    const link = await latestMailLink(email, requestedAt);
    await page.goto(link.replace(/^https?:\/\/[^/]+/, E2E.appUrl));
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");

    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();

    await page.getByRole("link", { name: "Log in" }).click();
    await login(page, email, newPassword);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("an owner invites a member who accepts and signs in", async ({ page, browser }) => {
    await page.goto("/login");
    await login(page, "owner@garment.test");
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/users");

    await page.getByRole("button", { name: "Invite member" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email").fill("new.hire@garment.test");
    await dialog.getByLabel("Name").fill("Nia New");
    await dialog.getByLabel("Role").click();
    await page.getByRole("option", { name: "Staff" }).click();
    await dialog.getByRole("button", { name: "Send invitation" }).click();
    const inviteUrl = await dialog.getByLabel("Invitation link", { exact: true }).inputValue();
    expect(inviteUrl).toMatch(/\/accept-invitation#token=/);

    const invitee = await browser.newContext();
    const invitePage = await invitee.newPage();
    await invitePage.goto(inviteUrl);
    await expect(invitePage.getByRole("heading", { name: "Join MD Fashion" })).toBeVisible();
    await invitePage.getByLabel("Password", { exact: true }).fill("my brand new passphrase");
    await invitePage.getByLabel("Confirm password").fill("my brand new passphrase");
    await invitePage.getByRole("button", { name: "Activate account" }).click();
    await expect(invitePage.getByRole("heading", { name: "Your account is ready" })).toBeVisible();

    await invitePage.getByRole("link", { name: "Log in" }).click();
    await login(invitePage, "new.hire@garment.test", "my brand new passphrase");
    await expect(invitePage).toHaveURL(/\/dashboard$/);
    await invitee.close();
  });
});
