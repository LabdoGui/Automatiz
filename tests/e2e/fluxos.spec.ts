import { expect, test, type Page } from "@playwright/test";

/**
 * Os 12 fluxos principais do VIVA, em sequência, com um usuário novo.
 * Rodar com `npm run test:e2e` (sobe um build de produção no banco viva_test).
 */
test.describe.configure({ mode: "serial" });

const email = `e2e-${Date.now()}@teste.viva.invalid`;
const password = "senha-segura-e2e-123";
let page: Page;

async function dismissCelebrations() {
  const overlay = page.locator("[aria-labelledby=celebration-title]");
  await overlay
    .first()
    .waitFor({ timeout: 2_500 })
    .catch(() => undefined);
  for (let i = 0; i < 8; i++) {
    if ((await overlay.count()) === 0) return;
    await overlay.getByRole("button", { name: "Continuar" }).click();
    await page.waitForTimeout(250);
  }
}

async function continueStep(nextStepLabel: string) {
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByText(nextStepLabel, { exact: true })).toBeVisible();
}

const browserProblems: string[] = [];

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ ...test.info().project.use });
  page = await context.newPage();
  page.on("pageerror", (e) => browserProblems.push(`erro na página: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || /Content Security Policy|Refused to/i.test(m.text())) browserProblems.push(`console: ${m.text()}`);
  });
});

test.afterAll(async () => {
  await page.context().close();
});

test("1. criar conta e entrar", async () => {
  await page.goto("/criar-conta");
  await page.getByLabel("Nome ou apelido").fill("Teste E2E");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.locator("input[name=acceptPrivacy]").check();
  await page.locator("input[name=acceptHealth]").check();
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/\/onboarding/);
});

test("2. completar o onboarding", async () => {
  await expect(page.getByText("Etapa 1 de 9", { exact: true })).toBeVisible();
  await page.locator("input[name=age]").fill("30");
  await page.locator("input[name=heightCm]").fill("170");
  await continueStep("Etapa 2 de 9");
  await page.getByText("Melhorar hábitos").click();
  await continueStep("Etapa 3 de 9");
  await page.locator('label:has-text("Iniciante")').click();
  for (const d of ["Seg", "Qua", "Sex"]) await page.locator(`label:has(span:text-is("${d}"))`).click();
  await page.locator('label:has-text("Academia")').click();
  await continueStep("Etapa 4 de 9");
  await page.locator('label:has-text("Fogão")').click();
  await continueStep("Etapa 5 de 9");
  await continueStep("Etapa 6 de 9");
  await page.locator('label:has-text("Amendoim")').click();
  await continueStep("Etapa 7 de 9");
  await page.locator("input[name=budget]").fill("250,00");
  await continueStep("Etapa 8 de 9");
  await page.locator('label:has-text("Tudo bem — o VIVA não inventa uma meta")').click();
  await continueStep("Etapa 9 de 9");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByText("Resumo", { exact: true })).toBeVisible();
  await expect(page.getByText(/Amendoim/).first()).toBeVisible();
  await page.getByRole("button", { name: "Confirmar e gerar planejamento" }).click();
  await expect(page).toHaveURL(/\/inicio/, { timeout: 60_000 });
  await dismissCelebrations();
});

test("3. criar um planejamento semanal", async () => {
  await expect(page.getByText("Sua semana está pronta.")).toBeVisible();
  await page.goto("/alimentacao");
  await expect(page.locator('a[href^="/alimentacao/refeicao/"]').first()).toBeVisible();
  expect(await page.locator('a[href^="/alimentacao/refeicao/"]').count()).toBeGreaterThan(3);
});

test("4. editar uma refeição", async () => {
  await page.locator('a[href^="/alimentacao/refeicao/"]').first().click();
  await expect(page).toHaveURL(/\/alimentacao\/refeicao\//);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  const dialog = page.locator("dialog[open]");
  await dialog.locator("input[name=title]").fill("Refeição editada no E2E");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Refeição editada no E2E");

  const adjust = page.getByRole("button", { name: /^Ajustar quantidade de / }).first();
  await adjust.click();
  await page.locator("dialog[open] input[name=grams]").fill("123");
  await page.locator("dialog[open]").getByRole("button", { name: "Salvar quantidade" }).click();
  await expect(page.getByText(/123 g/).first()).toBeVisible();
});

test("5. substituir um ingrediente", async () => {
  const triggers = page.getByRole("button", { name: /^Substituir / });
  const total = await triggers.count();
  let swapped = false;
  for (let i = 0; i < total && !swapped; i++) {
    const trigger = triggers.nth(i);
    const label = (await trigger.getAttribute("aria-label")) ?? "";
    await trigger.click();
    const dialog = page.locator("dialog[open]");
    const option = dialog.getByRole("button", { name: "Trocar", exact: true }).first();
    if ((await option.count()) === 0) {
      await page.keyboard.press("Escape");
      continue;
    }
    await option.click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: label, exact: true })).toHaveCount(0);
    swapped = true;
  }
  expect(swapped).toBe(true);
});

test("6. gerar uma lista de compras", async () => {
  await page.goto("/compras");
  await page.getByRole("button", { name: /Gerar lista/ }).first().click();
  await expect(page.locator("[role=checkbox]").first()).toBeVisible({ timeout: 30_000 });
  expect(await page.locator("[role=checkbox]").count()).toBeGreaterThan(5);
  // Plano + lista da semana desbloqueiam "Semana organizada".
  await dismissCelebrations();
});

test("7. marcar produtos como comprados", async () => {
  const first = page.locator("[role=checkbox]").first();
  await expect(first).toHaveAttribute("aria-checked", "false");
  await first.click();
  await expect(first).toHaveAttribute("aria-checked", "true");
});

test("8. registrar um treino", async () => {
  await page.goto("/treino");
  await page.getByRole("button", { name: /^Começar treino/ }).first().click();
  await expect(page).toHaveURL(/\/treino\/sessao\//);
  await page.locator("input[inputmode=numeric]").first().fill("10");
  await page.locator("input[inputmode=decimal]").first().fill("20");
  await page.locator('button[role=checkbox][aria-label^="Série 1"]').first().click();
  await expect(page.locator('button[role=checkbox][aria-label^="Série 1"]').first()).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Finalizar treino" }).last().click();
  await page.locator("dialog[open] select[name=perceivedEffort]").selectOption("6");
  await page.locator("dialog[open]").getByRole("button", { name: "Salvar treino" }).click();
  await expect(page).toHaveURL(/\/treino\/historico\//, { timeout: 30_000 });
});

test("9. desbloquear uma conquista", async () => {
  await expect(page.locator("#celebration-title")).toBeVisible();
  await expect(page.locator("[aria-labelledby=celebration-title]")).toContainText(/Primeiro treino|Nível/);
  await dismissCelebrations();
  await page.goto("/conquistas");
  await expect(page.locator("li", { hasText: "Primeiro treino" }).filter({ hasText: "XP" }).first()).toBeVisible();
});

test("10. consultar o histórico", async () => {
  await page.goto("/treino/historico");
  await expect(page.locator('a[href^="/treino/historico/"]').first()).toBeVisible();
  await page.goto("/alimentacao/historico");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("11. atualizar e recuperar os dados após recarregar a página", async () => {
  await page.goto("/compras");
  await page.reload();
  await expect(page.locator("[role=checkbox][aria-checked=true]").first()).toBeVisible();
  await page.goto("/alimentacao");
  await page.reload();
  await expect(page.getByText("Refeição editada no E2E").first()).toBeVisible();
});

test("12. sair da conta e entrar novamente", async () => {
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL(/\/(entrar|$)/);
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/entrar/);
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/\/inicio/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Teste E2E");
});

test("sem erros no navegador nem violações de CSP durante os fluxos", async () => {
  expect(browserProblems).toEqual([]);
});
