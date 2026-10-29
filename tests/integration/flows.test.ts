import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startOfWeek } from "@/domain/dates";
import { XP_REWARDS } from "@/domain/gamification/rules";
import { db } from "@/server/db";
import { generatePlan, substituteItem } from "@/server/services/planner";
import { completeList, generateFromPlan, getList, itemLine, setPurchased } from "@/server/services/shopping";
import { addPrice, importPricesCsv } from "@/server/services/prices";
import { recordActivity } from "@/server/services/gamification";
import { saveGoal } from "@/server/services/profile";
import {
  createSuggestedRoutine,
  exerciseProgress,
  finishSession,
  getActiveRoutine,
  logSet,
  sessionHistory,
  startSession,
} from "@/server/services/training";
import { importProviderQuotes } from "@/server/integrations/price-providers";
import { cleanupTestUsers, createTestUser } from "../support/factories";

const today = "2026-10-29";
const week = startOfWeek(today);
afterAll(cleanupTestUsers);

describe("planejamento respeita alergias", () => {
  let user: { id: string };
  beforeAll(async () => {
    user = await createTestUser({ allergies: [{ tag: "amendoim", label: "Amendoim" }, { tag: "leite", label: "Leite" }] });
  });

  it("nenhum alimento do plano contém (ou pode conter) os alergênicos, e todos foram revisados", async () => {
    const { planId } = await generatePlan(user.id, week);
    const items = await db.plannedMealItem.findMany({ where: { plannedMeal: { planId } }, include: { food: true } });
    expect(items.length).toBeGreaterThan(10);
    for (const { food } of items) {
      expect(food.allergenReviewed).toBe(true);
      expect(food.tags.filter((t) => ["amendoim", "traco:amendoim", "leite", "traco:leite"].includes(t))).toEqual([]);
    }
  });

  it("trocar por um alimento com alergênico exige confirmação explícita", async () => {
    const item = await db.plannedMealItem.findFirstOrThrow({ where: { plannedMeal: { plan: { userId: user.id } } } });
    const peanut = await db.food.findFirstOrThrow({ where: { tags: { has: "amendoim" }, ownerId: null } });
    await expect(substituteItem(user.id, item.id, peanut.id, false)).rejects.toThrow(/Atenção/);
    expect((await db.plannedMealItem.findUniqueOrThrow({ where: { id: item.id } })).foodId).toBe(item.foodId);
    await substituteItem(user.id, item.id, peanut.id, true);
    expect((await db.plannedMealItem.findUniqueOrThrow({ where: { id: item.id } })).foodId).toBe(peanut.id);
  });
});

describe("lista de compras: consolidação, compra e despensa", () => {
  it("gera lista consolidada, registra o preço pago e leva sobras para a despensa", async () => {
    const user = await createTestUser();
    const { planId } = await generatePlan(user.id, week);
    const listId = await generateFromPlan(user.id, planId, week);
    const full = await getList(user.id, listId);
    expect(full.items.length).toBeGreaterThan(5);
    const foodIds = full.items.filter((i) => i.foodId).map((i) => i.foodId);
    expect(new Set(foodIds).size).toBe(foodIds.length);
    expect(full.items.every((i) => i.isManual || i.requiredG > 0)).toBe(true);

    // Preço pago vira histórico com origem PAID
    const item = full.items.find((i) => i.productId && !i.soldByWeight && i.packageSize)!;
    await setPurchased(user.id, item.id, true, 1990, today);
    const paid = await db.priceRecord.findFirst({ where: { userId: user.id, productId: item.productId!, source: "PAID" } });
    expect(paid).not.toBeNull();

    const updated = await getList(user.id, listId);
    const leftover = itemLine(updated.items.find((i) => i.id === item.id)!).leftoverG ?? 0;
    await completeList(user.id, listId, true);
    expect((await db.shoppingList.findUniqueOrThrow({ where: { id: listId } })).status).toBe("DONE");
    const pantry = await db.pantryItem.findFirst({ where: { userId: user.id, foodId: item.foodId! } });
    if (leftover > 0) expect(pantry?.quantityG).toBe(Math.round(leftover));
    else expect(pantry).toBeNull();
  });
});

describe("treinos: registro e recuperação", () => {
  it("cria rotina sugerida, registra séries, finaliza e recupera no histórico e na evolução", async () => {
    const user = await createTestUser();
    await createSuggestedRoutine(user.id);
    const routine = await getActiveRoutine(user.id);
    expect(routine?.workouts.length).toBeGreaterThanOrEqual(2);
    const workout = routine!.workouts[0];

    const session = await startSession(user.id, workout.id);
    await expect(finishSession(user.id, session.id, { notes: null, perceivedEffort: null, discomfort: false })).rejects.toThrow(/pelo menos uma série/);

    const full = await db.workoutSession.findUniqueOrThrow({
      where: { id: session.id },
      include: { exercises: { include: { sets: { orderBy: { setNumber: "asc" } } }, orderBy: { position: "asc" } } },
    });
    const first = full.exercises[0];
    await logSet(user.id, first.sets[0].id, { reps: 10, weightKg: 22.5, completed: true });
    await logSet(user.id, first.sets[1].id, { reps: 8, weightKg: 25, completed: true });
    await finishSession(user.id, session.id, { notes: "ok", perceivedEffort: 7, discomfort: false });

    const history = await sessionHistory(user.id);
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("COMPLETED");
    const progress = await exerciseProgress(user.id, first.exerciseId);
    expect(progress.at(-1)).toMatchObject({ maxWeight: 25, sets: 2, volume: 10 * 22.5 + 8 * 25 });

    // Próxima sessão sugere a última carga usada, sem aumento automático
    const next = await startSession(user.id, workout.id);
    const nextFirst = await db.sessionExercise.findFirstOrThrow({
      where: { sessionId: next.id, exerciseId: first.exerciseId },
      include: { sets: true },
    });
    expect(nextFirst.sets.every((s) => s.weightKg === null || s.weightKg <= 25)).toBe(true);
  });
});

describe("gamificação persistente", () => {
  it("XP é idempotente, conquistas persistem e não duplicam", async () => {
    const user = await createTestUser();
    const { planId } = await generatePlan(user.id, week);
    const meal = await db.plannedMeal.findFirstOrThrow({ where: { planId } });
    await db.plannedMeal.update({ where: { id: meal.id }, data: { completedAt: new Date() } });

    const first = await recordActivity(user.id, [{ kind: "MEAL_COMPLETED", refId: meal.id }]);
    expect(first.map((c) => c.title)).toContain("Primeira refeição");
    const xpAfterFirst = (await db.profile.findUniqueOrThrow({ where: { userId: user.id } })).xpTotal;

    const again = await recordActivity(user.id, [{ kind: "MEAL_COMPLETED", refId: meal.id }]);
    expect(again.filter((c) => c.kind === "achievement")).toHaveLength(0);
    expect((await db.profile.findUniqueOrThrow({ where: { userId: user.id } })).xpTotal).toBe(xpAfterFirst);

    const unlocked = await db.userAchievement.findMany({ where: { userId: user.id }, include: { achievement: true } });
    const codes = unlocked.map((u) => u.achievement.code);
    expect(codes).toContain("first-meal");
    expect(new Set(codes).size).toBe(codes.length);
    const events = await db.xpEvent.findMany({ where: { userId: user.id, kind: "MEAL_COMPLETED" } });
    expect(events).toHaveLength(1);
    expect(events[0].amount).toBe(XP_REWARDS.MEAL_COMPLETED);
  });
});

describe("validação no servidor", () => {
  it("metas nutricionais com valores implausíveis são recusadas", async () => {
    const user = await createTestUser();
    const base = { source: "SELF" as const, proteinG: null, carbsG: null, fatG: null, mealsPerDay: null, professionalName: null, notes: null };
    await expect(saveGoal(user.id, { ...base, period: "WEEK", kcal: 2000 })).rejects.toThrow();
    await expect(saveGoal(user.id, { ...base, period: "DAY", kcal: 7000 })).rejects.toThrow();
    await expect(saveGoal(user.id, { ...base, period: "DAY", kcal: 900 })).rejects.toThrow();
    await saveGoal(user.id, { ...base, period: "WEEK", kcal: 14000 });
    const goal = await db.nutritionGoal.findFirstOrThrow({ where: { userId: user.id, active: true } });
    expect(goal.period).toBe("WEEK");
    expect(goal.kcal).toBe(14000);
  });

  it("preço precisa ser positivo e de um produto visível", async () => {
    const user = await createTestUser();
    const product = await db.product.findFirstOrThrow({ where: { ownerId: null } });
    await expect(addPrice(user.id, { productId: product.id, priceCents: 0, storeName: null, observedAt: today, source: "USER" })).rejects.toThrow();
    await expect(addPrice(user.id, { productId: "inexistente", priceCents: 100, storeName: null, observedAt: today, source: "USER" })).rejects.toThrow(/não encontrado/);
  });
});

describe("importação de preços", () => {
  it("CSV: importa linhas válidas e relata erros por linha", async () => {
    const user = await createTestUser();
    const product = await db.product.findFirstOrThrow({ where: { ownerId: null }, orderBy: { name: "asc" } });
    const csv = `produto;preco;loja;data\n${product.name};12,90;Mercado Teste;2026-10-28\nProduto que não existe;5,00;;\n${product.name};abc;;\n`;
    const report = await importPricesCsv(user.id, csv, today);
    expect(report.imported).toBe(1);
    expect(report.errors.map((e) => e.line)).toEqual([3, 4]);
    const rec = await db.priceRecord.findFirstOrThrow({ where: { userId: user.id, productId: product.id } });
    expect(rec).toMatchObject({ priceCents: 1290, source: "IMPORT", storeName: "Mercado Teste" });
  });

  it("integração: cotações inválidas são rejeitadas e as válidas ficam com origem INTEGRATION", async () => {
    const user = await createTestUser();
    const product = await db.product.findFirstOrThrow({ where: { ownerId: null, catalogKey: { not: null } } });
    const report = await importProviderQuotes(
      user.id,
      { name: "Fonte de teste" },
      [
        { productKey: product.catalogKey!, priceCents: 999, storeName: "Loja X", observedAt: "2026-10-27", reference: "oferta-1" },
        { productKey: product.catalogKey!, priceCents: -1, storeName: "Loja X", observedAt: "2026-10-27" },
        { productKey: "nao-existe", priceCents: 100, storeName: "Loja X", observedAt: "2026-10-27" },
      ],
      today,
    );
    expect(report.imported).toBe(1);
    expect(report.rejected.map((r) => r.reason)).toEqual(["preço inválido", "produto não encontrado no catálogo"]);
    const rec = await db.priceRecord.findFirstOrThrow({ where: { userId: user.id, source: "INTEGRATION" } });
    expect(rec.notes).toBe("Fonte: Fonte de teste · oferta-1");
  });
});
