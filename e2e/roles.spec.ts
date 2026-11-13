import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("an owner creates a custom role, invites staff with it, and they see only what it allows", async ({
  page,
  browser,
}) => {
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  // A role named after the job, starting from Viewer, then given purchase rights.
  await page.goto("/roles");
  await page.getByRole("button", { name: "New role" }).click();
  const create = page.getByRole("dialog", { name: "New role" });
  await create.getByLabel("Role name").fill("Fabric Clerk");
  await create.getByLabel("Start with the permissions of").click();
  await page.getByRole("option", { name: "Viewer" }).click();
  await create.getByRole("button", { name: "Create role" }).click();
  await expect(page.getByText("Role Fabric Clerk created")).toBeVisible();

  const editor = page.getByRole("region", { name: "Fabric Clerk permissions" });
  const fabric = editor.getByRole("group", { name: "Fabric" });
  await expect(fabric.getByRole("checkbox", { name: /^View Purchases/ })).toBeChecked();
  // Store keepers handle fabric only: no cutting, stitching or workers.
  for (const group of ["Cutting", "Stitching", "Staff & Karigar"]) {
    await editor
      .getByRole("group", { name: group })
      .getByRole("checkbox", { name: /^View / })
      .click();
    await expect(editor.getByRole("checkbox", { name: `All ${group} permissions` })).not.toBeChecked();
  }
  await fabric.getByRole("checkbox", { name: /^Add purchases/ }).click();
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Fabric Clerk saved")).toBeVisible();

  // Built-in roles cannot be deleted; the Owner role is read-only.
  await page
    .getByRole("navigation", { name: "Roles" })
    .getByRole("button", { name: /^Owner/ })
    .click();
  await expect(page.getByText("The Owner always has every permission and cannot be changed.")).toBeVisible();

  // Invite a store keeper.
  await page.goto("/users");
  await page.getByRole("button", { name: "Add login" }).click();
  const invite = page.getByRole("dialog");
  await invite.getByLabel("Email", { exact: true }).fill("fabric.clerk@garment.test");
  await invite.getByLabel("Name").fill("Sam Store");
  await invite.getByLabel("Role").click();
  await page.getByRole("option", { name: "Fabric Clerk" }).click();
  await invite.getByRole("button", { name: "Create login" }).click();
  const inviteUrl = await invite.getByLabel("Invitation link", { exact: true }).inputValue();

  const keeperContext = await browser.newContext();
  const keeper = await keeperContext.newPage();
  await keeper.goto(inviteUrl);
  await keeper.getByLabel("Password", { exact: true }).fill("store keeper passphrase");
  await keeper.getByLabel("Confirm password").fill("store keeper passphrase");
  await keeper.getByRole("button", { name: "Activate account" }).click();
  await keeper.getByRole("link", { name: "Log in" }).click();
  await login(keeper, "fabric.clerk@garment.test", "store keeper passphrase");
  await expect(keeper).toHaveURL(/\/dashboard$/);

  const sidebar = keeper.locator("[data-sidebar=sidebar]").first();
  await expect(sidebar.getByRole("link", { name: "Purchase / Inward" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Cutting" })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Stitching" })).toHaveCount(0);

  await keeper.goto("/fabric/purchases");
  await expect(keeper.getByRole("button", { name: "Add purchase" }).first()).toBeVisible();
  await expect(keeper.getByRole("button", { name: "Adjust stock" })).toHaveCount(0);

  // A role somebody holds cannot be deleted.
  await page.goto("/roles?role=FABRIC_CLERK");
  await expect(
    page.getByRole("region", { name: "Fabric Clerk permissions" }).getByRole("button", { name: "Delete" }),
  ).toBeDisabled();
  await keeperContext.close();
});

test("staff see roles read-only and cannot reach role editing", async ({ page }) => {
  await page.goto("/login");
  await login(page, "staff@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/roles");
  await expect(page.getByRole("button", { name: "New role" })).toHaveCount(0);
});
