import { readFileSync } from "node:fs";

import { expect, test, type Download, type Page } from "@playwright/test";

import { login } from "./helpers";

// Export buttons download a CSV built by the server: every row matching the filters (not
// just the page on screen), or exactly the rows picked.

async function csvRows(download: Download): Promise<string[][]> {
  // trimStart drops the byte-order mark the server adds for spreadsheet apps.
  const text = readFileSync((await download.path())!, "utf8").trimStart();
  return text
    .split("\r\n")
    .filter(Boolean)
    .map((line) => line.split(","));
}

async function createPeople(page: Page, count: number) {
  await page.evaluate(async (count) => {
    const csrf = ((await (await fetch("/api/v1/auth/csrf")).json()) as { data: { csrfToken: string } }).data
      .csrfToken;
    for (let i = 1; i <= count; i++) {
      const res = await fetch("/api/v1/karigars", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          name: `Export Person ${String(i).padStart(2, "0")}`,
          category: "HELPER",
          payMode: "PER_PIECE",
          payRate: 1,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    }
  }, count);
}

test("Export downloads every matching row from the server; Export selected only the picked rows", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);
  await createPeople(page, 30);

  // Filter to these 30 people: the table shows one page of 25, the export all 30.
  await page.goto("/karigar?q=Export%20Person");
  await expect(page.getByRole("row", { name: /Export Person/ })).toHaveCount(25);

  const [all] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  expect(all.suggestedFilename()).toMatch(/^staff-and-karigars-\d{4}-\d{2}-\d{2}\.csv$/);
  const [header, ...rows] = await csvRows(all);
  expect(header).toContain("Name");
  expect(rows).toHaveLength(30);
  expect(rows.every((row) => row[header!.indexOf("Name")]!.startsWith("Export Person"))).toBe(true);

  // Pick two rows and export just those.
  await page.getByRole("row", { name: /Export Person 01/ }).getByRole("checkbox").check();
  await page.getByRole("row", { name: /Export Person 02/ }).getByRole("checkbox").check();
  const [picked] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("toolbar", { name: "Selected rows" }).getByRole("button", { name: "Export selected" }).click(),
  ]);
  expect(picked.suggestedFilename()).toMatch(/^staff-and-karigars-selected-/);
  const [pickedHeader, ...pickedRows] = await csvRows(picked);
  expect(pickedRows.map((row) => row[pickedHeader!.indexOf("Name")]).sort()).toEqual([
    "Export Person 01",
    "Export Person 02",
  ]);
});
