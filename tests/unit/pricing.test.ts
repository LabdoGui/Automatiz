import { describe, expect, it } from "vitest";
import {
  bulkPurchaseGrams,
  computeLine,
  consolidate,
  consumedCostCents,
  packageGrams,
  packagesToBuy,
  pricePerKgCents,
  summarizeBudget,
  weeklyBudgetCents,
  type PackageSpec,
} from "@/domain/pricing/pricing";
import { parseBRLToCents } from "@/domain/format";

const ovos: PackageSpec = { packageSize: 12, packageUnit: "UNIT", soldByWeight: false, unitWeightG: 50 };
const arroz5kg: PackageSpec = { packageSize: 5000, packageUnit: "G", soldByWeight: false };
const azeite: PackageSpec = { packageSize: 500, packageUnit: "ML", soldByWeight: false, densityGPerMl: 0.91 };
const frangoGranel: PackageSpec = { packageSize: 1000, packageUnit: "G", soldByWeight: true };

describe("conversão entre quantidades e embalagens", () => {
  it("converte embalagens em gramas", () => {
    expect(packageGrams(ovos)).toBe(600);
    expect(packageGrams(arroz5kg)).toBe(5000);
    expect(packageGrams(azeite)).toBeCloseTo(455, 5);
  });

  it("não inventa conversões sem densidade ou peso por unidade", () => {
    expect(packageGrams({ packageSize: 500, packageUnit: "ML", soldByWeight: false })).toBeNull();
    expect(packageGrams({ packageSize: 12, packageUnit: "UNIT", soldByWeight: false })).toBeNull();
  });

  it("arredonda embalagens para cima", () => {
    expect(packagesToBuy(200, 600)).toBe(1);
    expect(packagesToBuy(600, 600)).toBe(1);
    expect(packagesToBuy(601, 600)).toBe(2);
    expect(packagesToBuy(0, 600)).toBe(0);
  });

  it("tolera ruído de ponto flutuante", () => {
    expect(packagesToBuy(0.1 * 3 * 2000, 600)).toBe(1);
  });

  it("arredonda compras a granel em passos de 50 g", () => {
    expect(bulkPurchaseGrams(430)).toBe(450);
    expect(bulkPurchaseGrams(450)).toBe(450);
    expect(bulkPurchaseGrams(0)).toBe(0);
  });
});

describe("custo consumido × custo de compra", () => {
  it("receita com 4 ovos de uma bandeja de 12 por R$ 14,00", () => {
    const line = computeLine({ requiredG: 200, pantryG: 0, spec: ovos, priceCents: 1400 });
    expect(line.consumedCents).toBe(467); // 4/12 × 1400 = 466,67
    expect(line.packages).toBe(1);
    expect(line.purchaseCents).toBe(1400);
    expect(line.leftoverG).toBe(400);
  });

  it("desconta o estoque de casa antes de calcular a compra", () => {
    const line = computeLine({ requiredG: 200, pantryG: 300, spec: ovos, priceCents: 1400 });
    expect(line.toBuyG).toBe(0);
    expect(line.packages).toBe(0);
    expect(line.purchaseCents).toBe(0);
    // custo consumido continua refletindo o que o plano usa
    expect(line.consumedCents).toBe(467);
  });

  it("produto a granel: preço por kg", () => {
    const line = computeLine({ requiredG: 430, pantryG: 0, spec: frangoGranel, priceCents: 2290 });
    expect(line.purchasedG).toBe(450);
    expect(line.purchaseCents).toBe(Math.round(0.45 * 2290));
    expect(line.consumedCents).toBe(Math.round(0.43 * 2290));
  });

  it("respeita quantidade de embalagens definida manualmente", () => {
    const line = computeLine({ requiredG: 200, pantryG: 0, spec: ovos, priceCents: 1400, manualPackages: 2 });
    expect(line.packages).toBe(2);
    expect(line.purchaseCents).toBe(2800);
  });

  it("sem preço: custos ficam indisponíveis, mas embalagens são calculadas", () => {
    const line = computeLine({ requiredG: 1200, pantryG: 0, spec: arroz5kg, priceCents: null });
    expect(line.packages).toBe(1);
    expect(line.purchaseCents).toBeNull();
    expect(line.consumedCents).toBeNull();
  });

  it("custo consumido proporcional", () => {
    expect(consumedCostCents(1000, arroz5kg, 2500)).toBe(500);
  });

  it("preço por kg para comparação", () => {
    expect(pricePerKgCents(arroz5kg, 2500)).toBe(500);
    expect(pricePerKgCents(frangoGranel, 2290)).toBe(2290);
    expect(pricePerKgCents({ packageSize: 1, packageUnit: "UNIT", soldByWeight: false }, 300)).toBeNull();
  });
});

describe("consolidação de ingredientes", () => {
  it("soma o mesmo alimento vindo de receitas diferentes", () => {
    const items = consolidate([
      { foodId: "ovo", grams: 100, purchaseFoodId: null, purchaseFactor: null },
      { foodId: "ovo", grams: 150, purchaseFoodId: null, purchaseFactor: null },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ purchaseFoodId: "ovo", grams: 250, occurrences: 2, converted: false });
  });

  it("converte preparado → comprado (arroz cozido → cru) e agrupa", () => {
    const items = consolidate([
      { foodId: "arroz-cozido", grams: 150, purchaseFoodId: "arroz-cru", purchaseFactor: 0.356 },
      { foodId: "arroz-cozido", grams: 150, purchaseFoodId: "arroz-cru", purchaseFactor: 0.356 },
      { foodId: "arroz-cru", grams: 50, purchaseFoodId: null, purchaseFactor: null },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].purchaseFoodId).toBe("arroz-cru");
    expect(items[0].grams).toBe(Math.round(300 * 0.356 + 50));
    expect(items[0].converted).toBe(true);
    expect(items[0].sourceFoodIds.sort()).toEqual(["arroz-cozido", "arroz-cru"]);
  });

  it("ignora quantidades nulas ou negativas", () => {
    expect(consolidate([{ foodId: "x", grams: 0, purchaseFoodId: null, purchaseFactor: null }])).toEqual([]);
  });
});

describe("orçamento", () => {
  it("converte períodos para equivalente semanal", () => {
    expect(weeklyBudgetCents(5000, "DAY")).toEqual({ cents: 35000, derived: true });
    expect(weeklyBudgetCents(20000, "WEEK")).toEqual({ cents: 20000, derived: false });
    expect(weeklyBudgetCents(80000, "MONTH").cents).toBe(Math.round((80000 * 7) / 30.4375));
  });

  it("calcula saldo usando valor pago quando informado", () => {
    const s = summarizeBudget({
      budgetCents: 10000,
      lines: [
        { purchaseCents: 3000, paidCents: 3500, purchased: true },
        { purchaseCents: 4000, paidCents: null, purchased: false },
        { purchaseCents: null, paidCents: null, purchased: false },
      ],
    });
    expect(s.estimatedCents).toBe(7000);
    expect(s.paidCents).toBe(3500);
    expect(s.missingPrices).toBe(1);
    expect(s.remainingCents).toBe(10000 - 3500 - 4000);
    expect(s.overBudget).toBe(false);
  });

  it("sinaliza orçamento ultrapassado", () => {
    const s = summarizeBudget({ budgetCents: 1000, lines: [{ purchaseCents: 1500, paidCents: null, purchased: false }] });
    expect(s.overBudget).toBe(true);
    expect(s.remainingCents).toBe(-500);
  });
});

describe("parseBRLToCents", () => {
  it.each([
    ["14,00", 1400],
    ["R$ 8,99", 899],
    ["1.234,56", 123456],
    ["12.5", 1250],
    ["7", 700],
  ])("%s → %d", (input, cents) => expect(parseBRLToCents(input)).toBe(cents));

  it.each(["", "abc", "1,234", "-5", "12,345"])("rejeita %s", (input) => expect(parseBRLToCents(input)).toBeNull());
});
