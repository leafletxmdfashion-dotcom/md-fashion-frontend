import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("new cutting: typed lot, item and Thaan on one page, finalized into stock, output and cost, then reversed", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  // Fabric in the store (100 kg at Rs 500/kg) and a cutting master paid Rs 2.50 per accepted piece.
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
    const fabric = (await post("/api/v1/fabrics", { name: "Polo Pique", code: "PR-PQ", unit: "KG" })).data.fabric;

    await post("/api/v1/fabrics/inwards", {
      fabricId: fabric.id,
      inwardDate: new Date().toISOString().slice(0, 10),
      quantity: 100,
      rate: 500,
    });
    await post("/api/v1/karigars", { name: "Ram Bahadur", category: "CUTTING_MASTER", payMode: "PER_PIECE", payRate: 2.5 });
  });

  await page.goto("/cutting");
  await page.getByRole("link", { name: "New cutting" }).first().click();
  await expect(page).toHaveURL(/\/cutting\/new$/);

  // Saving an empty form marks what is missing instead of failing silently.
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Enter the lot number.").first()).toBeVisible();

  // 1 · Lot & item: a typed lot number and a brand-new item.
  await page.getByLabel("Lot number").fill("LOT-45");
  await expect(page.getByText("New lot · created when you save")).toBeVisible();
  await page.getByLabel("Item / design").fill("Polo T-Shirt");
  await page.getByLabel("Fabric", { exact: true }).click();
  await page.getByLabel("Fabric", { exact: true }).fill("Polo");
  await page.getByRole("option", { name: /Polo Pique/ }).click();
  await page.getByLabel("Cutting master", { exact: true }).click();
  await page.getByRole("option", { name: /Ram Bahadur/ }).click();

  // 2 · Marker & sizes: weighed Pala and a 1:2:1 ratio.
  await page.getByLabel("Measured Pala weight").fill("2.130");
  await expect(page.getByText(/Cutting uses\s*2\.130 kg\s*per Pala/)).toBeVisible();
  await page.getByRole("button", { name: "Remove XL" }).click();
  await page.getByLabel("Pieces per Pala, size M").fill("2");

  // 3 · Colours & Thaan: 30.500 kg gives 14 Pala, 56 pieces, 29.820 kg used, 0.680 kg waste, live.
  await page.getByLabel("Colour", { exact: true }).fill("Black");
  await page.getByLabel("Thaan number, row 1").fill("TH-001");
  await page.getByLabel("Issued kg, Thaan TH-001").fill("30.500");
  await expect(page.getByLabel("Estimated Pala")).toHaveText("14");
  await expect(page.getByLabel("Consumed", { exact: true })).toHaveText("29.820 kg");
  await expect(page.getByLabel("Wastage", { exact: true })).toHaveText("0.680 kg");

  // 4 · Summary lists the missing target; confirming it makes the cutting ready.
  await expect(page.getByText("Confirm the lot's target quantity.").first()).toBeVisible();
  await page.getByRole("button", { name: "Use 56" }).click();
  await expect(page.getByText("Ready to post")).toBeVisible();
  await page.getByRole("button", { name: "Finalize cutting" }).click();

  const confirm = page.getByRole("dialog");

  await expect(confirm.getByText("Finalize cutting?")).toBeVisible();
  await confirm.getByRole("button", { name: "Finalize", exact: true }).click();

  await expect(page).toHaveURL(/\/cutting\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/finalized: 56 pieces cut/)).toBeVisible();
  await expect(page.getByText("Finalized", { exact: true })).toBeVisible();
  await expect(page.getByText("LOT-45").first()).toBeVisible();

  const reconciliation = page.locator("section").filter({ has: page.getByRole("heading", { name: "Material reconciliation" }) });

  await expect(reconciliation).toContainText("29.820 kg");
  await expect(reconciliation).toContainText("0.680 kg");
  await expect(reconciliation).toContainText("Rs 15,250.00");

  const pieces = page.locator("section").filter({ has: page.getByRole("heading", { name: "Cut pieces by colour and size" }) });

  await expect(pieces.getByRole("row", { name: /Black/ })).toContainText(/14\s*28\s*14\s*56\s*56/);

  // The fabric store shows one issue to cutting; consumption is never deducted twice.
  await page.goto("/fabric");
  await expect(page.getByRole("row", { name: /Polo Pique/ })).toContainText("69.5 kg");

  // Typing the same lot number again (any case) adds more cutting to that lot, with its item and fabric.
  await page.goto("/cutting/new");
  await page.getByLabel("Lot number").fill("lot-45");
  await expect(page.getByText(/Existing lot · Polo T-Shirt · 56 pieces cut so far/)).toBeVisible();
  await expect(page.getByLabel("Item / design")).toHaveValue("Polo T-Shirt");
  await expect(page.getByLabel("Lot target quantity")).toHaveValue("56");

  // An authorized correction reverses the cutting without deleting it.
  await page.goto("/cutting");
  await page.getByRole("link", { name: "CUT-0001" }).click();
  await page.getByRole("button", { name: "Reverse cutting" }).click();
  await page.getByLabel("Reason").fill("Wrong Pala weight was used");
  await page.getByRole("button", { name: "Reverse cutting" }).click();
  await expect(page.getByText("Reversed", { exact: true }).first()).toBeVisible();

  await page.goto("/fabric");
  await expect(page.getByRole("row", { name: /Polo Pique/ })).toContainText("100 kg");
});

test("validation blocks posting more Pala than a Thaan can give", async ({ page }) => {
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/cutting/new");
  await page.getByLabel("Measured Pala weight").fill("2.130");
  await page.getByLabel("Colour", { exact: true }).fill("Blue");
  await page.getByLabel("Thaan number, row 1").fill("TH-009");
  await page.getByLabel("Issued kg, Thaan TH-009").fill("10");
  await page.getByLabel("Confirmed Pala, Thaan TH-009").fill("5");
  await expect(page.getByText("5 Pala is more than this Thaan can give (4). Re-measure the Pala weight first.").first()).toBeVisible();

  await page.getByLabel("Issued kg, Thaan TH-009").fill("1.5");
  await page.getByLabel("Confirmed Pala, Thaan TH-009").fill("");
  await expect(page.getByText(/Less than one Pala: all 1\.500 kg of Thaan TH-009 becomes wastage/).first()).toBeVisible();
});
