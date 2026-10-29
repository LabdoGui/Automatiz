import { describe, expect, it } from "vitest";
import {
  dailyGoalFrom,
  macroEnergySplit,
  mealTotals,
  nutrientsForPortion,
  roundTotals,
  sumTotals,
  type NutritionFacts,
} from "@/domain/nutrition/calc";
import { estimateEnergy } from "@/domain/nutrition/estimate";

// Valores TACO 4ª ed. (por 100 g)
const arrozCozido: NutritionFacts = { kcal: 128, proteinG: 2.5, carbsG: 28.1, fatG: 0.2, fiberG: 1.6 };
const frangoGrelhado: NutritionFacts = { kcal: 159, proteinG: 32, carbsG: 0, fatG: 2.5, fiberG: 0 };
const leiteSemDados: NutritionFacts = { kcal: null, proteinG: null, carbsG: null, fatG: null, fiberG: null };

describe("nutrientsForPortion", () => {
  it("calcula proporcionalmente a partir de valores por 100 g", () => {
    const t = nutrientsForPortion(arrozCozido, 150);
    expect(t.values.kcal).toBeCloseTo(192, 5);
    expect(t.values.proteinG).toBeCloseTo(3.75, 5);
    expect(t.values.carbsG).toBeCloseTo(42.15, 5);
    expect(t.incomplete).toEqual([]);
  });

  it("retorna zero para porção zero sem marcar incompleto", () => {
    const t = nutrientsForPortion(leiteSemDados, 0);
    expect(t.values.kcal).toBe(0);
    expect(t.incomplete).toEqual([]);
  });

  it("marca nutrientes ausentes na fonte como incompletos, sem estimar", () => {
    const t = nutrientsForPortion(leiteSemDados, 200);
    expect(t.values.kcal).toBe(0);
    expect(t.incomplete).toEqual(["kcal", "proteinG", "carbsG", "fatG", "fiberG"]);
  });

  it("rejeita quantidades inválidas", () => {
    expect(() => nutrientsForPortion(arrozCozido, -1)).toThrow(RangeError);
    expect(() => nutrientsForPortion(arrozCozido, Number.NaN)).toThrow(RangeError);
    expect(() => nutrientsForPortion(arrozCozido, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("somas diárias e semanais", () => {
  it("soma itens de uma refeição", () => {
    const t = roundTotals(
      mealTotals([
        { facts: frangoGrelhado, grams: 150 },
        { facts: arrozCozido, grams: 150 },
      ]),
    );
    expect(t.values.kcal).toBe(Math.round(238.5 + 192));
    expect(t.values.proteinG).toBeCloseTo(51.8, 1);
  });

  it("propaga incompletude ao somar dias", () => {
    const day1 = mealTotals([{ facts: arrozCozido, grams: 100 }]);
    const day2 = mealTotals([{ facts: leiteSemDados, grams: 200 }]);
    const week = sumTotals([day1, day2]);
    expect(week.values.kcal).toBe(128);
    expect(week.incomplete).toContain("kcal");
  });

  it("soma semanal é a soma das somas diárias", () => {
    const days = Array.from({ length: 7 }, (_, i) => mealTotals([{ facts: arrozCozido, grams: 100 + i * 10 }]));
    const week = sumTotals(days);
    const expected = days.reduce((a, d) => a + d.values.kcal, 0);
    expect(week.values.kcal).toBeCloseTo(expected, 8);
  });

  it("divide energia entre macronutrientes", () => {
    const split = macroEnergySplit(mealTotals([{ facts: frangoGrelhado, grams: 100 }]))!;
    expect(split.protein + split.carbs + split.fat).toBeCloseTo(1, 8);
    expect(split.protein).toBeGreaterThan(0.8);
  });
});

describe("dailyGoalFrom", () => {
  it("mantém metas diárias", () => {
    expect(dailyGoalFrom({ period: "DAY", kcal: 2000, proteinG: 120, carbsG: null, fatG: null })).toEqual({
      kcal: 2000,
      proteinG: 120,
      carbsG: null,
      fatG: null,
      derivedFromWeekly: false,
    });
  });

  it("converte meta semanal em média diária (÷7), sem confundir períodos", () => {
    const g = dailyGoalFrom({ period: "WEEK", kcal: 14000, proteinG: 840, carbsG: null, fatG: 420 });
    expect(g.kcal).toBe(2000);
    expect(g.proteinG).toBe(120);
    expect(g.fatG).toBe(60);
    expect(g.derivedFromWeekly).toBe(true);
  });
});

describe("estimateEnergy (educativo)", () => {
  it("não calcula sem dados suficientes", () => {
    const r = estimateEnergy({ age: 30, heightCm: 170, weightKg: null, sex: "FEMALE", activity: "LIGHT" });
    expect(r.available).toBe(false);
  });

  it("não calcula para menores de 18 anos", () => {
    const r = estimateEnergy({ age: 16, heightCm: 170, weightKg: 60, sex: "MALE", activity: "LIGHT" });
    expect(r.available).toBe(false);
  });

  it("aplica Mifflin-St Jeor e devolve faixa", () => {
    const r = estimateEnergy({ age: 30, heightCm: 170, weightKg: 70, sex: "MALE", activity: "SEDENTARY" });
    // 10·70 + 6,25·170 − 5·30 + 5 = 1617,5 → ×1,2 = 1941
    expect(r.available).toBe(true);
    if (r.available) {
      expect(r.bmr).toBe(1620);
      expect(r.maintenance).toBe(1940);
      expect(r.low).toBeLessThan(r.maintenance);
      expect(r.high).toBeGreaterThan(r.maintenance);
    }
  });
});
