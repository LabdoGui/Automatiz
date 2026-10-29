/**
 * Conta de demonstração do VIVA (opcional, para avaliar o app rapidamente).
 *
 *   npm run db:seed:demo
 *
 * Cria (ou recria) o usuário demo@viva.local com perfil, plano da semana,
 * rotina de treino, lista de compras e alguns preços. Os preços desta conta
 * têm origem "Exemplo de demonstração" e a observação de que não são preços
 * de mercado — o app exibe essa origem em todas as telas de custo.
 *
 * Requer o seed principal (npm run db:seed) já aplicado.
 */
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { localDate, startOfWeek } from "../../src/domain/dates";
import { db } from "../../src/server/db";
import { CONSENT_VERSION } from "../../src/server/services/account";
import { generatePlan } from "../../src/server/services/planner";
import { generateFromPlan } from "../../src/server/services/shopping";
import { createSuggestedRoutine } from "../../src/server/services/training";
import { recordActivity } from "../../src/server/services/gamification";

const DEMO_EMAIL = "demo@viva.local";
const TIME_ZONE = "America/Sao_Paulo";

/** Valores ilustrativos (centavos). Não representam preços de mercado. */
const DEMO_PRICES: Record<string, number> = {
  "arroz-branco-5kg": 2990,
  "feijao-carioca-1kg": 790,
  "aveia-500g": 690,
  "macarrao-500g": 450,
  "azeite-500ml": 3490,
  "ovos-12": 1290,
  "pao-forma-integral": 990,
  "iogurte-170g": 350,
  "atum-lata": 890,
  "sardinha-lata": 590,
};

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.VIVA_ALLOW_DEMO !== "1") {
    throw new Error("Seed de demonstração bloqueado em produção. Defina VIVA_ALLOW_DEMO=1 se for realmente intencional.");
  }
  if ((await db.food.count()) === 0) throw new Error("Rode antes o seed principal: npm run db:seed");

  const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
  if (existing) {
    // Remove apenas a própria conta de demonstração (e seus dados, em cascata).
    await db.user.delete({ where: { id: existing.id } });
    console.log("Conta de demonstração anterior removida.");
  }

  const password = process.env.VIVA_DEMO_PASSWORD || randomBytes(9).toString("base64url");
  const userId = randomUUID();
  const now = new Date();
  await db.user.create({ data: { id: userId, name: "Demo", email: DEMO_EMAIL, emailVerified: true } });
  await db.account.create({
    data: { id: randomUUID(), userId, accountId: userId, providerId: "credential", password: await hashPassword(password) },
  });
  await db.userSettings.create({ data: { userId, timezone: TIME_ZONE } });
  await db.consentRecord.createMany({
    data: (["PRIVACY_POLICY", "HEALTH_DATA"] as const).map((kind) => ({ userId, kind, version: CONSENT_VERSION })),
  });
  await db.profile.create({
    data: {
      userId,
      displayName: "Demo",
      goal: "HABITS",
      experienceLevel: "BEGINNER",
      trainingLocation: "GYM",
      trainingDaysPerWeek: 3,
      trainingWeekdays: [0, 2, 4],
      trainingTime: "18:30",
      trainingMinutes: 50,
      mealSlots: ["BREAKFAST", "LUNCH", "AFTERNOON_SNACK", "DINNER"],
      mealTimes: ["07:30", "12:30", "16:00", "19:30"],
      cookingStyle: "BALANCED",
      cookingMinutes: 30,
      kitchenEquipment: ["fogao", "micro-ondas"],
      budgetCents: 25000,
      budgetPeriod: "WEEK",
      hasNutritionist: false,
      trackWater: true,
      waterGoalMl: 2000,
      onboardingStep: 9,
      onboardingCompletedAt: now,
    },
  });
  await db.foodPreference.createMany({
    data: [
      { userId, kind: "ALLERGY", tag: "amendoim", label: "Amendoim" },
      { userId, kind: "DISLIKE", label: "Jiló" },
    ],
  });

  const today = localDate(now, TIME_ZONE);
  const { planId } = await generatePlan(userId, startOfWeek(today));
  await createSuggestedRoutine(userId);

  const products = await db.product.findMany({
    where: { ownerId: null, catalogKey: { in: Object.keys(DEMO_PRICES) } },
    select: { id: true, catalogKey: true },
  });
  await db.priceRecord.createMany({
    data: products.map((p) => ({
      userId,
      productId: p.id,
      priceCents: DEMO_PRICES[p.catalogKey!],
      storeName: "Demonstração",
      observedAt: new Date(`${today}T00:00:00Z`),
      source: "DEMO" as const,
      notes: "Valor fictício de demonstração — não é preço de mercado.",
    })),
  });
  await generateFromPlan(userId, planId, startOfWeek(today));

  const breakfast = await db.plannedMeal.findFirst({
    where: { planId, date: new Date(`${today}T00:00:00Z`), mealType: "BREAKFAST" },
  });
  if (breakfast) {
    await db.plannedMeal.update({ where: { id: breakfast.id }, data: { completedAt: now } });
    await recordActivity(userId, [{ kind: "ONBOARDING_DONE", refId: userId }, { kind: "PLAN_CREATED", refId: planId }, { kind: "MEAL_COMPLETED", refId: breakfast.id }], {
      timeZone: TIME_ZONE,
    });
  }

  console.log("\nConta de demonstração pronta:");
  console.log(`  e-mail: ${DEMO_EMAIL}`);
  console.log(`  senha:  ${process.env.VIVA_DEMO_PASSWORD ? "(a definida em VIVA_DEMO_PASSWORD)" : password}`);
  console.log("Os preços desta conta são exemplos de demonstração, não preços de mercado.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
