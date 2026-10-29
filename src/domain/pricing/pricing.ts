/**
 * Cálculo de custos e embalagens.
 *
 * Diferencia explicitamente:
 *  1. custo da quantidade efetivamente consumida (proporcional);
 *  2. valor para comprar embalagens completas;
 *  3. total do carrinho;
 *  4. estoque em casa (descontado antes de calcular a compra).
 *
 * Todos os valores monetários são inteiros em centavos.
 */

export type MeasureUnit = "G" | "ML" | "UNIT";
export type PriceStatus = "confirmed" | "user" | "paid" | "imported" | "demo" | "missing";

export interface PackageSpec {
  packageSize: number;
  packageUnit: MeasureUnit;
  soldByWeight: boolean;
  densityGPerMl?: number | null;
  unitWeightG?: number | null;
}

/** Arredondamento de compras a granel (balança): múltiplos de 50 g. */
export const BULK_STEP_G = 50;
const EPS = 1e-6;

/** Gramas contidas em uma embalagem. Null quando não há como converter. */
export function packageGrams(spec: PackageSpec): number | null {
  if (!(spec.packageSize > 0)) return null;
  switch (spec.packageUnit) {
    case "G":
      return spec.packageSize;
    case "ML":
      return spec.densityGPerMl && spec.densityGPerMl > 0 ? spec.packageSize * spec.densityGPerMl : null;
    case "UNIT":
      return spec.unitWeightG && spec.unitWeightG > 0 ? spec.packageSize * spec.unitWeightG : null;
  }
}

/** Número de embalagens inteiras necessárias para cobrir a quantidade. */
export function packagesToBuy(neededG: number, packageG: number): number {
  if (!(packageG > 0)) throw new RangeError("Embalagem inválida.");
  if (!(neededG > EPS)) return 0;
  return Math.ceil(neededG / packageG - EPS);
}

/** Quantidade a comprar a granel, arredondada para cima em passos de 50 g. */
export function bulkPurchaseGrams(neededG: number): number {
  if (!(neededG > EPS)) return 0;
  return Math.ceil(neededG / BULK_STEP_G - EPS) * BULK_STEP_G;
}

/** Custo proporcional da quantidade consumida. Preço refere-se a uma embalagem (ou 1 kg a granel). */
export function consumedCostCents(neededG: number, spec: PackageSpec, priceCents: number): number | null {
  if (neededG <= 0) return 0;
  if (spec.soldByWeight) return Math.round((neededG / 1000) * priceCents);
  const g = packageGrams(spec);
  if (g === null) return null;
  return Math.round((neededG / g) * priceCents);
}

export interface LineInput {
  requiredG: number;
  pantryG: number;
  spec: PackageSpec | null;
  priceCents: number | null;
  manualPackages?: number | null;
}

export interface LineResult {
  /** Gramas que faltam comprar (necessário − em casa) */
  toBuyG: number;
  /** Embalagens a comprar (null quando vendido a granel ou sem embalagem) */
  packages: number | null;
  /** Gramas efetivamente compradas (embalagens completas ou granel arredondado) */
  purchasedG: number | null;
  /** Custo proporcional do que será consumido pelo plano */
  consumedCents: number | null;
  /** Valor a pagar no caixa */
  purchaseCents: number | null;
  /** Sobra estimada após o consumo planejado */
  leftoverG: number | null;
}

export function computeLine(input: LineInput): LineResult {
  const toBuyG = Math.max(0, input.requiredG - Math.max(0, input.pantryG));
  const { spec, priceCents } = input;
  if (!spec) {
    return { toBuyG, packages: null, purchasedG: null, consumedCents: null, purchaseCents: null, leftoverG: null };
  }
  const consumedCents = priceCents === null ? null : consumedCostCents(input.requiredG, spec, priceCents);

  if (spec.soldByWeight) {
    const purchasedG = bulkPurchaseGrams(toBuyG);
    return {
      toBuyG,
      packages: null,
      purchasedG,
      consumedCents,
      purchaseCents: priceCents === null ? null : Math.round((purchasedG / 1000) * priceCents),
      leftoverG: purchasedG - toBuyG,
    };
  }

  const g = packageGrams(spec);
  if (g === null) {
    return { toBuyG, packages: null, purchasedG: null, consumedCents, purchaseCents: null, leftoverG: null };
  }
  const auto = packagesToBuy(toBuyG, g);
  const packages = input.manualPackages !== null && input.manualPackages !== undefined ? input.manualPackages : auto;
  const purchasedG = packages * g;
  return {
    toBuyG,
    packages,
    purchasedG,
    consumedCents,
    purchaseCents: priceCents === null ? null : packages * priceCents,
    leftoverG: Math.max(0, purchasedG - toBuyG),
  };
}

/** Preço por kg (ou por litro convertido em kg) para comparação entre produtos. */
export function pricePerKgCents(spec: PackageSpec, priceCents: number): number | null {
  if (spec.soldByWeight) return priceCents;
  const g = packageGrams(spec);
  if (g === null || g <= 0) return null;
  return Math.round((priceCents / g) * 1000);
}

// ─────────────────────────────────────────────────────────────
// Consolidação de ingredientes
// ─────────────────────────────────────────────────────────────

export interface ConsumptionEntry {
  foodId: string;
  grams: number;
  /** Alimento comprado (cru) — se nulo, o próprio alimento é comprado assim */
  purchaseFoodId: string | null;
  /** Gramas compradas por grama consumida (ex.: arroz cozido → cru ≈ 0,36) */
  purchaseFactor: number | null;
}

export interface ConsolidatedItem {
  purchaseFoodId: string;
  grams: number;
  /** Algum item usou fator de conversão cozido→cru (estimado) */
  converted: boolean;
  sourceFoodIds: string[];
  occurrences: number;
}

export function consolidate(entries: readonly ConsumptionEntry[]): ConsolidatedItem[] {
  const map = new Map<string, ConsolidatedItem>();
  for (const e of entries) {
    if (!(e.grams > 0)) continue;
    const target = e.purchaseFoodId ?? e.foodId;
    const factor = e.purchaseFoodId && e.purchaseFactor && e.purchaseFactor > 0 ? e.purchaseFactor : 1;
    const current =
      map.get(target) ?? { purchaseFoodId: target, grams: 0, converted: false, sourceFoodIds: [], occurrences: 0 };
    current.grams += e.grams * factor;
    current.converted ||= factor !== 1;
    current.occurrences += 1;
    if (!current.sourceFoodIds.includes(e.foodId)) current.sourceFoodIds.push(e.foodId);
    map.set(target, current);
  }
  return [...map.values()]
    .map((i) => ({ ...i, grams: Math.round(i.grams) }))
    .sort((a, b) => b.grams - a.grams);
}

// ─────────────────────────────────────────────────────────────
// Orçamento
// ─────────────────────────────────────────────────────────────

export type BudgetPeriod = "DAY" | "WEEK" | "MONTH";

/** Média de dias por mês (365,25 / 12). */
export const DAYS_PER_MONTH = 30.4375;

export function weeklyBudgetCents(amountCents: number, period: BudgetPeriod): { cents: number; derived: boolean } {
  switch (period) {
    case "DAY":
      return { cents: amountCents * 7, derived: true };
    case "WEEK":
      return { cents: amountCents, derived: false };
    case "MONTH":
      return { cents: Math.round((amountCents * 7) / DAYS_PER_MONTH), derived: true };
  }
}

export interface BudgetSummary {
  budgetCents: number | null;
  estimatedCents: number;
  paidCents: number;
  /** Itens sem preço: total estimado é parcial */
  missingPrices: number;
  remainingCents: number | null;
  overBudget: boolean;
  usage: number | null;
}

export function summarizeBudget(input: {
  budgetCents: number | null;
  lines: { purchaseCents: number | null; paidCents: number | null; purchased: boolean }[];
}): BudgetSummary {
  let estimated = 0;
  let paid = 0;
  let missing = 0;
  for (const l of input.lines) {
    if (l.purchaseCents === null) missing += 1;
    else estimated += l.purchaseCents;
    if (l.purchased && l.paidCents !== null) paid += l.paidCents;
  }
  const budget = input.budgetCents;
  // O saldo considera o valor pago (quando informado) e, para o restante, a estimativa.
  const committed = input.lines.reduce(
    (acc, l) => acc + (l.purchased && l.paidCents !== null ? l.paidCents : (l.purchaseCents ?? 0)),
    0,
  );
  return {
    budgetCents: budget,
    estimatedCents: estimated,
    paidCents: paid,
    missingPrices: missing,
    remainingCents: budget === null ? null : budget - committed,
    overBudget: budget !== null && committed > budget,
    usage: budget && budget > 0 ? committed / budget : null,
  };
}
