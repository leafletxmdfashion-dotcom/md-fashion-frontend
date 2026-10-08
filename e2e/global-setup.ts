import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

import { E2E } from "./env";

export default function globalSetup() {
  rmSync(E2E.outboxDir, { recursive: true, force: true });
  execSync("npx tsx src/test/e2e-reset.ts", {
    cwd: E2E.backendDir,
    env: { ...process.env, ...E2E.backendEnv },
    stdio: "inherit",
  });
}
