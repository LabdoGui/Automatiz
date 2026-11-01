import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import integrationSetup from "./integration-global";
import { startSmtpSink } from "./smtp-sink";

export const DEMO_EMAIL = "demo@viva.local";
export const DEMO_PASSWORD = "senha-demo-e2e-123";
export const SMTP_PORT = 2525;
export const MAILBOX = path.resolve("test-results/e2e-emails.jsonl");

/**
 * Banco de teste migrado + catálogo + conta de demonstração, e um servidor
 * SMTP local (porta 2525) que grava os e-mails recebidos em MAILBOX.
 */
export default async function setup() {
  integrationSetup();
  execFileSync("npx", ["tsx", "--tsconfig", "tsconfig.scripts.json", "prisma/seed/demo.ts"], {
    env: { ...process.env, VIVA_DEMO_PASSWORD: DEMO_PASSWORD },
    stdio: "pipe",
  });
  mkdirSync(path.dirname(MAILBOX), { recursive: true });
  writeFileSync(MAILBOX, "");
  const sink = await startSmtpSink(SMTP_PORT, (mail) => appendFileSync(MAILBOX, JSON.stringify(mail) + "\n"));
  return () => sink.close();
}
