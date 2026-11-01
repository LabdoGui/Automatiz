import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../support/e2e-global";

/**
 * Checagem automática de acessibilidade (axe-core, WCAG 2.1 A e AA) nas
 * páginas públicas e logadas, nos temas escuro e claro.
 */
test.describe.configure({ mode: "serial" });

const PUBLIC = ["/", "/entrar", "/criar-conta", "/esqueci-senha", "/privacidade", "/termos"];
const PRIVATE = [
  "/inicio",
  "/alimentacao",
  "/alimentacao/semana",
  "/alimentacao/registrar",
  "/alimentacao/historico",
  "/alimentacao/alimentos?q=arroz",
  "/alimentacao/despensa",
  "/alimentacao/receitas",
  "/compras",
  "/compras/precos",
  "/treino",
  "/treino/exercicios",
  "/treino/exercicios/agachamento-livre",
  "/treino/rotina",
  "/treino/historico",
  "/progresso",
  "/conquistas",
  "/assistente?ferramenta=trocar",
  "/perfil",
];

async function audit(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.map((v) => ({
    path,
    rule: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.slice(0, 3).map((n) => {
      const d = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number };
      return `${n.target.join(" ")}${d.contrastRatio ? ` (${d.fgColor} sobre ${d.bgColor} = ${d.contrastRatio}:1)` : ""}`;
    }),
  }));
}

for (const theme of ["dark", "light"] as const) {
  test(`páginas sem violações graves de acessibilidade (tema ${theme === "dark" ? "escuro" : "claro"})`, async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({ ...test.info().project.use });
    const page = await context.newPage();
    const violations = [];
    const setTheme = () =>
      context.addCookies([{ name: "viva-theme", value: theme, url: baseURL! }]);
    await setTheme();
    for (const path of PUBLIC) violations.push(...(await audit(page, path)));

    await page.goto("/entrar");
    await page.locator("input[name=email]").fill(DEMO_EMAIL);
    await page.locator("input[name=password]").fill(DEMO_PASSWORD);
    await page.locator("button[type=submit]").click();
    await expect(page).toHaveURL(/\/inicio/);
    await setTheme(); // o login grava a preferência salva; o teste força o tema
    const meal = await page.locator('a[href^="/alimentacao/refeicao/"]').first().getAttribute("href");
    for (const path of [...PRIVATE, ...(meal ? [meal] : [])]) violations.push(...(await audit(page, path)));
    await context.close();

    for (const v of violations) console.log(`[${v.impact}] ${v.path} — ${v.rule}: ${v.help} → ${v.targets.join(" | ")}`);
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
}
