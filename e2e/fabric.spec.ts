import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("add purchase by fabric name, adjustment, ledger and reversal work end to end", async ({ page }) => {
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  // A first purchase names a new fabric: it is created with a generated code.
  await page.goto("/fabric/purchases");
  await page.getByRole("button", { name: "Add purchase" }).first().click();
  const purchase = page.getByRole("dialog", { name: "Add purchase" });
  await purchase.getByLabel("Fabric name").fill("Cotton Jersey");
  await expect(purchase.getByText("New fabric · its code is assigned when you save")).toBeVisible();
  await expect(purchase.getByLabel("Fabric description")).toHaveCount(0);
  await purchase.getByLabel("Quantity").fill("120");
  await purchase.getByLabel("Rate").fill("450");
  await purchase.getByLabel("Reorder level").fill("50");
  await purchase.getByLabel("Supplier").fill("Sunrise Knits");
  await purchase.getByLabel("Invoice / bill no.").fill("INV-2401");
  await expect(purchase.getByText("Rs 54,000.00")).toBeVisible();
  await purchase.getByRole("button", { name: "Add purchase" }).click();
  await expect(page.getByText(/FI-0001 added: 120 kg of Cotton Jersey \(new fabric FAB-\d{4}\)/)).toBeVisible();
  await expect(purchase).toBeHidden();

  // The same name in another case is the same fabric: its unit and reorder level come along.
  await page.getByRole("button", { name: "Add purchase" }).first().click();
  await purchase.getByLabel("Fabric name").fill("cotton jers");
  await page.getByRole("option", { name: "Cotton Jersey" }).click();
  await expect(purchase.getByText(/Existing fabric · FAB-\d{4} · 120 kg in stock/)).toBeVisible();
  await expect(purchase.getByLabel("Reorder level")).toHaveValue("50");
  await expect(purchase.getByRole("radio", { name: "Meter" })).toBeDisabled();
  await purchase.getByLabel("Quantity").fill("40");
  await purchase.getByLabel("Rate").fill("450");
  await purchase.getByRole("button", { name: "Add purchase" }).click();
  await expect(purchase).toBeHidden();
  const rows = page.getByRole("row").filter({ hasText: "Cotton Jersey" });
  await expect(rows).toHaveCount(2);

  // Adjustments live on this page too, and cannot exceed stock.
  await page.getByRole("button", { name: "Adjust stock" }).click();
  const adjust = page.getByRole("dialog", { name: "Adjust stock" });
  await adjust.getByLabel("Fabric", { exact: true }).click();
  await adjust.getByLabel("Fabric", { exact: true }).fill("Cotton");
  await page.getByRole("option", { name: /Cotton Jersey/ }).click();
  await expect(adjust).toContainText("160 kg");
  await adjust.getByLabel("Quantity").fill("200");
  await adjust.getByLabel("Reason").fill("Damaged during handling");
  await adjust.getByRole("button", { name: "Post adjustment" }).click();
  await expect(adjust.getByText("Only 160 kg is in stock.")).toBeVisible();
  await adjust.getByLabel("Quantity").fill("10");
  await adjust.getByRole("button", { name: "Post adjustment" }).click();
  await expect(adjust).toBeHidden();

  // Ledger for the fabric, newest first with running balance.
  await rows.first().getByRole("button", { name: "Row actions" }).click();
  await page.getByRole("menuitem", { name: "Open fabric ledger" }).click();
  await expect(page).toHaveURL(/\/fabric\/ledger\?fabric=/);
  const ledgerRows = page.getByRole("row").filter({ hasText: /Purchase|Adjustment/ });
  await expect(ledgerRows).toHaveCount(3);
  await expect(ledgerRows.first()).toContainText("Adjustment −");
  await expect(ledgerRows.first()).toContainText("150 kg");
  const fabricStats = page.getByLabel(/Movement summary/);
  await expect(fabricStats).toContainText("In stock now");
  await expect(fabricStats).toContainText("150 kg");
  // No duplicate action card here: adjust and purchase live on Purchase / Inward.
  await expect(page.getByRole("button", { name: "Adjust stock" })).toHaveCount(0);

  // All fabrics: activity and stock value.
  await page.goto("/fabric/ledger");
  const allStats = page.getByLabel("Ledger summary");
  await expect(allStats).toContainText("Movements");
  await expect(allStats).toContainText("+160 kg");
  await expect(allStats).toContainText("−10 kg");

  // Reverse the second purchase from the register.
  await page.goto("/fabric/purchases");
  await page.getByLabel("Search purchases").fill("FI-0002");
  await expect(rows).toHaveCount(1);
  await rows.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("FI-0002");
  await sheet.getByRole("button", { name: "Reverse purchase" }).click();
  await sheet.getByLabel("Reason").fill("Wrong roll entered");
  await sheet.getByRole("button", { name: "Reverse purchase" }).click();
  await expect(page.getByText("FI-0002 reversed")).toBeVisible();
  await expect(rows).toContainText("Reversed");

  // The old Fabric Master address now opens Stock & Ledger.
  await page.goto("/fabric");
  await expect(page).toHaveURL(/\/fabric\/ledger$/);
  await page.getByLabel("Fabric", { exact: true }).click();
  await page.getByLabel("Fabric", { exact: true }).fill("Cotton");
  await page.getByRole("option", { name: /Cotton Jersey/ }).click();
  await expect(page.getByLabel(/Movement summary/)).toContainText("110 kg");
});

test("a misspelt fabric is renamed from the ledger, and later purchases of the right name add to it", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/fabric/purchases");
  await page.getByRole("button", { name: "Add purchase" }).first().click();
  const purchase = page.getByRole("dialog", { name: "Add purchase" });
  await purchase.getByLabel("Fabric name").fill("Lycra Jersy");
  await purchase.getByLabel("Quantity").fill("20");
  await purchase.getByLabel("Rate").fill("300");
  await purchase.getByRole("button", { name: "Add purchase" }).click();
  await expect(purchase).toBeHidden();

  const row = page.getByRole("row").filter({ hasText: "Lycra Jersy" });
  await row.getByRole("button", { name: "Row actions" }).click();
  await page.getByRole("menuitem", { name: "Open fabric ledger" }).click();
  await page.getByRole("button", { name: "Edit fabric" }).click();
  const edit = page.getByRole("dialog", { name: "Edit fabric" });
  await expect(edit.getByRole("radio", { name: "Meter" })).toBeDisabled();
  await edit.getByLabel("Fabric name").fill("Lycra Jersey");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Lycra Jersey updated.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lycra Jersey" })).toBeVisible();

  await page.goto("/fabric/purchases");
  await page.getByRole("button", { name: "Add purchase" }).first().click();
  await purchase.getByLabel("Fabric name").fill("lycra jersey");
  await expect(purchase.getByText(/Existing fabric · FAB-\d{4} · 20 kg in stock/)).toBeVisible();
});

test("staff can add purchases but not adjust stock", async ({ page }) => {
  await page.goto("/login");
  await login(page, "staff@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/fabric/purchases");
  await expect(page.getByRole("button", { name: "Add purchase" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Adjust stock" })).toHaveCount(0);
  await page.goto("/fabric/ledger");
  await page.getByLabel("Fabric", { exact: true }).click();
  await page.getByRole("option").first().click();
  await expect(page.getByLabel(/Movement summary/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit fabric" })).toHaveCount(0);
});

test("purchase register pages, resizes, searches and keeps filters in the URL", async ({ page }) => {
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.evaluate(async () => {
    const csrf = ((await (await fetch("/api/v1/auth/csrf")).json()) as { data: { csrfToken: string } }).data.csrfToken;
    const post = async (url: string, body: object) =>
      (await (
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          body: JSON.stringify(body),
        })
      ).json()) as { data: { fabric: { id: string } } };
    const today = new Date().toISOString().slice(0, 10);
    for (let index = 1; index <= 30; index += 1) {
      await post("/api/v1/fabrics/inwards", {
        fabricName: "Paging Rib",
        unit: "KG",
        inwardDate: today,
        quantity: index,
        rate: 10,
        invoiceRef: `PG-${String(index).padStart(3, "0")}`,
      });
    }
  });

  await page.goto("/fabric/purchases?fabric=");
  const pagination = page.getByRole("navigation", { name: "Pagination" });
  await expect(pagination).toContainText(/1–25 of \d+/);

  await pagination.getByRole("combobox", { name: "Rows per page" }).click();
  await page.getByRole("option", { name: "10", exact: true }).click();
  await expect(pagination).toContainText(/1–10 of \d+/);
  await expect(page).toHaveURL(/size=10/);
  await pagination.getByRole("button", { name: "Next page" }).click();
  await expect(pagination).toContainText(/11–20 of \d+/);
  await expect(page).toHaveURL(/page=2/);

  // Typing is debounced into one request; a new search returns to page 1.
  await page.getByLabel("Search purchases").fill("pg-030");
  await expect(page.getByRole("row").filter({ hasText: "Paging Rib" })).toHaveCount(1);
  await expect(page).toHaveURL(/q=pg-030/);
  await expect(page).not.toHaveURL(/page=2/);

  await page.reload();
  await expect(page.getByLabel("Search purchases")).toHaveValue("pg-030");
  await expect(page.getByRole("row").filter({ hasText: "Paging Rib" })).toHaveCount(1);
});

test("the command palette finds pages and fabrics and runs actions", async ({ page }) => {
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog");
  await palette.getByRole("combobox").fill("ledger");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/fabric\/ledger$/);

  await page.keyboard.press("Control+k");
  await palette.getByRole("combobox").fill("paging");
  await expect(palette.getByRole("option", { name: /Paging Rib/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/fabric\/ledger\?fabric=/);
  await expect(page.getByRole("heading", { name: "Paging Rib" })).toBeVisible();

  await page.keyboard.press("Control+k");
  await palette.getByRole("combobox").fill("add fabric purchase");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Add purchase" })).toBeVisible();
});
