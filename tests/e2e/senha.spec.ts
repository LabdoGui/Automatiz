import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { MAILBOX } from "../support/e2e-global";
import { findLink, type CapturedMail } from "../support/smtp-sink";

/** Recuperação de senha por e-mail e aceite dos termos, ponta a ponta. */
const email = `senha-${Date.now()}@teste.viva.invalid`;

async function lastMailTo(address: string, subject: string): Promise<CapturedMail> {
  let found: CapturedMail | undefined;
  await expect
    .poll(() => {
      const mails = readFileSync(MAILBOX, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as CapturedMail);
      found = mails.filter((m) => m.to.includes(address) && m.raw.includes(subject)).at(-1);
      return Boolean(found);
    }, { timeout: 15_000 })
    .toBe(true);
  return found!;
}

test("cadastro exige termos, envia confirmação e a senha pode ser redefinida por e-mail", async ({ browser }) => {
  const signup = await browser.newPage();
  await signup.goto("/criar-conta");
  await expect(signup.getByRole("link", { name: "termos de uso" })).toHaveAttribute("href", "/termos");
  await signup.getByLabel("Nome ou apelido").fill("Teste Senha");
  await signup.locator("input[name=email]").fill(email);
  await signup.locator("input[name=password]").fill("senha-original-123");
  await signup.locator("input[name=acceptHealth]").check();
  await signup.locator("button[type=submit]").click();
  await expect(signup.getByText(/termos de uso e a política de privacidade/).first()).toBeVisible();
  await signup.locator("input[name=acceptPrivacy]").check();
  await signup.locator("button[type=submit]").click();
  await expect(signup).toHaveURL(/\/onboarding/);
  const verification = await lastMailTo(email, "Confirme seu e-mail no VIVA");
  expect(findLink(verification.raw, /\/api\/auth\/verify-email\?token=/)).not.toBeNull();
  await signup.close();

  const page = await browser.newPage();
  await page.goto("/entrar");
  await page.getByRole("link", { name: "Esqueci minha senha" }).click();
  await page.locator("input[name=email]").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByText(/Se houver uma conta com esse e-mail/)).toBeVisible();

  const reset = await lastMailTo(email, "Redefinir sua senha do VIVA");
  const link = findLink(reset.raw, /http:\/\/localhost:3100\/redefinir-senha\?token=[A-Za-z0-9_%-]+/);
  expect(link).not.toBeNull();
  await page.goto(link!);
  await page.locator("input[name=password]").fill("senha-nova-456789");
  await page.locator("input[name=confirm]").fill("senha-diferente-0");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByText("As senhas não conferem.").first()).toBeVisible();
  await page.locator("input[name=confirm]").fill("senha-nova-456789");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page).toHaveURL(/\/entrar\?senha=redefinida/);
  await expect(page.getByText("Senha redefinida. Entre com a nova senha.")).toBeVisible();

  // Senha antiga não funciona mais; a nova sim
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill("senha-original-123");
  await page.locator("button[type=submit]").click();
  await expect(page.getByText("E-mail ou senha incorretos.").first()).toBeVisible();
  await page.locator("input[name=password]").fill("senha-nova-456789");
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/\/onboarding/);

  // O mesmo link não pode ser reutilizado
  const again = await browser.newPage();
  await again.goto(link!);
  await again.locator("input[name=password]").fill("outra-senha-7890");
  await again.locator("input[name=confirm]").fill("outra-senha-7890");
  await again.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(again.getByText(/inválido ou já expirou/).first()).toBeVisible();
});
