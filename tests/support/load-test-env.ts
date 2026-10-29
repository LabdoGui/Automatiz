import path from "node:path";
import { config } from "dotenv";

/** Carrega .env.test e garante que os testes nunca usem o banco de desenvolvimento. */
export function loadTestEnv() {
  config({ path: path.resolve(process.cwd(), ".env.test"), override: true, quiet: true });
  const url = process.env.DATABASE_URL ?? "";
  if (!/\/viva_test(\?|$)/.test(url)) {
    throw new Error("Os testes de integração exigem DATABASE_URL apontando para o banco viva_test (veja .env.test).");
  }
  // A IA nunca é chamada de verdade nos testes: cada teste aponta para o servidor simulado.
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_BASE_URL;
}
