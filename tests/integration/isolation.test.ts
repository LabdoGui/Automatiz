import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startOfWeek } from "@/domain/dates";
import { db } from "@/server/db";
import { generatePlan, getMeal, setMealCompleted, updateItemGrams } from "@/server/services/planner";
import { deleteMeasurement, listMeasurements, saveMeasurement, createHabit, toggleHabit } from "@/server/services/progress";
import { addPrice, deletePrice, latestPrices } from "@/server/services/prices";
import { generateFromPlan, getList, setPurchased } from "@/server/services/shopping";
import { exportUserData } from "@/server/services/account";
import { cleanupTestUsers, createTestUser } from "../support/factories";

const today = "2026-10-29";
const week = startOfWeek(today);
let a: { id: string; email: string };
let b: { id: string; email: string };

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
});
afterAll(cleanupTestUsers);

describe("isolamento de dados entre usuários", () => {
  it("refeições e itens do plano de A não podem ser lidos nem alterados por B", async () => {
    const { planId } = await generatePlan(a.id, week);
    const plan = await db.mealPlan.findUniqueOrThrow({ where: { id: planId }, include: { meals: { include: { items: true } } } });
    const meal = plan.meals.find((m) => m.items.length > 0)!;

    await expect(getMeal(a.id, meal.id)).resolves.toMatchObject({ id: meal.id });
    await expect(getMeal(b.id, meal.id)).rejects.toThrow(/não encontrad/i);
    await expect(setMealCompleted(b.id, meal.id, true)).rejects.toThrow();
    await expect(updateItemGrams(b.id, meal.items[0].id, 999)).rejects.toThrow();

    const after = await db.plannedMealItem.findUniqueOrThrow({ where: { id: meal.items[0].id } });
    expect(after.grams).toBe(meal.items[0].grams);
    expect((await db.plannedMeal.findUniqueOrThrow({ where: { id: meal.id } })).completedAt).toBeNull();
  });

  it("listas de compras de A não aparecem nem são marcadas por B", async () => {
    const plan = await db.mealPlan.findFirstOrThrow({ where: { userId: a.id, status: "ACTIVE" } });
    const listId = await generateFromPlan(a.id, plan.id, today);
    expect(listId).toEqual(expect.any(String));
    await expect(getList(b.id, listId)).rejects.toThrow(/não encontrad/i);
    const item = (await getList(a.id, listId)).items[0];
    await expect(setPurchased(b.id, item.id, true, 500, today)).rejects.toThrow();
    expect((await db.shoppingListItem.findUniqueOrThrow({ where: { id: item.id } })).purchased).toBe(false);
  });

  it("medidas, hábitos e preços são privados", async () => {
    const input = { date: today, weightKg: 70.5, waistCm: null, hipCm: null, chestCm: null, armCm: null, thighCm: null, notes: null };
    await saveMeasurement(a.id, null, input);
    const [m] = await listMeasurements(a.id);
    expect(await listMeasurements(b.id)).toHaveLength(0);
    await expect(saveMeasurement(b.id, m.id, { ...input, weightKg: 50 })).rejects.toThrow(/não encontrad/i);
    await expect(deleteMeasurement(b.id, m.id)).rejects.toThrow(/não encontrad/i);
    const [still] = await listMeasurements(a.id);
    expect(still.weightKg).toBe(70.5);

    const habit = await createHabit(a.id, "Dormir cedo", "sparkles");
    await expect(toggleHabit(b.id, habit.id, today)).rejects.toThrow();

    const product = await db.product.findFirstOrThrow({ where: { ownerId: null } });
    const price = await addPrice(a.id, { productId: product.id, priceCents: 1234, storeName: "Mercado A", observedAt: today, source: "USER" });
    expect((await latestPrices(b.id)).has(product.id)).toBe(false);
    await expect(deletePrice(b.id, price.id)).rejects.toThrow();
    expect(await db.priceRecord.count({ where: { id: price.id } })).toBe(1);
  });

  it("a exportação (LGPD) contém apenas os dados do próprio usuário", async () => {
    const data = await exportUserData(b.id);
    const json = JSON.stringify(data);
    expect(json).toContain(b.email);
    expect(json).not.toContain(a.email);
    expect(json).not.toContain(a.id);
  });

  it("excluir a conta remove os dados em cascata", async () => {
    const extra = await createTestUser();
    await generatePlan(extra.id, week);
    await db.user.delete({ where: { id: extra.id } });
    expect(await db.mealPlan.count({ where: { userId: extra.id } })).toBe(0);
    expect(await db.profile.count({ where: { userId: extra.id } })).toBe(0);
  });
});
