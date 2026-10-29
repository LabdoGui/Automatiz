import { execFileSync } from "node:child_process";
import { loadTestEnv } from "./load-test-env";

/** Antes da suíte: aplica as migrações e o seed (idempotente) no banco de teste. */
export default function setup() {
  loadTestEnv();
  const env = { ...process.env };
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env, stdio: "pipe" });
  execFileSync("npx", ["tsx", "prisma/seed/index.ts"], { env, stdio: "pipe" });
}
