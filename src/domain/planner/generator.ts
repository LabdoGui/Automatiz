import { mealTotals, type NutritionFacts } from "../nutrition/calc";
import { roundTo5 } from "../nutrition/substitution";
import { isFavorite, recipeConflicts, type ExclusionRules, type RestrictionFood } from "../restrictions/engine";
import { addDays, type ISODate } from "../dates";
import { formatBRL, formatInt } from "../format";
import { MEAL_TYPE_LABEL, SLOT_ENERGY_SHARE, type MealType } from "./meal-types";

/**
 * Gerador de planejamento semanal.
 *
 * Princípios:
 *  - Restrições críticas (alergias, intolerâncias, dieta) e aversões nunca são violadas.
 *  - Sem meta registrada, as porções são as de referência das receitas.
 *  - Com meta, as porções são ajustadas dentro de limites (0,75× a 1,5×) — nunca
 *    criamos porções muito reduzidas para "forçar" uma meta.
 *  - O resultado é determinístico para uma mesma semente (útil para testes e
 *    para "gerar nova sugestão" com outra semente sem apagar a anterior).
 */

export interface GenFood extends RestrictionFood, NutritionFacts {
  id: string;
  purchaseFoodId: string | null;
  purchaseFactor: number | null;
}

export interface GenIngredient {
  foodId: string;
  grams: number;
  scalable: boolean;
  householdMeasure: string | null;
}

export interface GenRecipe {
  id: string;
  name: string;
  mealTypes: readonly MealType[];
  prepMinutes: number;
  /** Cada requisito pode listar alternativas separadas por "|" (ex.: "fogao|micro-ondas") */
  equipment: readonly string[];
  tags: readonly string[];
  ingredients: readonly GenIngredient[];
}

export interface GeneratorInput {
  weekStart: ISODate;
  slots: readonly { mealType: MealType; time: string | null }[];
  recipes: readonly GenRecipe[];
  foods: ReadonlyMap<string, GenFood>;
  rules: ExclusionRules;
  /** null = utensílios não informados (sem filtro) */
  kitchenEquipment: readonly string[] | null;
  maxPrepMinutes: number | null;
  /** Alimentos (comprados) disponíveis em casa */
  pantryFoodIds: ReadonlySet<string>;
  dailyKcalTarget: number | null;
  weeklyBudgetCents: number | null;
  /** Centavos por grama do alimento comprado (preço proporcional) */
  costPerGramCents: ReadonlyMap<string, number>;
  flexible: { weekday: number; mealType: MealType } | null;
  seed: number;
}

export interface GeneratedItem {
  foodId: string;
  grams: number;
  householdMeasure: string | null;
}

export interface GeneratedMeal {
  date: ISODate;
  mealType: MealType;
  time: string | null;
  recipeId: string | null;
  title: string;
  isFlexible: boolean;
  portionFactor: number;
  items: GeneratedItem[];
}

export interface GeneratorOutput {
  meals: GeneratedMeal[];
  notes: string[];
  estimatedCostCents: number;
  /** Fração (0–1) da quantidade total de ingredientes com preço conhecido */
  costCoverage: number;
  averageDailyKcal: number | null;
}

export const PORTION_MIN = 0.75;
export const PORTION_MAX = 1.5;
const MAX_USES_PER_WEEK = 3;

/** PRNG determinístico (mulberry32). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash FNV-1a de 32 bits para gerar sementes a partir de texto. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function equipmentSatisfied(required: readonly string[], available: readonly string[] | null): boolean {
  if (available === null) return true;
  const set = new Set(available);
  return required.every((req) => req.split("|").some((option) => set.has(option)));
}

export function recipeFoods(recipe: GenRecipe, foods: ReadonlyMap<string, GenFood>): GenFood[] | null {
  const list: GenFood[] = [];
  for (const ing of recipe.ingredients) {
    const food = foods.get(ing.foodId);
    if (!food) return null;
    list.push(food);
  }
  return list;
}

export function scaleIngredients(recipe: GenRecipe, factor: number): GeneratedItem[] {
  return recipe.ingredients.map((ing) => ({
    foodId: ing.foodId,
    grams: ing.scalable && factor !== 1 ? roundTo5(ing.grams * factor) : ing.grams,
    householdMeasure: factor === 1 ? ing.householdMeasure : null,
  }));
}

function itemsEnergy(items: readonly GeneratedItem[], foods: ReadonlyMap<string, GenFood>) {
  const totals = mealTotals(
    items.map((i) => {
      const f = foods.get(i.foodId)!;
      return { facts: f, grams: i.grams };
    }),
  );
  return { kcal: totals.values.kcal, complete: !totals.incomplete.includes("kcal") };
}

export function itemsCost(
  items: readonly GeneratedItem[],
  foods: ReadonlyMap<string, GenFood>,
  costPerGram: ReadonlyMap<string, number>,
): { cents: number; pricedGrams: number; totalGrams: number } {
  let cents = 0;
  let pricedGrams = 0;
  let totalGrams = 0;
  for (const item of items) {
    const food = foods.get(item.foodId);
    if (!food) continue;
    const purchaseId = food.purchaseFoodId ?? food.id;
    const factor = food.purchaseFoodId && food.purchaseFactor ? food.purchaseFactor : 1;
    const grams = item.grams * factor;
    totalGrams += grams;
    const perGram = costPerGram.get(purchaseId);
    if (perGram !== undefined) {
      cents += perGram * grams;
      pricedGrams += grams;
    }
  }
  return { cents, pricedGrams, totalGrams };
}

function portionFactorFor(
  recipe: GenRecipe,
  foods: ReadonlyMap<string, GenFood>,
  targetKcal: number | null,
): number {
  if (targetKcal === null) return 1;
  const base = itemsEnergy(scaleIngredients(recipe, 1), foods);
  if (!base.complete || base.kcal <= 0) return 1;
  const raw = targetKcal / base.kcal;
  const clamped = Math.min(PORTION_MAX, Math.max(PORTION_MIN, raw));
  return Math.round(clamped * 20) / 20;
}

interface Candidate {
  recipe: GenRecipe;
  purchaseIds: string[];
  favorite: boolean;
  pantryShare: number;
}

export function generateWeek(input: GeneratorInput): GeneratorOutput {
  const rng = createRng(input.seed);
  const notes: string[] = [];
  const noteOnce = (msg: string) => {
    if (!notes.includes(msg)) notes.push(msg);
  };

  // 1) Filtra receitas seguras (restrições + dados completos de ingredientes + utensílios).
  const safe: Candidate[] = [];
  let excludedByEquipment = 0;
  for (const recipe of input.recipes) {
    const foods = recipeFoods(recipe, input.foods);
    if (!foods) continue;
    if (recipeConflicts(foods, input.rules).length > 0) continue;
    if (!equipmentSatisfied(recipe.equipment, input.kitchenEquipment)) {
      excludedByEquipment += 1;
      continue;
    }
    const purchaseIds = [...new Set(foods.map((f) => f.purchaseFoodId ?? f.id))];
    safe.push({
      recipe,
      purchaseIds,
      favorite: foods.some((f) => isFavorite(f, input.rules)),
      pantryShare: purchaseIds.filter((id) => input.pantryFoodIds.has(id)).length / Math.max(1, purchaseIds.length),
    });
  }
  if (excludedByEquipment > 0 && input.kitchenEquipment !== null) {
    noteOnce("Algumas receitas foram deixadas de fora por exigirem utensílios que você não marcou.");
  }

  const totalShare = input.slots.reduce((acc, s) => acc + SLOT_ENERGY_SHARE[s.mealType], 0) || 1;
  const targetFor = (mealType: MealType) =>
    input.dailyKcalTarget === null ? null : (input.dailyKcalTarget * SLOT_ENERGY_SHARE[mealType]) / totalShare;

  const uses = new Map<string, number>();
  const selectedPurchase = new Set<string>();
  const meals: GeneratedMeal[] = [];

  for (let day = 0; day < 7; day++) {
    const date = addDays(input.weekStart, day);
    const usedToday = new Set<string>();
    for (const slot of input.slots) {
      if (input.flexible && input.flexible.weekday === day && input.flexible.mealType === slot.mealType) {
        meals.push({
          date,
          mealType: slot.mealType,
          time: slot.time,
          recipeId: null,
          title: "Refeição flexível",
          isFlexible: true,
          portionFactor: 1,
          items: [],
        });
        continue;
      }

      let pool = safe.filter((c) => c.recipe.mealTypes.includes(slot.mealType) && !usedToday.has(c.recipe.id));
      if (pool.length === 0) {
        noteOnce(
          `Não encontramos receitas compatíveis para ${MEAL_TYPE_LABEL[slot.mealType].toLowerCase()} com suas restrições e utensílios. Adicione uma refeição manualmente nesse horário.`,
        );
        continue;
      }
      if (input.maxPrepMinutes !== null) {
        const quick = pool.filter((c) => c.recipe.prepMinutes <= input.maxPrepMinutes!);
        if (quick.length > 0) pool = quick;
        else noteOnce("Algumas receitas passam do tempo de preparo desejado por falta de alternativas compatíveis.");
      }
      const underCap = pool.filter((c) => (uses.get(c.recipe.id) ?? 0) < MAX_USES_PER_WEEK);
      if (underCap.length > 0) pool = underCap;

      let best: Candidate | null = null;
      let bestScore = -Infinity;
      for (const c of pool) {
        const used = uses.get(c.recipe.id) ?? 0;
        const overlap =
          c.purchaseIds.filter((id) => selectedPurchase.has(id)).length / Math.max(1, c.purchaseIds.length);
        let score = rng() * 1.2;
        if (c.favorite) score += 0.6;
        score += 0.5 * c.pantryShare;
        score += 0.3 * overlap;
        score -= 0.7 * used;
        if (input.weeklyBudgetCents !== null) {
          const cost = itemsCost(scaleIngredients(c.recipe, 1), input.foods, input.costPerGramCents);
          // Penaliza custo por porção (em reais) apenas quando há orçamento.
          score -= Math.min(1, cost.cents / 2000) * 0.5;
        }
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (!best) continue;
      const factor = portionFactorFor(best.recipe, input.foods, targetFor(slot.mealType));
      meals.push({
        date,
        mealType: slot.mealType,
        time: slot.time,
        recipeId: best.recipe.id,
        title: best.recipe.name,
        isFlexible: false,
        portionFactor: factor,
        items: scaleIngredients(best.recipe, factor),
      });
      uses.set(best.recipe.id, (uses.get(best.recipe.id) ?? 0) + 1);
      usedToday.add(best.recipe.id);
      for (const id of best.purchaseIds) selectedPurchase.add(id);
    }
  }

  // 2) Ajuste ao orçamento: troca as refeições mais caras por alternativas mais baratas.
  const costOf = (m: GeneratedMeal) => itemsCost(m.items, input.foods, input.costPerGramCents);
  let total = meals.reduce((acc, m) => acc + costOf(m).cents, 0);
  if (input.weeklyBudgetCents !== null && total > input.weeklyBudgetCents) {
    for (let iter = 0; iter < 40 && total > input.weeklyBudgetCents; iter++) {
      const ranked = meals
        .map((m, index) => ({ m, index, cost: costOf(m).cents }))
        .filter((x) => !x.m.isFlexible && x.m.recipeId !== null)
        .sort((a, b) => b.cost - a.cost);
      let swapped = false;
      for (const { m, index, cost } of ranked) {
        const sameDay = new Set(meals.filter((o) => o.date === m.date).map((o) => o.recipeId));
        const alternatives = safe
          .filter((c) => c.recipe.mealTypes.includes(m.mealType) && !sameDay.has(c.recipe.id))
          .map((c) => {
            const factor = portionFactorFor(c.recipe, input.foods, targetFor(m.mealType));
            const items = scaleIngredients(c.recipe, factor);
            const cst = itemsCost(items, input.foods, input.costPerGramCents);
            return { c, factor, items, cost: cst.cents, coverage: cst.pricedGrams / Math.max(1, cst.totalGrams) };
          })
          // Só troca por receitas com preços conhecidos, para não "baratear" com dados ausentes.
          .filter((a) => a.coverage >= 0.8 && a.cost < cost - 1)
          .sort((a, b) => a.cost - b.cost);
        const alt = alternatives[0];
        if (!alt) continue;
        meals[index] = {
          ...m,
          recipeId: alt.c.recipe.id,
          title: alt.c.recipe.name,
          portionFactor: alt.factor,
          items: alt.items,
        };
        total = total - cost + alt.cost;
        swapped = true;
        break;
      }
      if (!swapped) break;
    }
    if (total > input.weeklyBudgetCents) {
      noteOnce(
        `O custo estimado do plano (${formatBRL(Math.round(total))}) ficou acima do orçamento semanal (${formatBRL(input.weeklyBudgetCents)}). Veja as sugestões de economia na lista de compras.`,
      );
    } else {
      noteOnce("Algumas refeições foram trocadas por opções mais econômicas para caber no orçamento.");
    }
  }

  // 3) Métricas e avisos finais.
  let priced = 0;
  let grams = 0;
  for (const m of meals) {
    const c = costOf(m);
    priced += c.pricedGrams;
    grams += c.totalGrams;
  }
  const coverage = grams > 0 ? priced / grams : 0;
  if (grams > 0 && coverage < 0.999) {
    noteOnce(
      coverage === 0
        ? "Ainda não há preços cadastrados: o custo do plano aparecerá quando você informar preços na lista de compras."
        : `O custo estimado considera apenas ingredientes com preço cadastrado (${formatInt(Math.round(coverage * 100))}% da quantidade).`,
    );
  }

  let averageDailyKcal: number | null = null;
  const days = new Map<string, { kcal: number; complete: boolean }>();
  for (const m of meals) {
    const d = days.get(m.date) ?? { kcal: 0, complete: true };
    if (m.isFlexible) d.complete = false;
    else {
      const e = itemsEnergy(m.items, input.foods);
      d.kcal += e.kcal;
      d.complete &&= e.complete;
    }
    days.set(m.date, d);
  }
  const completeDays = [...days.values()].filter((d) => d.complete);
  if (completeDays.length > 0) {
    averageDailyKcal = Math.round(completeDays.reduce((a, d) => a + d.kcal, 0) / completeDays.length);
  }
  if (input.dailyKcalTarget !== null && averageDailyKcal !== null) {
    const deviation = Math.abs(averageDailyKcal - input.dailyKcalTarget) / input.dailyKcalTarget;
    if (deviation > 0.12) {
      noteOnce(
        `Com as receitas compatíveis, a média estimada ficou em ${formatInt(averageDailyKcal)} kcal/dia, diferente da meta de ${formatInt(input.dailyKcalTarget)} kcal. Ajuste as porções ou converse com seu profissional.`,
      );
    }
  }
  if (input.dailyKcalTarget === null) {
    noteOnce("Sem meta calórica registrada: usamos as porções de referência das receitas.");
  }

  return { meals, notes, estimatedCostCents: Math.round(total), costCoverage: coverage, averageDailyKcal };
}
