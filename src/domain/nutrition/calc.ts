/**
 * Cálculos nutricionais. Os valores de referência dos alimentos são sempre
 * "por 100 g" (ou 100 ml) e vêm de uma fonte identificada (TACO).
 * Campos ausentes na fonte NÃO são estimados: o total é marcado como incompleto.
 */

export const NUTRIENT_KEYS = ["kcal", "proteinG", "carbsG", "fatG", "fiberG"] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export type NutritionFacts = Record<NutrientKey, number | null>;

export interface NutrientTotals {
  values: Record<NutrientKey, number>;
  /** Nutrientes para os quais algum item não tinha dado na fonte */
  incomplete: NutrientKey[];
}

export const NUTRIENT_LABEL: Record<NutrientKey, string> = {
  kcal: "Energia",
  proteinG: "Proteínas",
  carbsG: "Carboidratos",
  fatG: "Gorduras",
  fiberG: "Fibras",
};

export function emptyTotals(): NutrientTotals {
  return { values: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }, incomplete: [] };
}

export function assertValidQuantity(grams: number): void {
  if (!Number.isFinite(grams) || grams < 0) {
    throw new RangeError("Quantidade deve ser um número maior ou igual a zero.");
  }
}

/** Nutrientes de uma porção (em gramas) a partir dos valores por 100 g. */
export function nutrientsForPortion(facts: NutritionFacts, grams: number): NutrientTotals {
  assertValidQuantity(grams);
  const factor = grams / 100;
  const totals = emptyTotals();
  for (const key of NUTRIENT_KEYS) {
    const per100 = facts[key];
    if (per100 === null || per100 === undefined || !Number.isFinite(per100)) {
      if (grams > 0) totals.incomplete.push(key);
      continue;
    }
    totals.values[key] = per100 * factor;
  }
  return totals;
}

export function sumTotals(list: readonly NutrientTotals[]): NutrientTotals {
  const result = emptyTotals();
  const incomplete = new Set<NutrientKey>();
  for (const t of list) {
    for (const key of NUTRIENT_KEYS) result.values[key] += t.values[key];
    for (const key of t.incomplete) incomplete.add(key);
  }
  result.incomplete = NUTRIENT_KEYS.filter((k) => incomplete.has(k));
  return result;
}

export function scaleTotals(t: NutrientTotals, factor: number): NutrientTotals {
  const values = { ...t.values };
  for (const key of NUTRIENT_KEYS) values[key] *= factor;
  return { values, incomplete: [...t.incomplete] };
}

/** Arredondamento para exibição: kcal inteiras, gramas com 1 casa. */
export function roundTotals(t: NutrientTotals): NutrientTotals {
  return {
    values: {
      kcal: Math.round(t.values.kcal),
      proteinG: Math.round(t.values.proteinG * 10) / 10,
      carbsG: Math.round(t.values.carbsG * 10) / 10,
      fatG: Math.round(t.values.fatG * 10) / 10,
      fiberG: Math.round(t.values.fiberG * 10) / 10,
    },
    incomplete: [...t.incomplete],
  };
}

export interface MealItemInput {
  facts: NutritionFacts;
  grams: number;
}

export function mealTotals(items: readonly MealItemInput[]): NutrientTotals {
  return sumTotals(items.map((i) => nutrientsForPortion(i.facts, i.grams)));
}

/** Percentual de energia vindo de cada macronutriente (4/4/9 kcal por grama). */
export function macroEnergySplit(t: NutrientTotals): { protein: number; carbs: number; fat: number } | null {
  const p = t.values.proteinG * 4;
  const c = t.values.carbsG * 4;
  const f = t.values.fatG * 9;
  const total = p + c + f;
  if (total <= 0) return null;
  return { protein: p / total, carbs: c / total, fat: f / total };
}

// ─────────────────────────────────────────────────────────────
// Metas
// ─────────────────────────────────────────────────────────────

export interface GoalInput {
  period: "DAY" | "WEEK";
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface DailyGoal {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  /** true quando o valor diário foi derivado de uma meta semanal (média) */
  derivedFromWeekly: boolean;
}

/**
 * Converte uma meta para o equivalente diário. Metas semanais são divididas
 * por 7 (média diária) — nunca multiplicamos ou somamos períodos diferentes.
 */
export function dailyGoalFrom(goal: GoalInput): DailyGoal {
  const div = goal.period === "WEEK" ? 7 : 1;
  const conv = (v: number | null) => (v === null ? null : Math.round(v / div));
  return {
    kcal: conv(goal.kcal),
    proteinG: conv(goal.proteinG),
    carbsG: conv(goal.carbsG),
    fatG: conv(goal.fatG),
    derivedFromWeekly: goal.period === "WEEK",
  };
}

/** Limite mínimo para metas registradas sem orientação profissional. */
export const SELF_GOAL_MIN_KCAL_PER_DAY = 1200;
export const GOAL_MAX_KCAL_PER_DAY = 6000;

export function goalProgress(consumed: number, target: number | null): number | null {
  if (target === null || target <= 0) return null;
  return consumed / target;
}
