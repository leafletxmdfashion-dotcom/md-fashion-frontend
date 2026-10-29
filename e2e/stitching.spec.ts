import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("Jogadi team, issue cut pieces, receive Good/Rework/Reject, pay the team and fix rework", async ({ page }) => {
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  // A finalized cutting of ST-LOT: Black S10 M20 (2 kg Pala of 1 S + 2 M, 20.5 kg → 10 Pala).
  await page.evaluate(async () => {
    const csrf = ((await (await fetch("/api/v1/auth/csrf")).json()) as { data: { csrfToken: string } }).data.csrfToken;
    const post = async (url: string, body: object) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${url}: ${res.status} ${await res.text()}`);
      return (await res.json()) as { data: Record<string, { id: string; fabric: { id: string } }> };
    };
    const today = new Date().toISOString().slice(0, 10);
    const fabric = (
      await post("/api/v1/fabrics/inwards", {
        fabricName: "Stitch Jersey",
        unit: "KG",
        inwardDate: today,
        quantity: 50,
        rate: 400,
      })
    ).data.inward!.fabric;
    const cutter = (
      await post("/api/v1/karigars", {
        name: "Kiran Cutter",
        category: "CUTTING_MASTER",
        payMode: "PER_PIECE",
        payRate: 0,
      })
    ).data.karigar!;
    await post("/api/v1/karigars", { name: "Asha Tailor", category: "TAILOR", payMode: "PER_PIECE", payRate: 0 });
    await post("/api/v1/karigars", { name: "Bina Tailor", category: "TAILOR", payMode: "PER_PIECE", payRate: 0 });
    const created = await post("/api/v1/production-lots", {
      lotNumber: "ST-LOT",
      article: { name: "Stitch Tee" },
      fabricId: fabric.id,
      productionDate: today,
      targetQuantity: null,
      cutting: {
        cuttingMasterId: cutter.id,
        cuttingDate: today,
        marker: { measuredPalaKg: "2", weightSource: "MEASURED", repetitionsPerLayer: 1 },
        sizes: [
          { label: "S", piecesPerPala: 1 },
          { label: "M", piecesPerPala: 2 },
        ],
        colours: [{ name: "Black", rolls: [{ issuedKg: "20.5" }] }],
      },
    });
    await post(`/api/v1/cutting-batches/${created.data.batch!.id}/finalize`, {});
  });

  // 1 · A Jogadi team of two, splitting equally.
  await page.goto("/jogadi");
  await page.getByRole("button", { name: "New team" }).click();
  const teamForm = page.getByRole("dialog", { name: "New Jogadi team" });
  await teamForm.getByLabel("Team name").fill("Asha Jogadi");
  await teamForm.getByLabel("Member 1", { exact: true }).click();
  await page.getByRole("option", { name: /Asha Tailor/ }).click();
  await teamForm.getByRole("button", { name: "Add member" }).click();
  await teamForm.getByLabel("Member 2", { exact: true }).click();
  await page.getByRole("option", { name: /Bina Tailor/ }).click();
  await teamForm.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByText(/Asha Jogadi \(JG-\d{3}\) created/)).toBeVisible();

  // 2 · Issue all waiting pieces of the lot, at Rs 10 a piece.
  await page.goto("/stitching");
  await page.getByRole("button", { name: "Issue to Jogadi" }).click();
  const issueForm = page.getByRole("dialog", { name: "Issue to Jogadi" });
  await issueForm.getByLabel("Lot").click();
  await page.getByRole("option", { name: /ST-LOT/ }).click();
  await issueForm.getByLabel("Jogadi team").click();
  await page.getByRole("option", { name: /Asha Jogadi/ }).click();
  await issueForm.getByLabel("Rate per piece").fill("10");
  await issueForm.getByLabel("Issue Black M").fill("25");
  await issueForm.getByRole("button", { name: "Issue pieces" }).click();
  await expect(issueForm.getByText("5 more than waiting.")).toBeVisible();
  // The same button clears what was typed, then fills in everything waiting.
  await issueForm.getByRole("button", { name: "Clear all" }).click();
  await issueForm.getByRole("button", { name: "Issue all waiting" }).click();
  await expect(issueForm.getByText("30 pcs", { exact: true })).toBeVisible();
  await issueForm.getByRole("button", { name: "Issue pieces" }).click();
  await expect(page.getByText(/SI-\d{4}: 30 pcs issued to Asha Jogadi/)).toBeVisible();

  // The issue opens; receive 9 S Good + 1 rejected, 18 M Good + 2 rework.
  const sheet = page.getByRole("dialog").filter({ hasText: "Team when issued" });
  await expect(sheet).toContainText("Asha Tailor, Bina Tailor");
  await sheet.getByRole("button", { name: "Receive pieces" }).click();
  const receive = page.getByRole("dialog", { name: "Receive from Asha Jogadi" });
  await receive.getByLabel("Good, Black S").fill("9");
  await receive.getByLabel("Reject, Black S").fill("1");
  await receive.getByLabel("Good, Black M").fill("18");
  await receive.getByLabel("Rework, Black M").fill("2");
  await receive.getByRole("button", { name: "Record receipt" }).click();
  await expect(receive.getByText("Choose why.")).toBeVisible();
  await receive.getByLabel("Reject reason, Black S").click();
  await page.getByRole("option", { name: "Hole or tear" }).click();
  // 27 Good × Rs 10 = Rs 270, Rs 135 each.
  await expect(receive.getByText("Rs 270.00")).toBeVisible();
  await receive.getByRole("button", { name: "Record receipt" }).click();
  await expect(page.getByText(/SR-\d{4}: 27 pcs Good, 2 rework, 1 rejected/)).toBeVisible();
  await expect(sheet).toContainText("Asha Tailor Rs 135.00");
  await page.keyboard.press("Escape");

  // 3 · Rework: fix one, reject the other.
  await page.goto("/rework");
  const reworkRow = page.getByRole("row").filter({ hasText: "ST-LOT" });
  await expect(reworkRow).toContainText("Pending");
  await reworkRow.click();
  const result = page.getByRole("dialog").filter({ hasText: "Rework result" });
  await result.getByLabel("Fixed").fill("1");
  await result.getByLabel("Failed").fill("1");
  await result.getByLabel("Why they failed").click();
  await page.getByRole("option", { name: "Fabric defect" }).click();
  await result.getByRole("button", { name: "Save result" }).click();
  await expect(page.getByText(/RW-\d{4}: 1 fixed, 1 rejected/)).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "ST-LOT" })).toHaveCount(0);

  await page.getByRole("tab", { name: "Rejects" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Hole or tear" })).toContainText("1");
  await expect(page.getByRole("row").filter({ hasText: "Fabric defect" })).toContainText("1");

  // 4 · Where the lot's pieces are: 30 cut, 28 Good, 2 rejected, nothing left with the team.
  await page.goto("/stitching");
  await page.getByRole("row").filter({ hasText: "ST-LOT" }).getByRole("button", { name: "Row actions" }).click();
  await page.getByRole("menuitem", { name: /Show where ST-LOT/ }).click();
  const balance = page.getByRole("region", { name: "ST-LOT balance" });
  await expect(balance.getByRole("row", { name: /Total/ })).toContainText(/30\s*0\s*0\s*28\s*0\s*2/);

  // Karigar earnings include stitching: Rs 135 + Rs 5 rework each.
  await page.goto("/karigar");
  await expect(page.getByRole("row").filter({ hasText: "Asha Tailor" })).toContainText("140");
});

test("one lot divided between two Jogadi teams in a single issue", async ({ page }) => {
  await page.goto("/login");
  await login(page, "owner@garment.test");
  await expect(page).toHaveURL(/\/dashboard$/);

  // A finalized cutting of DIV-LOT: Blue S10 M20 L10, and two teams.
  await page.evaluate(async () => {
    const csrf = ((await (await fetch("/api/v1/auth/csrf")).json()) as { data: { csrfToken: string } }).data.csrfToken;
    const post = async (url: string, body: object) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${url}: ${res.status} ${await res.text()}`);
      return (await res.json()) as { data: Record<string, { id: string; fabric: { id: string } }> };
    };
    const today = new Date().toISOString().slice(0, 10);
    const fabric = (
      await post("/api/v1/fabrics/inwards", {
        fabricName: "Divide Jersey",
        unit: "KG",
        inwardDate: today,
        quantity: 30,
        rate: 400,
      })
    ).data.inward!.fabric;
    const cutter = (
      await post("/api/v1/karigars", {
        name: "Div Cutter",
        category: "CUTTING_MASTER",
        payMode: "PER_PIECE",
        payRate: 0,
      })
    ).data.karigar!;
    const one = (
      await post("/api/v1/karigars", { name: "Gita Tailor", category: "TAILOR", payMode: "PER_PIECE", payRate: 0 })
    ).data.karigar!;
    const two = (
      await post("/api/v1/karigars", { name: "Hira Tailor", category: "TAILOR", payMode: "PER_PIECE", payRate: 0 })
    ).data.karigar!;
    await post("/api/v1/jogadi", { name: "Gita Jogadi", members: [{ karigarId: one.id }] });
    await post("/api/v1/jogadi", { name: "Hira Jogadi", members: [{ karigarId: two.id }] });
    const created = await post("/api/v1/production-lots", {
      lotNumber: "DIV-LOT",
      article: { name: "Divide Tee" },
      fabricId: fabric.id,
      productionDate: today,
      targetQuantity: null,
      cutting: {
        cuttingMasterId: cutter.id,
        cuttingDate: today,
        marker: { measuredPalaKg: "2", weightSource: "MEASURED", repetitionsPerLayer: 1 },
        sizes: [
          { label: "S", piecesPerPala: 1 },
          { label: "M", piecesPerPala: 2 },
          { label: "L", piecesPerPala: 1 },
        ],
        colours: [{ name: "Blue", rolls: [{ issuedKg: "20" }] }],
      },
    });
    await post(`/api/v1/cutting-batches/${created.data.batch!.id}/finalize`, {});
  });

  await page.goto("/stitching");
  await page.getByRole("button", { name: "Issue to Jogadi" }).click();
  const form = page.getByRole("dialog", { name: "Issue to Jogadi" });
  await form.getByLabel("Lot").click();
  await page.getByRole("option", { name: /DIV-LOT/ }).click();
  await form.getByLabel("Rate per piece").fill("8");
  await form.getByLabel("Jogadi team").click();
  await page.getByRole("option", { name: /Gita Jogadi/ }).click();
  await form.getByRole("button", { name: "Divide with another team" }).click();
  await form.getByLabel("Team 2", { exact: true }).click();
  await page.getByRole("option", { name: /Hira Jogadi/ }).click();

  // Divide all equally, then move 2 Blue M from Gita to Hira by hand.
  await form.getByRole("button", { name: "Divide all equally" }).click();
  await expect(form.getByLabel("Gita Jogadi, Blue M")).toHaveValue("10");
  await form.getByLabel("Gita Jogadi, Blue M").fill("8");
  await form.getByLabel("Hira Jogadi, Blue M").fill("13");
  await expect(form.getByText("1 more than waiting.")).toHaveCount(0);
  await form.getByRole("button", { name: "Issue to teams" }).click();
  await expect(form.getByText("1 more than waiting.")).toBeVisible();
  await form.getByLabel("Hira Jogadi, Blue M").fill("12");
  await expect(form.getByRole("row", { name: /Each team gets/ })).toContainText(/18\s*22/);

  // Clear all empties every box; Divide all fills them again.
  await form.getByRole("button", { name: "Clear all" }).click();
  await expect(form.getByLabel("Gita Jogadi, Blue S")).toHaveValue("");
  await form.getByRole("button", { name: "Divide all equally" }).click();
  await form.getByRole("button", { name: "Issue to teams" }).click();
  await expect(
    page.getByText(/40 pcs divided between 2 teams: SI-\d{4} Gita Jogadi, SI-\d{4} Hira Jogadi/),
  ).toBeVisible();

  const rows = page.getByRole("row").filter({ hasText: "DIV-LOT" });
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "Gita Jogadi" })).toContainText("20");
  await expect(rows.filter({ hasText: "Hira Jogadi" })).toContainText("20");
});
