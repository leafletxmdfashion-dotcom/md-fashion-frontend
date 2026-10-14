import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("fabric master, purchase, adjustment, ledger and reversal work end to end", async ({ page }) => {
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  // Fabric master: create.
  await page.goto("/fabric");
  await page.getByRole("button", { name: "New fabric" }).first().click();
  const fabricForm = page.getByRole("dialog");
  await fabricForm.getByLabel("Name").fill("Cotton Jersey");
  await fabricForm.getByLabel("Code").fill("fb-ctj");
  await fabricForm.getByLabel("Unit").click();
  await page.getByRole("option", { name: "Kilogram" }).click();
  await fabricForm.getByLabel("Reorder level").fill("50");
  await fabricForm.getByRole("button", { name: "Add fabric" }).click();
  await expect(fabricForm).toBeHidden();
  const row = page.getByRole("row", { name: /Cotton Jersey/ });
  await expect(row).toContainText("FB-CTJ");
  await expect(row).toContainText("0 kg");

  // Two purchases on one invoice, one entry each.
  await row.getByRole("button", { name: "Row actions" }).click();
  await page.getByRole("menuitem", { name: "Record purchase" }).click();
  const purchase = page.getByRole("dialog");
  await purchase.getByLabel("Quantity").fill("120");
  await purchase.getByLabel("Rate").fill("450");
  await purchase.getByLabel("Supplier").fill("Sunrise Knits");
  await purchase.getByLabel("Invoice / bill no.").fill("INV-2401");
  await expect(purchase.getByText("Rs 54,000.00")).toBeVisible();
  await purchase.getByRole("button", { name: "Post purchase" }).click();
  await expect(page.getByText("FI-0001 posted")).toBeVisible();
  await expect(purchase).toBeHidden();
  await expect(row).toContainText("120 kg");

  await row.getByRole("button", { name: "Row actions" }).click();
  await page.getByRole("menuitem", { name: "Record purchase" }).click();
  await purchase.getByLabel("Quantity").fill("40");
  await purchase.getByLabel("Rate").fill("450");
  await purchase.getByLabel("Supplier").fill("Sunrise Knits");
  await purchase.getByLabel("Invoice / bill no.").fill("INV-2401");
  await purchase.getByRole("button", { name: "Post purchase" }).click();
  await expect(purchase).toBeHidden();
  await expect(row).toContainText("160 kg");
  await expect(row).toContainText("Rs 72,000.00");

  // Adjustment cannot exceed stock.
  await row.getByRole("button", { name: "Row actions" }).click();
  await page.getByRole("menuitem", { name: "Adjust stock" }).click();
  const adjust = page.getByRole("dialog");
  await adjust.getByLabel("Quantity").fill("200");
  await adjust.getByLabel("Reason").fill("Damaged during handling");
  await adjust.getByRole("button", { name: "Post adjustment" }).click();
  await expect(adjust.getByText("Only 160 kg is in stock.")).toBeVisible();
  await adjust.getByLabel("Quantity").fill("10");
  await adjust.getByRole("button", { name: "Post adjustment" }).click();
  await expect(adjust).toBeHidden();
  await expect(row).toContainText("150 kg");

  // Ledger for the fabric, newest first with running balance.
  await row.getByRole("link", { name: "Cotton Jersey" }).click();
  await expect(page).toHaveURL(/\/fabric\/ledger\?fabric=/);
  const ledgerRows = page.getByRole("row").filter({ hasText: /Purchase|Adjustment/ });
  await expect(ledgerRows).toHaveCount(3);
  await expect(ledgerRows.first()).toContainText("Adjustment −");
  await expect(ledgerRows.first()).toContainText("150 kg");
  const fabricStats = page.getByLabel(/Movement summary/);
  await expect(fabricStats).toContainText("In stock now");
  await expect(fabricStats).toContainText("150 kg");
  // No duplicate action card here: adjust and purchase live in Fabric Master and Purchases.
  await expect(page.getByRole("button", { name: "Adjust stock" })).toHaveCount(0);

  // All fabrics: activity and stock value.
  await page.goto("/fabric/ledger");
  const allStats = page.getByLabel("Ledger summary");
  await expect(allStats).toContainText("Movements");
  await expect(allStats).toContainText("+160 kg");
  await expect(allStats).toContainText("−10 kg");

  // Reverse the second roll from the purchase register.
  await page.goto("/fabric/purchases");
  await page.getByLabel("Search purchases").fill("FI-0002");
  await expect(page.getByRole("row").filter({ hasText: "Cotton Jersey" })).toHaveCount(1);
  await page.getByRole("row").filter({ hasText: "Cotton Jersey" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("FI-0002");
  await sheet.getByRole("button", { name: "Reverse purchase" }).click();
  await sheet.getByLabel("Reason").fill("Wrong roll entered");
  await sheet.getByRole("button", { name: "Reverse purchase" }).click();
  await expect(page.getByText("FI-0002 reversed")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Cotton Jersey" })).toContainText("Reversed");

  await page.goto("/fabric");
  await expect(page.getByRole("row", { name: /Cotton Jersey/ })).toContainText("110 kg");
});

test("staff can record purchases but not manage fabrics", async ({ page }) => {
  await page.goto("/login");
  await login(page, "staff@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/fabric");
  await expect(page.getByRole("searchbox", { name: "Search fabrics" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New fabric" })).toHaveCount(0);

  await page.goto("/fabric/purchases");
  await expect(page.getByRole("button", { name: "Record purchase" }).first()).toBeVisible();
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
    const fabric = (await post("/api/v1/fabrics", { name: "Paging Rib", code: "PG-RIB", unit: "KG" })).data.fabric;
    const today = new Date().toISOString().slice(0, 10);
    for (let index = 1; index <= 30; index += 1) {
      await post("/api/v1/fabrics/inwards", {
        fabricId: fabric.id,
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
  await palette.getByRole("combobox").fill("pg-rib");
  await expect(palette.getByRole("option", { name: /Paging Rib/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/fabric\/ledger\?fabric=/);
  await expect(page.getByRole("heading", { name: "Paging Rib" })).toBeVisible();

  await page.keyboard.press("Control+k");
  await palette.getByRole("combobox").fill("record");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Record purchase" })).toBeVisible();
});

test("column filters, sorting and export work on Fabric Master; no deactivate", async ({ page }) => {
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.evaluate(async () => {
    const csrf = ((await (await fetch("/api/v1/auth/csrf")).json()) as { data: { csrfToken: string } }).data.csrfToken;
    for (const [code, name] of [
      ["BK-1", "Bulk Twill"],
      ["BK-2", "Bulk Poplin"],
      ["BK-3", "Bulk Rib"],
    ]) {
      await fetch("/api/v1/fabrics", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ code, name, unit: "METER" }),
      });
    }
  });

  await page.goto("/fabric?q=bulk");
  const rows = page.getByRole("row").filter({ hasText: "Bulk" });
  await expect(rows).toHaveCount(3);

  // The add form has no category field.
  await page.getByRole("button", { name: "New fabric" }).click();
  await expect(page.getByRole("dialog").getByLabel(/Category/)).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Header filter: Fabric contains "poplin".
  await page.getByRole("button", { name: /^Fabric: sort and filter/ }).click();
  await page.getByRole("textbox", { name: "Fabric contains" }).fill("poplin");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("button", { name: "Apply" })).toBeHidden();
  await expect(page).toHaveURL(/fabric=poplin/);
  await expect(rows).toHaveCount(1);
  await page.goto("/fabric?q=bulk");

  // Header sort: Fabric Z to A.
  await page.getByRole("button", { name: /^Fabric: sort and filter/ }).click();
  await page.getByRole("button", { name: "Z to A" }).click();
  await expect(page).toHaveURL(/sort=fabric&dir=desc/);
  await expect(rows.first()).toContainText("Bulk Twill");

  // Selection only exports; there are no bulk status actions.
  await page.getByRole("checkbox", { name: "Select all rows on this page" }).click();
  const bar = page.getByRole("toolbar", { name: "Selected rows" });
  await expect(bar).toContainText("Selected: 3");
  await expect(bar.getByRole("button", { name: "Deactivate" })).toHaveCount(0);
  const download = page.waitForEvent("download");
  await bar.getByRole("button", { name: "Export" }).click();
  expect((await download).suggestedFilename()).toMatch(/^fabrics-selected-\d{4}-\d{2}-\d{2}\.csv$/);
  await bar.getByRole("button", { name: "Discard" }).click();

  // Fabrics cannot be deactivated: the row menu has no such action.
  await rows.filter({ hasText: "Bulk Rib" }).getByRole("button", { name: "Row actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Edit details" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Deactivate|Reactivate/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Server export of the filtered list.
  const serverExport = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  expect((await serverExport).suggestedFilename()).toMatch(/^fabrics-\d{4}-\d{2}-\d{2}\.csv$/);
});
