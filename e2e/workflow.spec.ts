import { expect, test, type Page } from "@playwright/test";

import { login } from "./helpers";

// The whole bulk flow after cutting, as the people who do it: a metre fabric cut with
// Panaha in inches, stitching issued and received by size (colours combined), Good pieces
// packed and paid per piece, the godown dispatching, finished goods, and the payments and
// ledgers that follow. Runs in order: later tests read what earlier ones posted.
test.describe.configure({ mode: "serial" });

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await login(page, email);
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Posts JSON through the app's own session (CSRF included); throws on any error status. */
async function api(page: Page, url: string, body: object) {
  return page.evaluate(
    async ({ url, body }) => {
      const csrf = (
        (await (await fetch("/api/v1/auth/csrf")).json()) as {
          data: { csrfToken: string };
        }
      ).data.csrfToken;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`${url}: ${res.status} ${await res.text()}`);

      return ((await res.json()) as { data: Record<string, { id: string }> }).data;
    },
    { url, body },
  );
}

test("admin runs a lot from cutting to dispatch and pays the people", async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, "owner@garment.test");

  const today = new Date().toISOString().slice(0, 10);

  await api(page, "/api/v1/fabrics/inwards", {
    fabricName: "Flow Denim",
    unit: "METER",
    inwardDate: today,
    quantity: 200,
    rate: 100,
  });

  const person = async (name: string, category: string, payRate = 0) =>
    (
      await api(page, "/api/v1/karigars", {
        name,
        category,
        payMode: "PER_PIECE",
        payRate,
      })
    ).karigar!.id;

  await person("Kamal Cutter", "CUTTING_MASTER");
  const ram = await person("Ram Tailor", "TAILOR");
  const sita = await person("Sita Tailor", "TAILOR");

  await person("Puja Packer", "PACKER", 2);
  await api(page, "/api/v1/jogadi", {
    name: "Ram Jogadi",
    members: [{ karigarId: ram }, { karigarId: sita }],
  });

  // 1 · Staff & Karigar: one page for people and their logins; Ram gets his login linked.
  await page.goto("/karigar");
  await expect(page.getByRole("heading", { name: "Staff & Karigar" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Login accounts" })).toBeVisible();
  await page.getByRole("row", { name: /Ram Tailor/ }).click();

  const edit = page.getByRole("dialog", { name: "Edit Ram Tailor" });

  await edit.getByRole("radio", { name: "Link existing" }).click();
  await edit.getByLabel("Existing login").click();
  await page.getByRole("option", { name: /karigar@garment\.test/ }).click();
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("row", { name: /Ram Tailor/ })).toContainText("login karigar@garment.test");

  // 2 · Cutting a metre fabric: Panaha typed in inches, the Pala measured in metres.
  await page.goto("/cutting/new");
  await page.getByLabel("Lot number").fill("FL-1");
  await page.getByLabel("Item / design").click();
  await page.getByLabel("Search items").fill("Flow Trouser");
  await page.getByRole("button", { name: "Add new item “Flow Trouser”" }).click();
  await expect(page.getByLabel("Item / design")).toContainText("Flow Trouser");
  await page.getByLabel("Fabric", { exact: true }).click();
  await page.getByLabel("Fabric", { exact: true }).fill("Flow");
  await page.getByRole("option", { name: /Flow Denim/ }).click();
  await page.getByLabel("Cutting master", { exact: true }).click();
  await page.getByRole("option", { name: /Kamal Cutter/ }).click();

  await page.getByRole("radiogroup", { name: "Panaha unit" }).getByRole("radio", { name: "in" }).click();
  await page.getByLabel("Panaha in inches").fill("58");
  await page.getByLabel("Layer length in metres").fill("7.2");
  await page.getByLabel("Pala length in metres").fill("7.2");
  await expect(page.getByText(/Cutting uses\s*7\.200 m\s*per Pala/)).toBeVisible();

  // Black 36 m → 5 Pala, Blue 21.6 m → 3 Pala; S-M-L-XL one each → 8 pieces of every size.
  await page.getByLabel("Colour, row 1").fill("Black");
  await page.getByLabel("Issued m, Black").fill("36");
  await page.getByRole("button", { name: "Add Thaan" }).click();
  await page.getByLabel("Colour, row 2").fill("Blue");
  await page.getByLabel("Issued m, Blue").fill("21.6");
  await expect(page.getByRole("complementary", { name: "Cutting summary" })).toContainText("57.600 m");
  await page.getByRole("button", { name: "Finalize cutting" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Finalize", exact: true }).click();
  await expect(page.getByText(/finalized: 32 pieces cut/)).toBeVisible();
  await expect(page.getByText("58 in")).toBeVisible();

  // 3 · Stitching in bulk: one row per size, every colour together.
  await page.goto("/stitching");
  await page.getByRole("button", { name: "Issue to Jogadi" }).click();

  const issueForm = page.getByRole("dialog", { name: "Issue to Jogadi" });

  await issueForm.getByLabel("Lot").click();
  await page.getByRole("option", { name: /FL-1/ }).click();
  await issueForm.getByLabel("Jogadi team").click();
  await page.getByRole("option", { name: /Ram Jogadi/ }).click();
  await issueForm.getByLabel("Rate per piece").fill("10");
  await expect(issueForm.getByLabel("Issue Size M")).toBeVisible();
  await expect(issueForm.getByText("Black")).toHaveCount(0);
  await issueForm.getByRole("button", { name: "Issue all waiting" }).click();
  await expect(issueForm.getByText("32 pcs", { exact: true })).toBeVisible();
  await issueForm.getByRole("button", { name: "Issue pieces" }).click();
  await expect(page.getByText(/SI-\d{4}: 32 pcs issued to Ram Jogadi/)).toBeVisible();

  const sheet = page.getByRole("dialog").filter({ hasText: "Team when issued" });

  await sheet.getByRole("button", { name: "Receive pieces" }).click();

  const receive = page.getByRole("dialog", { name: "Receive from Ram Jogadi" });

  for (const size of ["S", "M", "L"]) await receive.getByLabel(`Good, Size ${size}`).fill("8");

  await receive.getByLabel("Good, Size XL").fill("7");
  await receive.getByLabel("Reject, Size XL").fill("1");
  await receive.getByLabel("Reject reason, Size XL").click();
  await page.getByRole("option", { name: "Hole or tear" }).click();
  await receive.getByRole("button", { name: "Record receipt" }).click();
  await expect(page.getByText(/SR-\d{4}: 31 pcs Good/)).toBeVisible();
  await page.keyboard.press("Escape");

  // 4 · Packing: Good pieces are waiting with no transfer step; the packer is paid per piece.
  await page.goto("/packing");
  await expect(page.getByRole("button", { name: /Waiting to pack/ })).toBeVisible();

  const queueRow = page.getByRole("row", { name: /FL-1/ });

  await expect(queueRow).toContainText("Flow Trouser");
  await expect(queueRow).toContainText("XL 7");
  await queueRow.getByRole("button", { name: "Pack" }).click();

  const pack = page.getByRole("dialog", { name: "Pack pieces" });

  await pack.getByLabel("Packed by").click();
  await page.getByRole("option", { name: /Puja Packer/ }).click();
  await pack.getByRole("button", { name: "Pack all waiting" }).click();
  await expect(pack.getByText(/Paid per piece: 31 pcs × Rs 2\.00/)).toBeVisible();
  await expect(pack.getByText("Rs 62.00")).toBeVisible();
  await pack.getByRole("button", { name: "Record packing" }).click();
  await expect(page.getByText(/PK-\d{4}: 31 pcs packed by Puja Packer, earns Rs 62\.00/)).toBeVisible();
  await expect(page.getByRole("row", { name: /FL-1/ })).toHaveCount(0);

  await page.getByRole("tab", { name: "By packer" }).click();
  await expect(page.getByRole("row", { name: /Puja Packer/ })).toContainText("Rs 62.00");
  await page.getByRole("tab", { name: "By item & size" }).click();
  await expect(page.getByRole("row", { name: /Flow Trouser/ }).first()).toBeVisible();

  // 5 · Godown: packed stock arrived by item and size; dispatch some.
  await page.goto("/godown");
  await expect(page.getByRole("button", { name: /Pieces in stock\s*31/ })).toBeVisible();

  const stockRow = page.getByRole("row", { name: /Flow Trouser/ });

  await stockRow.getByRole("button", { name: "Dispatch" }).click();

  const dispatch = page.getByRole("dialog", { name: "Dispatch goods" });

  await dispatch.getByLabel("Party").fill("Sharma Traders");
  await dispatch.getByLabel("Challan no.").fill("CH-1");
  await dispatch.getByLabel("Dispatch Flow Trouser M").fill("9");
  await dispatch.getByRole("button", { name: "Dispatch", exact: true }).click();
  await expect(dispatch.getByText("Only 8 in stock.")).toBeVisible();
  await dispatch.getByLabel("Dispatch Flow Trouser M").fill("5");
  await dispatch.getByRole("button", { name: "Dispatch", exact: true }).click();
  await expect(page.getByText(/DS-\d{4}: 5 pcs sent to Sharma Traders/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Pieces in stock\s*26/ })).toBeVisible();

  await page.getByRole("tab", { name: "Dispatches" }).click();
  await expect(page.getByRole("row", { name: /Sharma Traders/ })).toContainText("CH-1");

  // 6 · Finished goods: the lot from cutting to packing, and the item's totals.
  await page.goto("/finished-goods");

  const lotRow = page.getByRole("row", { name: /FL-1/ });

  await expect(lotRow).toContainText("Flow Trouser");
  await expect(lotRow).toContainText("Finished");
  await page.getByRole("tab", { name: "By item" }).click();
  await expect(page.getByRole("row", { name: /Flow Trouser/ })).toContainText(/32\s*31\s*1\s*31\s*5\s*26/);

  // 7 · Payments: Puja is owed her packing pay (green); paying and lending more turns it red.
  await page.goto("/karigar/payments");
  await expect(page.getByRole("row", { name: /Puja Packer/ })).toContainText("To pay");
  await page.getByRole("row", { name: /Puja Packer/ }).click();
  await page.getByRole("button", { name: "Pay", exact: true }).click();

  const money = page.getByRole("dialog", { name: "Record money" });

  await money.getByLabel("Amount").fill("50");
  await expect(money).toContainText(/Rs 62\.00\s*→\s*Rs 12\.00/);
  await money.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/Payment of Rs 50\.00 recorded for Puja Packer/)).toBeVisible();

  await page.getByRole("button", { name: "Advance / loan" }).click();
  await money.getByLabel("Amount").fill("100");
  await money.getByLabel("For").fill("Fest");
  await page.getByRole("option", { name: "Festival" }).click();
  await money.getByRole("button", { name: "Record advance / loan" }).click();
  await expect(page.getByText("−Rs 88.00").first()).toBeVisible();
  await expect(page.getByText("Balance · to receive")).toBeVisible();

  // A wrong entry is reversed, not deleted.
  await page
    .getByRole("row", { name: /Advance \/ loan/ })
    .getByRole("button", { name: /actions/i })
    .click();
  await page.getByRole("menuitem", { name: "Reverse this entry" }).click();
  await page.getByLabel("Reason").fill("Given by mistake");
  await page.getByRole("button", { name: "Reverse", exact: true }).click();
  await expect(page.getByText("Balance · to pay")).toBeVisible();
  await expect(page.getByText("Reversed", { exact: true }).first()).toBeVisible();
});

test("a karigar signs in and sees only their own ledger", async ({ page }) => {
  await signIn(page, "karigar@garment.test");
  await page.goto("/my-ledger");
  await expect(page.getByText(/Ram Tailor · K-\d{3}/)).toBeVisible();
  // Half of 31 Good × Rs 10.
  await expect(page.getByRole("row", { name: /Earning/ })).toContainText("Rs 155.00");
  await page.goto("/karigar/payments");
  await expect(page.getByText("You don't have access to this page")).toBeVisible();
});

test("packing staff pack without seeing money; godown and accounts work their own pages", async ({ page }) => {
  await signIn(page, "packer@garment.test");
  await page.goto("/packing");
  await expect(page.getByRole("heading", { name: "Packing" })).toBeVisible();
  await expect(page.getByText("Packing pay this month")).toHaveCount(0);
  await page.goto("/godown");
  await expect(page.getByText("You don't have access to this page")).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, "godown@garment.test");
  await page.goto("/godown");
  await expect(page.getByRole("button", { name: "Dispatch" }).first()).toBeVisible();
  await page.goto("/karigar/payments");
  await expect(page.getByText("You don't have access to this page")).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, "accounts@garment.test");
  await page.goto("/karigar/payments");
  await expect(page.getByRole("button", { name: "Record money" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Ram Tailor/ })).toContainText("Rs 155.00");
});
