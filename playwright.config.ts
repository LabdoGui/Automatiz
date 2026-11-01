import path from "node:path";
import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Os testes E2E usam o banco viva_test (.env.test) e um build de produção.
const testEnv = config({ path: path.resolve(".env.test"), quiet: true, processEnv: {} }).parsed ?? {};
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/support/e2e-global.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  projects: [{ name: "celular", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/entrar`,
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...testEnv,
      NEXT_TELEMETRY_DISABLED: "1",
      // E-mails vão para o servidor SMTP local aberto pelo setup global.
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "2525",
      SMTP_SECURE: "false",
      SMTP_REQUIRE_TLS: "false",
      EMAIL_FROM: "VIVA <nao-responda@teste.viva.invalid>",
    },
  },
});
