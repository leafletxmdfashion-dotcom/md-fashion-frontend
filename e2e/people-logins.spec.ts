import { expect, test } from "@playwright/test";

import { login } from "./helpers";

// A person added with a login: phone only, a password the admin sets and hands over.
// They sign in with the phone, must choose their own password first, then see only what
// their role allows plus their own ledger.
test("an admin adds a karigar with a phone login; they change the password and see their ledger", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/karigar");
  await page.getByRole("button", { name: "Add person" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New staff or karigar" });
  await dialog.getByLabel("Name").fill("Mina Phone");
  await dialog.getByLabel("Category").click();
  await page.getByRole("option", { name: "Tailor" }).click();

  await dialog.getByRole("radio", { name: "Create login" }).click();
  await dialog.getByRole("textbox", { name: "Phone" }).last().fill("98111 22333");
  // Karigar is suggested for a tailor; the preview names what the role allows.
  await expect(dialog.getByLabel("Role")).toContainText("Karigar");
  await expect(dialog.getByText("No other permissions: they see only their own ledger.")).toBeVisible();
  await dialog.getByRole("radio", { name: "Set it now" }).click();
  await dialog.getByLabel("Temporary password").fill("handover phrase 2026");
  await dialog.getByRole("button", { name: "Save and create login" }).click();

  const done = page.getByRole("dialog", { name: "Login for Mina Phone" });
  const details = done.getByLabel("Sign-in details", { exact: true });
  await expect(details).toContainText("98111 22333");
  await expect(details).toContainText("handover phrase 2026");
  await done.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("row", { name: /Mina Phone/ })).toContainText("login 9811122333");

  const context = await browser.newContext();
  const mina = await context.newPage();
  await mina.goto("/login");
  await login(mina, "9811122333", "handover phrase 2026");
  await expect(mina.getByRole("heading", { name: "Choose your own password" })).toBeVisible();
  await mina.getByLabel("Current password").fill("handover phrase 2026");
  await mina.getByLabel("New password", { exact: true }).fill("mina own passphrase");
  await mina.getByLabel("Confirm new password").fill("mina own passphrase");
  await mina.getByRole("button", { name: /change password|update password|save/i }).click();

  await expect(
    mina.locator("[data-sidebar=sidebar]").first().getByRole("link", { name: "My Ledger", exact: true }),
  ).toBeVisible();
  await mina.goto("/my-ledger");
  await expect(mina.getByText(/Mina Phone · K-\d{3}/)).toBeVisible();
  await mina.goto("/karigar/payments");
  await expect(mina.getByText("You don't have access to this page")).toBeVisible();
  await context.close();
});
