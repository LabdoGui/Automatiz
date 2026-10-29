"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDays, isISODate, localDate, startOfWeek } from "@/domain/dates";
import { MEAL_TYPES } from "@/domain/planner/meal-types";
import type { ActionResult } from "@/lib/action-types";
import {
  zBool,
  zDecimal,
  zId,
  zISODate,
  zOptionalText,
  zRequiredText,
  zStringArray,
  zTime,
} from "@/lib/validation";
import { db } from "../db";
import { parseInput, safeAction, UserFacingError } from "../action-utils";
import { consumeRateLimit } from "../rate-limit";
import { requireUser, userTimezone } from "../session";
import * as planner from "../services/planner";
import { recordActivity } from "../services/gamification";

async function ctx() {
  const user = await requireUser();
  const s = await db.userSettings.findUnique({ where: { userId: user.id }, select: { timezone: true } });
  const tz = userTimezone(s);
  return { user, tz, today: localDate(new Date(), tz) };
}

function refresh() {
  revalidatePath("/alimentacao", "layout");
  revalidatePath("/inicio");
  revalidatePath("/compras", "layout");
}

const mealTypeSchema = z.enum(MEAL_TYPES);
const gramsSchema = zDecimal(1, 3000, "a quantidade em gramas");

export async function generatePlanAction(_prev: unknown, formData: FormData): Promise<ActionResult<{ weekStart: string }>> {
  return safeAction<{ weekStart: string }>(async () => {
    const { user, tz } = await ctx();
    const parsed = parseInput(z.object({ weekStart: zISODate }), formData);
    if (!parsed.ok) return parsed.result;
    const weekStart = startOfWeek(parsed.data.weekStart);
    await consumeRateLimit(`plan:${user.id}`, 20, 60 * 60);
    const { notes } = await planner.generatePlan(user.id, weekStart);
    const celebrations = await recordActivity(user.id, [{ kind: "PLAN_CREATED", refId: `week:${weekStart}` }], { timeZone: tz });
    refresh();
    return {
      ok: true,
      message: notes.length ? "Nova sugestão criada. Veja os avisos do plano." : "Nova sugestão criada.",
      celebrations,
      data: { weekStart },
    };
  });
}

export async function activateVersionAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ planId: zId }), formData);
    if (!parsed.ok) return parsed.result;
    await planner.activateVersion(user.id, parsed.data.planId);
    refresh();
    return { ok: true, message: "Versão do plano restaurada." };
  });
}

export async function toggleMealAction(mealId: string, completed: boolean): Promise<ActionResult> {
  return safeAction(async () => {
    const { user, tz } = await ctx();
    if (!zId.safeParse(mealId).success) throw new UserFacingError("Refeição inválida.");
    await planner.setMealCompleted(user.id, mealId, completed);
    const celebrations = completed
      ? await recordActivity(user.id, [{ kind: "MEAL_COMPLETED", refId: mealId }], { timeZone: tz })
      : [];
    refresh();
    return { ok: true, message: completed ? "Refeição concluída." : "Marcação removida.", celebrations };
  });
}

const addMealSchema = z.object({
  planId: zId,
  date: zISODate,
  mealType: mealTypeSchema,
  time: z.preprocess((v) => (v === "" ? undefined : v), zTime.optional()),
  recipeId: z.preprocess((v) => (v === "" ? undefined : v), zId.optional()),
  title: zOptionalText(80),
});

export async function addMealAction(_prev: unknown, formData: FormData): Promise<ActionResult<{ mealId: string }>> {
  return safeAction<{ mealId: string }>(async () => {
    const { user } = await ctx();
    const parsed = parseInput(addMealSchema, formData);
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    const meal = await planner.addMeal(user.id, {
      planId: d.planId,
      date: d.date,
      mealType: d.mealType,
      time: d.time ?? null,
      recipeId: d.recipeId ?? null,
      title: d.title ?? null,
    });
    refresh();
    return { ok: true, message: "Refeição adicionada.", data: { mealId: meal.id } };
  });
}

export async function deleteMealAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ mealId: zId }), formData);
    if (!parsed.ok) return parsed.result;
    await planner.deleteMeal(user.id, parsed.data.mealId);
    refresh();
    return { ok: true, message: "Refeição removida do plano." };
  });
}

export async function updateMealDetailsAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(
      z.object({
        mealId: zId,
        title: zRequiredText("o nome da refeição", 80),
        time: z.preprocess((v) => (v === "" ? undefined : v), zTime.optional()),
        notes: zOptionalText(400),
      }),
      formData,
    );
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    await planner.updateMealDetails(user.id, d.mealId, { title: d.title, time: d.time ?? null, notes: d.notes ?? null });
    refresh();
    return { ok: true, message: "Refeição atualizada." };
  });
}

export async function updateItemAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ itemId: zId, grams: gramsSchema }), formData);
    if (!parsed.ok) return parsed.result;
    await planner.updateItemGrams(user.id, parsed.data.itemId, Math.round(parsed.data.grams));
    refresh();
    return { ok: true, message: "Quantidade atualizada." };
  });
}

export async function removeItemAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ itemId: zId }), formData);
    if (!parsed.ok) return parsed.result;
    await planner.removeItem(user.id, parsed.data.itemId);
    refresh();
    return { ok: true, message: "Ingrediente removido." };
  });
}

export async function addItemAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(
      z.object({ mealId: zId, foodId: z.string().min(1, "Escolha um alimento.").pipe(zId), grams: gramsSchema, confirm: zBool }),
      formData,
    );
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    await planner.addItem(user.id, d.mealId, d.foodId, Math.round(d.grams), d.confirm);
    refresh();
    return { ok: true, message: "Ingrediente adicionado." };
  });
}

export async function substituteItemAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ itemId: zId, foodId: zId, confirm: zBool }), formData);
    if (!parsed.ok) return parsed.result;
    const { food, grams } = await planner.substituteItem(user.id, parsed.data.itemId, parsed.data.foodId, parsed.data.confirm);
    refresh();
    return { ok: true, message: `Trocado por ${food.shortName ?? food.name} (${grams} g).` };
  });
}

export async function duplicateMealAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(
      z.object({ mealId: zId, dates: zStringArray(7).refine((a) => a.every(isISODate), "Data inválida.") }),
      formData,
    );
    if (!parsed.ok) return parsed.result;
    const { count } = await planner.duplicateMeal(user.id, parsed.data.mealId, parsed.data.dates);
    refresh();
    return { ok: true, message: count === 1 ? "Refeição copiada para 1 dia." : `Refeição copiada para ${count} dias.` };
  });
}

export async function replaceRecipeAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ mealId: zId, recipeId: zId }), formData);
    if (!parsed.ok) return parsed.result;
    const { recipe } = await planner.replaceMealRecipe(user.id, parsed.data.mealId, parsed.data.recipeId);
    refresh();
    return { ok: true, message: `Refeição trocada por ${recipe.name}.` };
  });
}

/** Lista que aceita posições vazias (linhas de formulário sem preenchimento). */
const looseArray = (itemMax: number) =>
  z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(z.string().max(itemMax)).max(20));

const logSchema = z.object({
  date: zISODate,
  mealType: z.preprocess((v) => (v === "" ? undefined : v), mealTypeSchema.optional()),
  title: zRequiredText("o que você comeu", 80),
  notes: zOptionalText(400),
  foodId: looseArray(64),
  grams: looseArray(12),
});

export async function logMealAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user, tz, today } = await ctx();
    const parsed = parseInput(logSchema, formData);
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    if (d.date > today) return { ok: false, error: "Não é possível registrar refeições no futuro.", fieldErrors: { date: ["Escolha hoje ou um dia anterior."] } };
    if (d.date < addDays(today, -60)) return { ok: false, error: "Registre refeições dos últimos 60 dias.", fieldErrors: { date: ["Data muito antiga."] } };
    const items: { foodId: string; grams: number }[] = [];
    d.foodId.forEach((foodId, i) => {
      const g = Number((d.grams[i] ?? "").replace(",", "."));
      if (foodId && Number.isFinite(g) && g > 0 && g <= 3000) items.push({ foodId, grams: Math.round(g) });
    });
    const log = await planner.logMeal(user.id, { date: d.date, mealType: d.mealType ?? null, title: d.title, notes: d.notes ?? null, items });
    const celebrations = await recordActivity(user.id, [{ kind: "MEAL_LOGGED", refId: log.id }], { timeZone: tz });
    refresh();
    return {
      ok: true,
      message: items.length ? "Refeição registrada." : "Refeição registrada sem detalhes nutricionais.",
      celebrations,
    };
  });
}

export async function deleteLogAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ logId: zId }), formData);
    if (!parsed.ok) return parsed.result;
    await planner.deleteMealLog(user.id, parsed.data.logId);
    refresh();
    return { ok: true, message: "Registro excluído." };
  });
}

export async function applySavingTipAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user, today } = await ctx();
    const parsed = parseInput(z.object({ planId: zId, fromFoodId: zId, toFoodId: zId }), formData);
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    const count = await planner.substituteFoodInPlan(user.id, d.planId, d.fromFoodId, d.toFoodId, today);
    refresh();
    return { ok: true, message: count ? `Troca aplicada em ${count} ${count === 1 ? "refeição" : "refeições"}. Gere a lista novamente para atualizar.` : "Nenhuma refeição pendente para trocar." };
  });
}

// ─────────────────────────────────────────────────────────────
// Despensa
// ─────────────────────────────────────────────────────────────

export async function setPantryAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ foodId: z.string().min(1, "Escolha um alimento.").pipe(zId), grams: zDecimal(0, 100_000, "a quantidade") }), formData);
    if (!parsed.ok) return parsed.result;
    const food = await db.food.findFirst({ where: { id: parsed.data.foodId, OR: [{ ownerId: null }, { ownerId: user.id }] } });
    if (!food) throw new UserFacingError("Alimento não encontrado.");
    // A despensa guarda o alimento como é comprado (ex.: arroz cru).
    const foodId = food.purchaseFoodId ?? food.id;
    if (parsed.data.grams === 0) {
      await db.pantryItem.deleteMany({ where: { userId: user.id, foodId } });
    } else {
      await db.pantryItem.upsert({
        where: { userId_foodId: { userId: user.id, foodId } },
        create: { userId: user.id, foodId, quantityG: Math.round(parsed.data.grams) },
        update: { quantityG: Math.round(parsed.data.grams) },
      });
    }
    const pantryCount = await db.pantryItem.count({ where: { userId: user.id } });
    const celebrations = pantryCount >= 5 ? await recordActivity(user.id, []) : [];
    refresh();
    return { ok: true, message: "Despensa atualizada.", celebrations };
  });
}

export async function removePantryAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ itemId: zId }), formData);
    if (!parsed.ok) return parsed.result;
    await db.pantryItem.deleteMany({ where: { id: parsed.data.itemId, userId: user.id } });
    refresh();
    return { ok: true, message: "Item removido da despensa." };
  });
}
