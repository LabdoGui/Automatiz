import type { NutrientKey, NutritionFacts } from "./calc";
import { foodConflicts, type ExclusionRules, type RestrictionFood } from "../restrictions/engine";

/**
 * Substituições dentro do mesmo grupo alimentar, com quantidade equivalente
 * calculada pelo nutriente que define o papel do alimento no prato.
 */

export const SUBSTITUTION_GROUPS: Record<string, { label: string; basis: NutrientKey | "grams" }> = {
  proteina: { label: "Proteínas", basis: "proteinG" },
  leguminosa: { label: "Leguminosas", basis: "proteinG" },
  "carboidrato-base": { label: "Carboidratos", basis: "carbsG" },
  pao: { label: "Pães e cereais", basis: "kcal" },
  legumes: { label: "Legumes", basis: "grams" },
  folhas: { label: "Saladas", basis: "grams" },
  fruta: { label: "Frutas", basis: "kcal" },
  laticinio: { label: "Laticínios", basis: "kcal" },
  gordura: { label: "Gorduras", basis: "kcal" },
  oleaginosa: { label: "Oleaginosas", basis: "kcal" },
  "cereal-cafe": { label: "Cereais", basis: "kcal" },
};

export interface SubFood extends RestrictionFood, NutritionFacts {
  id: string;
  shortName: string | null;
  substitutionGroup: string | null;
  purchaseFoodId: string | null;
  purchaseFactor: number | null;
}

export interface Equivalence {
  grams: number;
  basis: NutrientKey | "grams";
  /** Quantidade muito diferente da original (mais que 2,5× ou menos que 0,4×) */
  unusual: boolean;
}

export function roundTo5(g: number): number {
  return Math.max(5, Math.round(g / 5) * 5);
}

export function equivalentGrams(from: SubFood, grams: number, to: SubFood): Equivalence | null {
  const group = from.substitutionGroup ? SUBSTITUTION_GROUPS[from.substitutionGroup] : undefined;
  if (!group) return null;
  if (group.basis === "grams") return { grams: roundTo5(grams), basis: "grams", unusual: false };
  const fromValue = from[group.basis];
  const toValue = to[group.basis];
  if (fromValue === null || toValue === null || !(fromValue > 0) || !(toValue > 0)) return null;
  const target = (fromValue * grams) / 100;
  const g = roundTo5((target / toValue) * 100);
  const ratio = g / grams;
  return { grams: g, basis: group.basis, unusual: ratio > 2.5 || ratio < 0.4 };
}

export interface SubstitutionOption {
  food: SubFood;
  grams: number;
  basis: NutrientKey | "grams";
  unusual: boolean;
  /** Custo proporcional estimado em centavos (null se sem preço) */
  costCents: number | null;
}

export function substitutionOptions(params: {
  from: SubFood;
  grams: number;
  candidates: readonly SubFood[];
  rules: ExclusionRules;
  costPerGram?: (food: SubFood) => number | null;
  limit?: number;
}): SubstitutionOption[] {
  const { from, grams, candidates, rules, costPerGram, limit = 8 } = params;
  if (!from.substitutionGroup) return [];
  const out: SubstitutionOption[] = [];
  for (const food of candidates) {
    if (food.id === from.id || food.substitutionGroup !== from.substitutionGroup) continue;
    if (foodConflicts(food, rules).length > 0) continue;
    const eq = equivalentGrams(from, grams, food);
    if (!eq) continue;
    const perGram = costPerGram?.(food) ?? null;
    out.push({
      food,
      grams: eq.grams,
      basis: eq.basis,
      unusual: eq.unusual,
      costCents: perGram === null ? null : Math.round(perGram * eq.grams),
    });
  }
  const cost = (o: SubstitutionOption) => o.costCents ?? Number.MAX_SAFE_INTEGER;
  out.sort((a, b) => Number(a.unusual) - Number(b.unusual) || cost(a) - cost(b));
  return out.slice(0, limit);
}
