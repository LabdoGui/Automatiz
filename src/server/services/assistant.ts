import "server-only";
import type { AssistantContextInput } from "@/domain/assistant/context";
import { timeToMinutes, type ISODate } from "@/domain/dates";
import type { MealType } from "@/generated/prisma/client";
import { db } from "../db";
import { foodLabel, type FoodRecord } from "./foods";
import { getActivePlan, mealSubstitutions } from "./planner";
import { getOpenList, listSummary } from "./shopping";

// ─────────────────────────────────────────────────────────────
// Conversa com IA (persistida para o próprio usuário; exportável e apagável)
// ─────────────────────────────────────────────────────────────

export async function aiHistory(userId: string, take = 40) {
  const rows = await db.assistantMessage.findMany({
    where: { userId, mode: "AI" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, role: true, content: true, createdAt: true },
  });
  return rows.reverse();
}

export async function saveAiExchange(userId: string, question: string, answer: string) {
  const now = Date.now();
  await db.assistantMessage.createMany({
    data: [
      { userId, mode: "AI", role: "USER", content: question, createdAt: new Date(now) },
      { userId, mode: "AI", role: "ASSISTANT", content: answer, createdAt: new Date(now + 1) },
    ],
  });
}

export async function clearAiHistory(userId: string) {
  const { count } = await db.assistantMessage.deleteMany({ where: { userId, mode: "AI" } });
  return count;
}

/** Dados de entrada do contexto mínimo (ver domain/assistant/context). */
export async function assistantContextInput(userId: string): Promise<AssistantContextInput> {
  const [profile, prefs] = await Promise.all([
    db.profile.findUnique({
      where: { userId },
      select: { goal: true, experienceLevel: true, trainingLocation: true, cookingStyle: true, cookingMinutes: true },
    }),
    db.foodPreference.findMany({ where: { userId }, select: { kind: true, label: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const of = (kind: string) => prefs.filter((p) => p.kind === kind).map((p) => p.label);
  return {
    goal: profile?.goal ?? null,
    experienceLevel: profile?.experienceLevel ?? null,
    trainingLocation: profile?.trainingLocation ?? null,
    cookingStyle: profile?.cookingStyle ?? null,
    cookingMinutes: profile?.cookingMinutes ?? null,
    allergies: of("ALLERGY"),
    intolerances: of("INTOLERANCE"),
    restrictions: of("RESTRICTION"),
    dislikes: of("DISLIKE"),
  };
}

// ─────────────────────────────────────────────────────────────
// Ferramentas do VIVA (determinísticas, sem IA, com os dados do usuário)
// ─────────────────────────────────────────────────────────────

/** Alimentos do plano ativo da semana que têm grupo de substituição, com a porção média usada. */
export async function plannedFoodsForSwap(userId: string, weekStart: ISODate) {
  const plan = await getActivePlan(userId, weekStart);
  if (!plan) return { planId: null, foods: [] };
  const byFood = new Map<string, { food: FoodRecord; total: number; count: number }>();
  for (const meal of plan.meals) {
    for (const item of meal.items) {
      if (!item.food.substitutionGroup) continue;
      const entry = byFood.get(item.food.id) ?? { food: item.food, total: 0, count: 0 };
      entry.total += item.grams;
      entry.count += 1;
      byFood.set(item.food.id, entry);
    }
  }
  const foods = [...byFood.values()]
    .map((e) => ({ food: e.food, avgGrams: Math.round(e.total / e.count / 5) * 5 || 5, count: e.count }))
    .sort((a, b) => foodLabel(a.food).localeCompare(foodLabel(b.food), "pt-BR"));
  return { planId: plan.id, foods };
}

export async function swapOptionsFor(userId: string, food: FoodRecord, grams: number) {
  const map = await mealSubstitutions(userId, [{ id: food.id, grams, food }]);
  return map.get(food.id) ?? [];
}

/** Itens da lista aberta que ainda faltam comprar, com custo restante estimado (só com preços conhecidos). */
export async function missingShopping(userId: string) {
  const list = await getOpenList(userId);
  if (!list) return null;
  const summary = listSummary(list);
  const missing = summary.lines.filter(({ item, line }) => !item.purchased && (item.isManual || line.toBuyG > 0));
  const known = missing.filter(({ line }) => line.purchaseCents !== null);
  return {
    listId: list.id,
    missing,
    remainingCents: known.reduce((acc, { line }) => acc + (line.purchaseCents ?? 0), 0),
    withoutPrice: missing.length - known.length,
    total: summary.lines.length,
  };
}

/**
 * Próxima refeição pendente do dia (para sugerir uma troca rápida): a primeira
 * a partir de uma hora atrás; se todas já passaram, a primeira pendente.
 */
export async function nextPendingMeal(
  userId: string,
  weekStart: ISODate,
  today: ISODate,
  opts: { nowMinutes: number; mealType?: MealType },
) {
  const plan = await getActivePlan(userId, weekStart);
  if (!plan) return null;
  const pending = plan.meals.filter(
    (m) => m.date.toISOString().slice(0, 10) === today && !m.completedAt && (!opts.mealType || m.mealType === opts.mealType),
  );
  return pending.find((m) => m.time && timeToMinutes(m.time) >= opts.nowMinutes - 60) ?? pending[0] ?? null;
}
