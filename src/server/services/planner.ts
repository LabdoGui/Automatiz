import "server-only";
import type { MealType, Prisma } from "@/generated/prisma/client";
import { addDays, fromDbDate, isISODate, toDbDate, weekDates, type ISODate } from "@/domain/dates";
import {
  dailyGoalFrom,
  mealTotals,
  roundTotals,
  sumTotals,
  type DailyGoal,
  type NutrientTotals,
} from "@/domain/nutrition/calc";
import { equivalentGrams, substitutionOptions, type SubFood } from "@/domain/nutrition/substitution";
import { generateWeek, hashSeed, type GenFood, type GenRecipe } from "@/domain/planner/generator";
import { DEFAULT_MEAL_TIME, DEFAULT_SLOTS_BY_COUNT, MEAL_TYPE_LABEL } from "@/domain/planner/meal-types";
import { weeklyBudgetCents } from "@/domain/pricing/pricing";
import {
  buildRules,
  foodConflicts,
  hasCriticalConflict,
  type Conflict,
  type ExclusionRules,
} from "@/domain/restrictions/engine";
import { db } from "../db";
import { NotFoundError, UserFacingError } from "../action-utils";
import { FOOD_SELECT, factsOf, foodLabel, getFood, substitutionCandidates, type FoodRecord } from "./foods";
import { priceIndexByFood } from "./prices";

// ─────────────────────────────────────────────────────────────
// Contexto do usuário
// ─────────────────────────────────────────────────────────────

export interface PlannerContext {
  rules: ExclusionRules;
  dailyGoal: DailyGoal | null;
  goalSource: "PROFESSIONAL" | "SELF" | null;
  weeklyBudget: { cents: number; derived: boolean } | null;
  slots: { mealType: MealType; time: string | null }[];
}

export async function plannerContext(userId: string): Promise<PlannerContext> {
  const [profile, prefs, goal] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.foodPreference.findMany({ where: { userId } }),
    db.nutritionGoal.findFirst({ where: { userId, active: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const slotsRaw = profile?.mealSlots?.length ? profile.mealSlots : DEFAULT_SLOTS_BY_COUNT[4];
  const slots = slotsRaw.map((mealType, i) => ({
    mealType,
    time: profile?.mealTimes?.[i] ?? DEFAULT_MEAL_TIME[mealType],
  }));
  return {
    rules: buildRules(prefs.map((p) => ({ kind: p.kind, tag: p.tag, label: p.label }))),
    dailyGoal: goal ? dailyGoalFrom(goal) : null,
    goalSource: goal?.source ?? null,
    weeklyBudget:
      profile?.budgetCents && profile.budgetPeriod ? weeklyBudgetCents(profile.budgetCents, profile.budgetPeriod) : null,
    slots,
  };
}

function toGenFood(f: FoodRecord): GenFood {
  return {
    id: f.id,
    name: f.name,
    tags: f.tags,
    family: f.family,
    allergenReviewed: f.allergenReviewed,
    kcal: f.kcal,
    proteinG: f.proteinG,
    carbsG: f.carbsG,
    fatG: f.fatG,
    fiberG: f.fiberG,
    purchaseFoodId: f.purchaseFoodId,
    purchaseFactor: f.purchaseFactor,
  };
}

export function toSubFood(f: FoodRecord): SubFood {
  return { ...toGenFood(f), shortName: f.shortName, substitutionGroup: f.substitutionGroup };
}

// ─────────────────────────────────────────────────────────────
// Geração do plano
// ─────────────────────────────────────────────────────────────

export async function generatePlan(userId: string, weekStart: ISODate): Promise<{ planId: string; notes: string[] }> {
  if (!isISODate(weekStart)) throw new UserFacingError("Semana inválida.");
  const [profile, ctx, recipes, pantry, prices] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    plannerContext(userId),
    db.recipe.findMany({
      where: { OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { ingredients: { include: { food: { select: FOOD_SELECT } }, orderBy: { position: "asc" } } },
    }),
    db.pantryItem.findMany({ where: { userId, quantityG: { gt: 0 } }, select: { foodId: true } }),
    priceIndexByFood(userId),
  ]);
  if (!profile) throw new UserFacingError("Complete seu perfil antes de gerar o planejamento.");

  const foods = new Map<string, GenFood>();
  const genRecipes: GenRecipe[] = recipes.map((r) => {
    for (const i of r.ingredients) foods.set(i.food.id, toGenFood(i.food));
    return {
      id: r.id,
      name: r.name,
      mealTypes: r.mealTypes,
      prepMinutes: r.prepMinutes,
      equipment: r.equipment,
      tags: r.tags,
      ingredients: r.ingredients.map((i) => ({
        foodId: i.foodId,
        grams: i.grams,
        scalable: i.scalable,
        householdMeasure: i.householdMeasure,
      })),
    };
  });

  const maxPrep =
    profile.cookingMinutes ?? (profile.cookingStyle === "QUICK" ? 20 : profile.cookingStyle === "BALANCED" ? 40 : null);

  const existing = await db.mealPlan.findMany({
    where: { userId, weekStart: toDbDate(weekStart) },
    select: { version: true },
    orderBy: { version: "desc" },
    take: 1,
  });
  const version = (existing[0]?.version ?? 0) + 1;

  const output = generateWeek({
    weekStart,
    slots: ctx.slots,
    recipes: genRecipes,
    foods,
    rules: ctx.rules,
    kitchenEquipment: profile.kitchenEquipment.length > 0 ? profile.kitchenEquipment : null,
    maxPrepMinutes: maxPrep,
    pantryFoodIds: new Set(pantry.map((p) => p.foodId)),
    dailyKcalTarget: ctx.dailyGoal?.kcal ?? null,
    weeklyBudgetCents: ctx.weeklyBudget?.cents ?? null,
    costPerGramCents: new Map([...prices].map(([foodId, p]) => [foodId, p.perGramCents])),
    flexible:
      profile.flexibleMealEnabled && profile.flexibleMealWeekday !== null && profile.flexibleMealType
        ? { weekday: profile.flexibleMealWeekday, mealType: profile.flexibleMealType }
        : null,
    seed: hashSeed(`${userId}:${weekStart}:${version}`),
  });

  const notes = [...output.notes];
  if (profile.kitchenEquipment.length === 0) {
    notes.push("Informe seus utensílios de cozinha no perfil para sugestões mais adequadas.");
  }

  const plan = await db.$transaction(async (tx) => {
    await tx.mealPlan.updateMany({
      where: { userId, weekStart: toDbDate(weekStart), status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });
    const created = await tx.mealPlan.create({
      data: {
        userId,
        weekStart: toDbDate(weekStart),
        name: version === 1 ? "Plano da semana" : `Sugestão ${version}`,
        version,
        notes,
      },
    });
    for (const [position, m] of output.meals.entries()) {
      await tx.plannedMeal.create({
        data: {
          planId: created.id,
          date: toDbDate(m.date),
          mealType: m.mealType,
          time: m.time,
          title: m.title,
          recipeId: m.recipeId,
          isFlexible: m.isFlexible,
          portionFactor: m.portionFactor,
          position,
          items: {
            create: m.items.map((it, i) => ({
              foodId: it.foodId,
              grams: it.grams,
              householdMeasure: it.householdMeasure,
              position: i,
            })),
          },
        },
      });
    }
    return created;
  });
  return { planId: plan.id, notes };
}

// ─────────────────────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────────────────────

const MEAL_INCLUDE = {
  items: { include: { food: { select: FOOD_SELECT } }, orderBy: { position: "asc" } },
  recipe: { select: { id: true, slug: true, name: true, prepMinutes: true, steps: true, equipment: true, tags: true, description: true } },
} satisfies Prisma.PlannedMealInclude;

export type PlannedMealFull = Prisma.PlannedMealGetPayload<{ include: typeof MEAL_INCLUDE }>;

export async function getActivePlan(userId: string, weekStart: ISODate) {
  return db.mealPlan.findFirst({
    where: { userId, weekStart: toDbDate(weekStart), status: "ACTIVE" },
    include: { meals: { include: MEAL_INCLUDE, orderBy: [{ date: "asc" }, { position: "asc" }] } },
    orderBy: { createdAt: "desc" },
  });
}

export type PlanFull = NonNullable<Awaited<ReturnType<typeof getActivePlan>>>;

export async function planVersions(userId: string, weekStart: ISODate) {
  return db.mealPlan.findMany({
    where: { userId, weekStart: toDbDate(weekStart) },
    select: { id: true, name: true, version: true, status: true, createdAt: true, _count: { select: { meals: true } } },
    orderBy: { version: "desc" },
  });
}

export async function activateVersion(userId: string, planId: string) {
  const plan = await db.mealPlan.findFirst({ where: { id: planId, userId } });
  if (!plan) throw new NotFoundError("Plano");
  await db.$transaction([
    db.mealPlan.updateMany({ where: { userId, weekStart: plan.weekStart, status: "ACTIVE" }, data: { status: "ARCHIVED" } }),
    db.mealPlan.update({ where: { id: plan.id }, data: { status: "ACTIVE" } }),
  ]);
  return fromDbDate(plan.weekStart);
}

export async function getMeal(userId: string, mealId: string): Promise<PlannedMealFull & { plan: { id: string; weekStart: Date } }> {
  const meal = await db.plannedMeal.findFirst({
    where: { id: mealId, plan: { userId } },
    include: { ...MEAL_INCLUDE, plan: { select: { id: true, weekStart: true } } },
  });
  if (!meal) throw new NotFoundError("Refeição");
  return meal;
}

export function mealNutrition(meal: { items: { grams: number; food: FoodRecord }[]; isFlexible: boolean }): NutrientTotals {
  return mealTotals(meal.items.map((i) => ({ facts: factsOf(i.food), grams: i.grams })));
}

export interface DaySummary {
  date: ISODate;
  meals: PlannedMealFull[];
  totals: NutrientTotals;
  completed: number;
  planned: number;
  hasFlexible: boolean;
}

export function summarizePlan(plan: PlanFull | null, weekStart: ISODate): { days: DaySummary[]; week: NutrientTotals } {
  const days = weekDates(weekStart).map((date) => {
    const meals = plan ? plan.meals.filter((m) => fromDbDate(m.date) === date) : [];
    const totals = sumTotals(meals.map(mealNutrition));
    return {
      date,
      meals,
      totals: roundTotals(totals),
      completed: meals.filter((m) => m.completedAt).length,
      planned: meals.length,
      hasFlexible: meals.some((m) => m.isFlexible),
    };
  });
  return { days, week: roundTotals(sumTotals(days.map((d) => d.totals))) };
}

// ─────────────────────────────────────────────────────────────
// Edição de refeições
// ─────────────────────────────────────────────────────────────

async function ownedPlan(userId: string, planId: string) {
  const plan = await db.mealPlan.findFirst({ where: { id: planId, userId } });
  if (!plan) throw new NotFoundError("Plano");
  return plan;
}

async function ownedItem(userId: string, itemId: string) {
  const item = await db.plannedMealItem.findFirst({
    where: { id: itemId, plannedMeal: { plan: { userId } } },
    include: { food: { select: FOOD_SELECT }, plannedMeal: true },
  });
  if (!item) throw new NotFoundError("Ingrediente");
  return item;
}

export async function conflictsFor(userId: string, food: FoodRecord): Promise<Conflict[]> {
  const ctx = await plannerContext(userId);
  return foodConflicts(food, ctx.rules);
}

/** Exige confirmação explícita para adicionar alimento com alergênico/restrição registrada. */
async function guardConflicts(userId: string, food: FoodRecord, confirmed: boolean) {
  const conflicts = await conflictsFor(userId, food);
  if (hasCriticalConflict(conflicts) && !confirmed) {
    const labels = conflicts.filter((c) => c.level === "critical").map((c) => c.label);
    throw new UserFacingError(
      `Atenção: ${foodLabel(food)} conflita com ${labels.join(", ")}. Marque a confirmação se quiser adicionar mesmo assim.`,
    );
  }
}

export async function addMeal(
  userId: string,
  data: { planId: string; date: ISODate; mealType: MealType; time: string | null; recipeId: string | null; title: string | null },
) {
  const plan = await ownedPlan(userId, data.planId);
  const weekStart = fromDbDate(plan.weekStart);
  if (data.date < weekStart || data.date > addDays(weekStart, 6)) throw new UserFacingError("Data fora da semana do plano.");
  let title = data.title?.trim() || MEAL_TYPE_LABEL[data.mealType];
  let items: { foodId: string; grams: number; householdMeasure: string | null; position: number }[] = [];
  if (data.recipeId) {
    const recipe = await db.recipe.findFirst({
      where: { id: data.recipeId, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { ingredients: { include: { food: { select: FOOD_SELECT } }, orderBy: { position: "asc" } } },
    });
    if (!recipe) throw new NotFoundError("Receita");
    const ctx = await plannerContext(userId);
    const conflicts = recipe.ingredients.flatMap((i) => foodConflicts(i.food, ctx.rules));
    if (hasCriticalConflict(conflicts)) {
      throw new UserFacingError("Essa receita tem ingredientes incompatíveis com suas alergias ou restrições.");
    }
    title = recipe.name;
    items = recipe.ingredients.map((i) => ({ foodId: i.foodId, grams: i.grams, householdMeasure: i.householdMeasure, position: i.position }));
  }
  const count = await db.plannedMeal.count({ where: { planId: plan.id, date: toDbDate(data.date) } });
  return db.plannedMeal.create({
    data: {
      planId: plan.id,
      date: toDbDate(data.date),
      mealType: data.mealType,
      time: data.time ?? DEFAULT_MEAL_TIME[data.mealType],
      title,
      recipeId: data.recipeId,
      position: count + 100,
      customized: !data.recipeId,
      items: { create: items },
    },
  });
}

export async function deleteMeal(userId: string, mealId: string) {
  const meal = await getMeal(userId, mealId);
  await db.plannedMeal.delete({ where: { id: meal.id } });
  return meal;
}

export async function setMealCompleted(userId: string, mealId: string, completed: boolean) {
  const meal = await getMeal(userId, mealId);
  await db.plannedMeal.update({ where: { id: meal.id }, data: { completedAt: completed ? new Date() : null } });
  return meal;
}

export async function updateMealDetails(userId: string, mealId: string, data: { title: string; time: string | null; notes: string | null }) {
  const meal = await getMeal(userId, mealId);
  await db.plannedMeal.update({ where: { id: meal.id }, data: { title: data.title, time: data.time, notes: data.notes } });
  return meal;
}

export async function updateItemGrams(userId: string, itemId: string, grams: number) {
  const item = await ownedItem(userId, itemId);
  await db.$transaction([
    db.plannedMealItem.update({ where: { id: item.id }, data: { grams, householdMeasure: null } }),
    db.plannedMeal.update({ where: { id: item.plannedMealId }, data: { customized: true } }),
  ]);
  return item;
}

export async function removeItem(userId: string, itemId: string) {
  const item = await ownedItem(userId, itemId);
  await db.$transaction([
    db.plannedMealItem.delete({ where: { id: item.id } }),
    db.plannedMeal.update({ where: { id: item.plannedMealId }, data: { customized: true } }),
  ]);
  return item;
}

export async function addItem(userId: string, mealId: string, foodId: string, grams: number, confirmed: boolean) {
  const meal = await getMeal(userId, mealId);
  const food = await getFood(userId, foodId);
  if (!food) throw new NotFoundError("Alimento");
  await guardConflicts(userId, food, confirmed);
  await db.$transaction([
    db.plannedMealItem.create({ data: { plannedMealId: meal.id, foodId: food.id, grams, position: meal.items.length } }),
    db.plannedMeal.update({ where: { id: meal.id }, data: { customized: true, isFlexible: false } }),
  ]);
  return meal;
}

export async function substituteItem(userId: string, itemId: string, newFoodId: string, confirmed: boolean) {
  const item = await ownedItem(userId, itemId);
  const food = await getFood(userId, newFoodId);
  if (!food) throw new NotFoundError("Alimento");
  await guardConflicts(userId, food, confirmed);
  const eq = equivalentGrams(toSubFood(item.food), item.grams, toSubFood(food));
  const grams = eq?.grams ?? item.grams;
  await db.$transaction([
    db.plannedMealItem.update({ where: { id: item.id }, data: { foodId: food.id, grams, householdMeasure: null } }),
    db.plannedMeal.update({ where: { id: item.plannedMealId }, data: { customized: true } }),
  ]);
  return { item, food, grams };
}

export async function itemSubstitutions(userId: string, itemId: string) {
  const item = await ownedItem(userId, itemId);
  if (!item.food.substitutionGroup) return { item, options: [] };
  const [ctx, candidates, prices] = await Promise.all([
    plannerContext(userId),
    substitutionCandidates(userId, item.food.substitutionGroup),
    priceIndexByFood(userId),
  ]);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const options = substitutionOptions({
    from: toSubFood(item.food),
    grams: item.grams,
    candidates: candidates.map(toSubFood),
    rules: ctx.rules,
    costPerGram: (f) => {
      const purchaseId = f.purchaseFoodId ?? f.id;
      const p = prices.get(purchaseId);
      return p ? p.perGramCents * (f.purchaseFoodId && f.purchaseFactor ? f.purchaseFactor : 1) : null;
    },
    limit: 10,
  }).map((o) => ({ ...o, record: byId.get(o.food.id)! }));
  return { item, options };
}

export async function duplicateMeal(userId: string, mealId: string, dates: ISODate[]) {
  const meal = await getMeal(userId, mealId);
  const weekStart = fromDbDate(meal.plan.weekStart);
  const valid = dates.filter((d) => isISODate(d) && d >= weekStart && d <= addDays(weekStart, 6) && d !== fromDbDate(meal.date));
  if (valid.length === 0) throw new UserFacingError("Escolha pelo menos um dia diferente desta semana.");
  await db.$transaction(
    valid.map((d) =>
      db.plannedMeal.create({
        data: {
          planId: meal.planId,
          date: toDbDate(d),
          mealType: meal.mealType,
          time: meal.time,
          title: meal.title,
          recipeId: meal.recipeId,
          isFlexible: meal.isFlexible,
          customized: meal.customized,
          portionFactor: meal.portionFactor,
          notes: meal.notes,
          position: meal.position + 50,
          items: {
            create: meal.items.map((i) => ({
              foodId: i.foodId,
              grams: i.grams,
              householdMeasure: i.householdMeasure,
              position: i.position,
            })),
          },
        },
      }),
    ),
  );
  return { meal, count: valid.length };
}

/** Troca a receita de uma refeição (ex.: por algo mais rápido), mantendo dia e horário. */
export async function replaceMealRecipe(userId: string, mealId: string, recipeId: string) {
  const meal = await getMeal(userId, mealId);
  const recipe = await db.recipe.findFirst({
    where: { id: recipeId, OR: [{ ownerId: null }, { ownerId: userId }] },
    include: { ingredients: { include: { food: { select: FOOD_SELECT } }, orderBy: { position: "asc" } } },
  });
  if (!recipe) throw new NotFoundError("Receita");
  const ctx = await plannerContext(userId);
  if (hasCriticalConflict(recipe.ingredients.flatMap((i) => foodConflicts(i.food, ctx.rules)))) {
    throw new UserFacingError("Essa receita tem ingredientes incompatíveis com suas alergias ou restrições.");
  }
  await db.$transaction([
    db.plannedMealItem.deleteMany({ where: { plannedMealId: meal.id } }),
    db.plannedMeal.update({
      where: { id: meal.id },
      data: {
        recipeId: recipe.id,
        title: recipe.name,
        isFlexible: false,
        customized: false,
        portionFactor: 1,
        items: {
          create: recipe.ingredients.map((i) => ({
            foodId: i.foodId,
            grams: i.grams,
            householdMeasure: i.householdMeasure,
            position: i.position,
          })),
        },
      },
    }),
  ]);
  return { meal, recipe };
}

/** Receitas compatíveis com o usuário para um tipo de refeição. */
export async function compatibleRecipes(userId: string, mealType: MealType | null, opts: { maxPrep?: number } = {}) {
  const [ctx, recipes] = await Promise.all([
    plannerContext(userId),
    db.recipe.findMany({
      where: {
        OR: [{ ownerId: null }, { ownerId: userId }],
        ...(mealType ? { mealTypes: { has: mealType } } : {}),
        ...(opts.maxPrep ? { prepMinutes: { lte: opts.maxPrep } } : {}),
      },
      include: { ingredients: { include: { food: { select: FOOD_SELECT } } } },
      orderBy: [{ prepMinutes: "asc" }, { name: "asc" }],
    }),
  ]);
  return recipes
    .filter((r) => r.ingredients.every((i) => foodConflicts(i.food, ctx.rules).length === 0))
    .map((r) => ({
      id: r.id,
      name: r.name,
      prepMinutes: r.prepMinutes,
      tags: r.tags,
      mealTypes: r.mealTypes,
      totals: roundTotals(mealTotals(r.ingredients.map((i) => ({ facts: factsOf(i.food), grams: i.grams })))),
    }));
}

/** Substitui um alimento por outro em todas as refeições futuras do plano (quantidade equivalente). */
export async function substituteFoodInPlan(
  userId: string,
  planId: string,
  fromFoodId: string,
  toFoodId: string,
  fromDate: ISODate,
) {
  const plan = await ownedPlan(userId, planId);
  const [from, to] = await Promise.all([getFood(userId, fromFoodId), getFood(userId, toFoodId)]);
  if (!from || !to) throw new NotFoundError("Alimento");
  const ctx = await plannerContext(userId);
  if (foodConflicts(to, ctx.rules).length > 0) throw new UserFacingError("Essa troca não é compatível com suas preferências.");
  const items = await db.plannedMealItem.findMany({
    where: { foodId: from.id, plannedMeal: { planId: plan.id, date: { gte: toDbDate(fromDate) }, completedAt: null } },
  });
  for (const item of items) {
    const eq = equivalentGrams(toSubFood(from), item.grams, toSubFood(to));
    await db.$transaction([
      db.plannedMealItem.update({ where: { id: item.id }, data: { foodId: to.id, grams: eq?.grams ?? item.grams, householdMeasure: null } }),
      db.plannedMeal.update({ where: { id: item.plannedMealId }, data: { customized: true } }),
    ]);
  }
  return items.length;
}

// ─────────────────────────────────────────────────────────────
// Registros fora do planejamento e histórico
// ─────────────────────────────────────────────────────────────

export async function logMeal(
  userId: string,
  data: { date: ISODate; mealType: MealType | null; title: string; notes: string | null; items: { foodId: string; grams: number }[] },
) {
  const foods = await db.food.findMany({
    where: { id: { in: data.items.map((i) => i.foodId) }, OR: [{ ownerId: null }, { ownerId: userId }] },
    select: { id: true },
  });
  const valid = new Set(foods.map((f) => f.id));
  const items = data.items.filter((i) => valid.has(i.foodId));
  return db.mealLog.create({
    data: {
      userId,
      date: toDbDate(data.date),
      mealType: data.mealType,
      title: data.title,
      notes: data.notes,
      items: { create: items },
    },
  });
}

export async function deleteMealLog(userId: string, logId: string) {
  const res = await db.mealLog.deleteMany({ where: { id: logId, userId } });
  if (res.count === 0) throw new NotFoundError("Registro");
}

export async function dayLogs(userId: string, date: ISODate) {
  return db.mealLog.findMany({
    where: { userId, date: toDbDate(date) },
    include: { items: { include: { food: { select: FOOD_SELECT } } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function history(userId: string, from: ISODate, to: ISODate) {
  const [meals, logs] = await Promise.all([
    db.plannedMeal.findMany({
      where: { plan: { userId, status: "ACTIVE" }, date: { gte: toDbDate(from), lte: toDbDate(to) } },
      include: { items: { include: { food: { select: FOOD_SELECT } } } },
      orderBy: [{ date: "desc" }, { position: "asc" }],
    }),
    db.mealLog.findMany({
      where: { userId, date: { gte: toDbDate(from), lte: toDbDate(to) } },
      include: { items: { include: { food: { select: FOOD_SELECT } } } },
      orderBy: [{ date: "desc" }, { createdAt: "asc" }],
    }),
  ]);
  return { meals, logs };
}

// ─────────────────────────────────────────────────────────────
// Custos estimados (preços informados pelo usuário)
// ─────────────────────────────────────────────────────────────

export function mealCost(
  items: readonly { grams: number; food: { id: string; purchaseFoodId: string | null; purchaseFactor: number | null } }[],
  prices: ReadonlyMap<string, { perGramCents: number }>,
): { cents: number; complete: boolean; priced: boolean } {
  let cents = 0;
  let missing = 0;
  for (const item of items) {
    const p = prices.get(item.food.purchaseFoodId ?? item.food.id);
    if (!p) {
      missing += 1;
      continue;
    }
    const factor = item.food.purchaseFoodId && item.food.purchaseFactor ? item.food.purchaseFactor : 1;
    cents += p.perGramCents * item.grams * factor;
  }
  return { cents: Math.round(cents), complete: missing === 0, priced: items.length - missing > 0 };
}

/** Opções de substituição para todos os itens de uma refeição (consultas compartilhadas). */
export async function mealSubstitutions(userId: string, items: readonly { id: string; grams: number; food: FoodRecord }[]) {
  const groups = [...new Set(items.map((i) => i.food.substitutionGroup).filter(Boolean))] as string[];
  if (groups.length === 0) return new Map<string, ReturnType<typeof substitutionOptions>>();
  const [ctx, candidates, prices] = await Promise.all([
    plannerContext(userId),
    db.food.findMany({
      where: { substitutionGroup: { in: groups }, allergenReviewed: true, OR: [{ ownerId: null }, { ownerId: userId }] },
      select: FOOD_SELECT,
    }),
    priceIndexByFood(userId),
  ]);
  const costPerGram = (f: { id: string; purchaseFoodId: string | null; purchaseFactor: number | null }) => {
    const p = prices.get(f.purchaseFoodId ?? f.id);
    return p ? p.perGramCents * (f.purchaseFoodId && f.purchaseFactor ? f.purchaseFactor : 1) : null;
  };
  const result = new Map<string, ReturnType<typeof substitutionOptions>>();
  for (const item of items) {
    if (!item.food.substitutionGroup) continue;
    result.set(
      item.id,
      substitutionOptions({
        from: toSubFood(item.food),
        grams: item.grams,
        candidates: candidates.filter((c) => c.substitutionGroup === item.food.substitutionGroup).map(toSubFood),
        rules: ctx.rules,
        costPerGram,
        limit: 8,
      }),
    );
  }
  return result;
}
