import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, type Page } from "@playwright/test";

import { E2E } from "./env";

export async function login(page: Page, email: string, password = E2E.password) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
}

/** Latest outbox mail to `to`, waiting for asynchronous delivery. */
export async function latestMailLink(to: string, sentAfter: number): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      () => {
        let files: string[] = [];
        try {
          files = readdirSync(E2E.outboxDir).sort();
        } catch {
          return undefined;
        }
        for (const file of files.reverse()) {
          const mail = JSON.parse(readFileSync(path.join(E2E.outboxDir, file), "utf8")) as {
            to: string;
            text: string;
            sentAt: string;
          };
          if (mail.to === to && Date.parse(mail.sentAt) >= sentAfter) {
            link = /https?:\/\/\S+#token=[\w-]+/.exec(mail.text)?.[0];
            return link;
          }
        }
        return undefined;
      },
      { timeout: 10_000 },
    )
    .toBeTruthy();
  return link!;
}
