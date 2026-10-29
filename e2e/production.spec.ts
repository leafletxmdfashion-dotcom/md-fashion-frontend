import { expect, test, type Page } from "@playwright/test";

import { login } from "./helpers";

/** Stock & Ledger, narrowed to one fabric: its headline figures. */
async function fabricStock(page: Page, name: string) {
  await page.goto("/fabric/ledger");
  await page.getByLabel("Fabric", { exact: true }).click();
  await page.getByLabel("Fabric", { exact: true }).fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).click();

  return page.getByLabel(/Movement summary/);
}

test("new cutting: typed lot, item and Thaan on one page, finalized into stock, output and cost, then reversed", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  // Fabric in the store (100 kg at Rs 500/kg) and a cutting master paid Rs 2.50 per piece.
  await page.evaluate(async () => {
    const csrf = ((await (await fetch("/api/v1/auth/csrf")).json()) as { data: { csrfToken: string } }).data.csrfToken;
    const post = async (url: string, body: object) =>
      (await (
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          body: JSON.stringify(body),
        })
      ).json()) as unknown;

    await post("/api/v1/fabrics/inwards", {
      fabricName: "Polo Pique",
      unit: "KG",
      inwardDate: new Date().toISOString().slice(0, 10),
      quantity: 100,
      rate: 500,
    });
    await post("/api/v1/karigars", {
      name: "Ram Bahadur",
      category: "CUTTING_MASTER",
      payMode: "PER_PIECE",
      payRate: 2.5,
    });
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

  // 3 · Colours & Thaan: no Thaan number to type. 30.500 kg gives 14 Pala, 56 pieces and 0.680 kg waste, live.
  await expect(page.getByLabel(/Thaan number/)).toHaveCount(0);
  await page.getByLabel("Colour, row 1").fill("Black");
  await page.getByLabel("Issued kg, Black").fill("30.500");
  await expect(page.getByLabel("Estimated Pala")).toHaveText("14");
  await expect(page.getByLabel("Pala, Black")).toHaveAttribute("placeholder", "14");
  await expect(page.getByLabel("Returned kg, Black")).toHaveAttribute("placeholder", "0.000");
  await expect(page.getByLabel("Wastage", { exact: true })).toHaveText("0.680 kg");
  await expect(page.getByRole("complementary", { name: "Cutting summary" })).toContainText("29.820 kg");

  // 4 · No lot target to confirm: the cutting is ready.
  await expect(page.getByLabel(/target/i)).toHaveCount(0);
  await expect(page.getByText("Ready to post")).toBeVisible();
  await page.getByRole("button", { name: "Finalize cutting" }).click();

  const confirm = page.getByRole("dialog");

  await expect(confirm.getByText("Finalize cutting?")).toBeVisible();
  await confirm.getByRole("button", { name: "Finalize", exact: true }).click();

  await expect(page).toHaveURL(/\/cutting\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/finalized: 56 pieces cut/)).toBeVisible();
  await expect(page.getByText("Finalized", { exact: true })).toBeVisible();
  await expect(page.getByText("LOT-45").first()).toBeVisible();

  const reconciliation = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Material reconciliation" }) });

  await expect(reconciliation).toContainText("29.820 kg");
  await expect(reconciliation).toContainText("0.680 kg");
  await expect(reconciliation).toContainText("Rs 15,250.00");

  const pieces = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Cut pieces by colour and size" }) });

  await expect(pieces.getByRole("row", { name: /Black/ })).toContainText(/14\s*28\s*14\s*56\s*56/);

  // The fabric store shows one issue to cutting; consumption is never deducted twice.
  await expect(await fabricStock(page, "Polo Pique")).toContainText("69.5 kg");

  // Typing the same lot number again (any case) adds more cutting to that lot, with its item and fabric.
  await page.goto("/cutting/new");
  await page.getByLabel("Lot number").fill("lot-45");
  await expect(page.getByText(/Existing lot · Polo T-Shirt · 56 pieces cut so far/)).toBeVisible();
  await expect(page.getByLabel("Item / design")).toHaveValue("Polo T-Shirt");

  // An authorized correction reverses the cutting without deleting it.
  await page.goto("/cutting");
  await page.getByRole("link", { name: "CUT-0001" }).click();
  await page.getByRole("button", { name: "Reverse cutting" }).click();
  await page.getByLabel("Reason").fill("Wrong Pala weight was used");
  await page.getByRole("button", { name: "Reverse cutting" }).click();
  await expect(page.getByText("Reversed", { exact: true }).first()).toBeVisible();

  await expect(await fabricStock(page, "Polo Pique")).toContainText("100 kg");
});

test("Pala fill in from the weight but can be typed over; return and wastage work themselves out", async ({ page }) => {
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  // A 10 kg Thaan at 2.3 kg per Pala: 4 Pala fit, 0.8 kg left over is wastage.
  await page.goto("/cutting/new");
  await page.getByLabel("Measured Pala weight").fill("2.300");
  await page.getByLabel("Colour, row 1").fill("Blue");
  await page.getByLabel("Issued kg, Blue").fill("10");
  await expect(page.getByLabel("Estimated Pala")).toHaveText("4");
  await expect(page.getByLabel("Wastage", { exact: true })).toHaveText("0.800 kg");

  // Thinner fabric gave 9 Pala: typed in, no error, the whole Thaan counts as used.
  await page.getByLabel("Pala, Blue").fill("9");
  await expect(page.getByText(/more than this Thaan can give/)).toHaveCount(0);
  await expect(page.getByText("Blue Thaan 1: 9 Pala entered, 4 fit by the marker weight.").first()).toBeVisible();
  await expect(page.getByLabel("Wastage", { exact: true })).toHaveText("0.000 kg");
  await page.getByLabel("Reason, Blue").fill("Thin fabric at the roll end");

  // One click goes back to the number that fits by weight.
  await page.getByRole("button", { name: "Reset to 4" }).click();
  await expect(page.getByLabel("Pala, Blue")).toHaveValue("");
  await expect(page.getByText(/Pala entered/)).toHaveCount(0);

  // Thicker fabric gave 3: a whole Pala's worth goes back to the store, the rest is wastage.
  await page.getByLabel("Pala, Blue").fill("3");
  await expect(page.getByLabel("Returned kg, Blue")).toHaveAttribute("placeholder", "2.300");
  await expect(page.getByLabel("Wastage", { exact: true })).toHaveText("0.800 kg");

  // A weighed return overrides the worked-out one.
  await page.getByLabel("Returned kg, Blue").fill("3");
  await expect(page.getByLabel("Wastage", { exact: true })).toHaveText("0.100 kg");

  await page.getByLabel("Returned kg, Blue").fill("");
  await page.getByLabel("Issued kg, Blue").fill("1.5");
  await page.getByLabel("Pala, Blue").fill("");
  await expect(
    page.getByText(/Less than one Pala: all 1\.500 kg of Blue Thaan 1 becomes wastage/).first(),
  ).toBeVisible();

  // A new Thaan row starts with the last colour.
  await page.getByRole("button", { name: "Add Thaan" }).click();
  await expect(page.getByLabel("Colour, row 2")).toHaveValue("Blue");
});

test("sizes can be left out of a marker with 0 pieces per Pala, but not all of them", async ({ page }) => {
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/cutting/new");
  await expect(page.getByRole("heading", { name: "Rejected pieces" })).toHaveCount(0);

  for (const size of ["S", "M", "L", "XL"]) await page.getByLabel(`Pieces per Pala, size ${size}`).fill("0");

  await expect(page.getByText("At least one size needs pieces per Pala.").first()).toBeVisible();

  await page.getByLabel("Pieces per Pala, size S").fill("3");
  await expect(page.getByText("At least one size needs pieces per Pala.")).toHaveCount(0);
  await expect(page.getByText(/^3\s*pieces per Pala/)).toBeVisible();
  await expect(page.getByLabel("Pieces per Pala, size M")).not.toHaveAttribute("aria-invalid", "true");

  // 10 kg at 2.130 kg per Pala → 4 Pala, all of it size S.
  await page.getByLabel("Measured Pala weight").fill("2.130");
  await page.getByLabel("Colour, row 1").fill("Blue");
  await page.getByLabel("Issued kg, Blue").fill("10");
  await expect(page.getByRole("complementary", { name: "Cutting summary" })).toContainText(
    /S\s*12\s*M\s*0\s*L\s*0\s*XL\s*0/,
  );
});
