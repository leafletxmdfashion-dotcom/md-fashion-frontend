import { readFileSync } from "node:fs";
import path from "node:path";

const backendDir = path.resolve(__dirname, "../../md_backend");

// Reuses the backend's local .env (database credentials, CSRF secret) but points
// everything at a dedicated *_e2e database and isolated ports/outbox.
function backendDotEnv(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(path.join(backendDir, ".env"), "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match?.[1]) values[match[1]] = match[2] ?? "";
  }
  return values;
}

const dotEnv = backendDotEnv();
// Derived from the local test database, never from DATABASE_URL (which may be a cloud database).
const databaseUrl =
  process.env.E2E_DATABASE_URL ?? (dotEnv.TEST_DATABASE_URL ?? "").replace(/\/[^/?]+(\?|$)/, "/garment_e2e$1");

const appPort = 3100;
const apiPort = 5100;

export const E2E = {
  backendDir,
  appPort,
  appUrl: `http://localhost:${appPort}`,
  apiUrl: `http://127.0.0.1:${apiPort}`,
  outboxDir: path.join(backendDir, ".outbox-e2e"),
  password: "correct horse battery staple",
  get backendEnv(): Record<string, string> {
    return {
      NODE_ENV: "development",
      PORT: String(apiPort),
      LOG_LEVEL: "warn",
      CLIENT_URL: `http://localhost:${appPort}`,
      DATABASE_URL: databaseUrl,
      // Prisma CLI prefers DIRECT_URL; pin it so .env can never redirect the e2e reset.
      DIRECT_URL: databaseUrl,
      CSRF_SECRET: dotEnv.CSRF_SECRET ?? "e2e-csrf-secret-e2e-csrf-secret-0123456789",
      TRUST_PROXY: "loopback",
      MAIL_TRANSPORT: "outbox",
      MAIL_OUTBOX_DIR: this.outboxDir,
    };
  },
};
