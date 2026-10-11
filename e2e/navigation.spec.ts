import { expect, test } from "@playwright/test";

import { navigation } from "../config/navigation";
import { login } from "./helpers";

test.describe("navigation", () => {
  test("every sidebar item opens its page and marks itself active", async ({ page }) => {
    await page.goto("/login");
    await login(page, "owner@garment.test");
    await expect(page).toHaveURL(/\/dashboard$/);

    const sidebar = page.locator("[data-sidebar=sidebar]").first();
    for (const item of navigation.flatMap((group) => group.items)) {
      await sidebar.getByRole("link", { name: item.title, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${item.href}$`));
      await expect(sidebar.locator("[data-active]")).toHaveText(item.title);
    }
  });

  test("unknown paths inside the app are not found", async ({ page }) => {
    await page.goto("/login");
    await login(page, "owner@garment.test");
    await expect(page).toHaveURL(/\/dashboard$/);

    // Status stays 200: the app shell has already streamed (see Next's notFound docs).
    await page.goto("/no-such-module");
    await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  });
});

test("the mobile menu closes after choosing a page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  const menu = page.getByRole("dialog");
  await menu.getByRole("link", { name: "Cutting", exact: true }).click();
  await expect(page).toHaveURL(/\/cutting$/);
  await expect(menu).toBeHidden();
});
