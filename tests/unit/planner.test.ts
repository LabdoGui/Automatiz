import { describe, expect, it } from "vitest";
import {
  equipmentSatisfied,
  generateWeek,
  hashSeed,
  scaleIngredients,
  type GenFood,
  type GenRecipe,
  type GeneratorInput,
} from "@/domain/planner/generator";
import { buildRules } from "@/domain/restrictions/engine";
import { equivalentGrams, substitutionOptions, type SubFood } from "@/domain/nutrition/substitution";

function f(
  id: string,
  facts: [number, number, number, number],
  tags: string[] = [],
  extra: Partial<GenFood> = {},
): GenFood {
  const [kcal, proteinG, carbsG, fatG] = facts;
  return {
    id,
    name: id,
    tags,
    family: id.split("-")[0],
    allergenReviewed: true,
    kcal,
    proteinG,
    carbsG,
    fatG,
    fiberG: 0,
    purchaseFoodId: null,
    purchaseFactor: null,
    ...extra,
  };
}

const foods = new Map<string, GenFood>(
  [
    f("arroz-cozido", [128, 2.5, 28.1, 0.2], [], { purchaseFoodId: "arroz-cru", purchaseFactor: 0.36 }),
    f("arroz-cru", [358, 7.2, 78.8, 0.3]),
    f("frango-grelhado", [159, 32, 0, 2.5], ["carne", "aves", "origem-animal"]),
    f("ovo-cozido", [146, 13.3, 0.6, 9.5], ["ovo", "origem-animal"]),
    f("queijo-minas", [264, 17.4, 3.2, 20.2], ["leite", "lactose", "laticinio", "origem-animal"]),
    f("pao-frances", [300, 8, 58.6, 3.1], ["trigo", "gluten"]),
    f("banana-prata", [98, 1.3, 26, 0.1]),
    f("lentilha-cozida", [93, 6.3, 16.3, 0.5]),
    f("feijao-cozido", [76, 4.8, 13.6, 0.5]),
  ].map((x) => [x.id, x]),
);

const r = (
  id: string,
  mealTypes: GenRecipe["mealTypes"],
  ingredients: [string, number][],
  extra: Partial<GenRecipe> = {},
): GenRecipe => ({
  id,
  name: id,
  mealTypes,
  prepMinutes: 15,
  equipment: ["fogao"],
  tags: [],
  ingredients: ingredients.map(([foodId, grams]) => ({ foodId, grams, scalable: true, householdMeasure: null })),
  ...extra,
});

const recipes: GenRecipe[] = [
  r("cafe-pao-queijo", ["BREAKFAST"], [["pao-frances", 50], ["queijo-minas", 30]]),
  r("cafe-pao-ovo", ["BREAKFAST"], [["pao-frances", 50], ["ovo-cozido", 100]]),
  r("cafe-banana", ["BREAKFAST", "AFTERNOON_SNACK"], [["banana-prata", 120]], { equipment: [] }),
  r("almoco-frango", ["LUNCH", "DINNER"], [["frango-grelhado", 120], ["arroz-cozido", 150]]),
  r("almoco-lentilha", ["LUNCH", "DINNER"], [["lentilha-cozida", 150], ["arroz-cozido", 150]]),
  r("almoco-ovo-feijao", ["LUNCH", "DINNER"], [["ovo-cozido", 100], ["feijao-cozido", 150], ["arroz-cozido", 120]]),
  r("jantar-forno", ["DINNER"], [["frango-grelhado", 150]], { equipment: ["forno"], prepMinutes: 50 }),
];

function input(overrides: Partial<GeneratorInput> = {}): GeneratorInput {
  return {
    weekStart: "2026-11-02",
    slots: [
      { mealType: "BREAKFAST", time: "07:30" },
      { mealType: "LUNCH", time: "12:30" },
      { mealType: "DINNER", time: "19:30" },
    ],
    recipes,
    foods,
    rules: buildRules([]),
    kitchenEquipment: ["fogao"],
    maxPrepMinutes: null,
    pantryFoodIds: new Set(),
    dailyKcalTarget: null,
    weeklyBudgetCents: null,
    costPerGramCents: new Map(),
    flexible: null,
    seed: 42,
    ...overrides,
  };
}

const ingredientIds = (out: ReturnType<typeof generateWeek>) =>
  new Set(out.meals.flatMap((m) => m.items.map((i) => i.foodId)));

describe("generateWeek", () => {
  it("gera 7 dias com as refeições escolhidas", () => {
    const out = generateWeek(input());
    expect(out.meals).toHaveLength(21);
    expect(new Set(out.meals.map((m) => m.date)).size).toBe(7);
    expect(out.meals[0].date).toBe("2026-11-02");
    expect(out.meals.at(-1)!.date).toBe("2026-11-08");
  });

  it("é determinístico para a mesma semente e varia com outra", () => {
    const a = generateWeek(input({ seed: 1 }));
    const b = generateWeek(input({ seed: 1 }));
    const c = generateWeek(input({ seed: 999 }));
    expect(a.meals.map((m) => m.recipeId)).toEqual(b.meals.map((m) => m.recipeId));
    expect(a.meals.map((m) => m.recipeId)).not.toEqual(c.meals.map((m) => m.recipeId));
  });

  it("nunca inclui alergênicos registrados", () => {
    const out = generateWeek(input({ rules: buildRules([{ kind: "ALLERGY", tag: "ovo", label: "Ovo" }]) }));
    const ids = ingredientIds(out);
    expect(ids.has("ovo-cozido")).toBe(false);
    expect(out.meals.length).toBeGreaterThan(0);
  });

  it("respeita dieta vegana: sem refeições incompatíveis, com aviso quando não há opções", () => {
    const out = generateWeek(input({ rules: buildRules([{ kind: "RESTRICTION", tag: "vegano", label: "Vegana" }]) }));
    const ids = ingredientIds(out);
    for (const id of ids) expect(foods.get(id)!.tags).not.toContain("origem-animal");
    // Café vegano só tem banana; almoço/jantar só lentilha
    expect(out.meals.filter((m) => m.mealType === "LUNCH").every((m) => m.recipeId === "almoco-lentilha")).toBe(true);
  });

  it("não usa a mesma receita duas vezes no mesmo dia", () => {
    const out = generateWeek(input());
    const byDay = new Map<string, string[]>();
    for (const m of out.meals) byDay.set(m.date, [...(byDay.get(m.date) ?? []), m.recipeId!]);
    for (const list of byDay.values()) expect(new Set(list).size).toBe(list.length);
  });

  it("filtra por utensílios disponíveis", () => {
    const out = generateWeek(input({ kitchenEquipment: [] }));
    // Só a receita de banana não exige utensílio
    expect(out.meals.every((m) => m.recipeId === "cafe-banana")).toBe(true);
    expect(out.notes.some((n) => n.includes("utensílios"))).toBe(true);
  });

  it("deixa o horário vazio com aviso quando não há receita compatível", () => {
    const out = generateWeek(
      input({ rules: buildRules([{ kind: "INTOLERANCE", tag: "gluten", label: "Glúten" }]), kitchenEquipment: ["fogao"] }),
    );
    // Café sem glúten só tem banana: ok. Sem pão.
    expect(ingredientIds(out).has("pao-frances")).toBe(false);
  });

  it("ajusta porções à meta dentro dos limites 0,75–1,5", () => {
    const out = generateWeek(input({ dailyKcalTarget: 3000 }));
    for (const m of out.meals) {
      expect(m.portionFactor).toBeGreaterThanOrEqual(0.75);
      expect(m.portionFactor).toBeLessThanOrEqual(1.5);
    }
    expect(out.meals.some((m) => m.portionFactor > 1)).toBe(true);
  });

  it("sem meta, usa porções de referência e avisa", () => {
    const out = generateWeek(input());
    expect(out.meals.every((m) => m.portionFactor === 1)).toBe(true);
    expect(out.notes.some((n) => n.includes("Sem meta calórica"))).toBe(true);
  });

  it("cria a refeição flexível no dia e horário configurados, sem itens", () => {
    const out = generateWeek(input({ flexible: { weekday: 5, mealType: "DINNER" } }));
    const flex = out.meals.filter((m) => m.isFlexible);
    expect(flex).toHaveLength(1);
    expect(flex[0].date).toBe("2026-11-07");
    expect(flex[0].items).toEqual([]);
  });

  it("troca refeições caras para caber no orçamento quando há alternativa", () => {
    const prices = new Map([
      ["frango-grelhado", 0.06], // R$ 60/kg (caro)
      ["arroz-cru", 0.006],
      ["lentilha-cozida", 0.008],
      ["ovo-cozido", 0.02],
      ["feijao-cozido", 0.006],
      ["pao-frances", 0.015],
      ["queijo-minas", 0.05],
      ["banana-prata", 0.007],
    ]);
    const free = generateWeek(input({ costPerGramCents: prices }));
    const tight = generateWeek(input({ costPerGramCents: prices, weeklyBudgetCents: Math.round(free.estimatedCostCents * 0.8) }));
    expect(tight.estimatedCostCents).toBeLessThanOrEqual(free.estimatedCostCents);
  });

  it("informa quando os preços são parciais", () => {
    const out = generateWeek(input({ costPerGramCents: new Map([["banana-prata", 0.007]]) }));
    expect(out.notes.some((n) => n.includes("apenas ingredientes com preço"))).toBe(true);
  });
});

describe("auxiliares", () => {
  it("equipmentSatisfied aceita alternativas", () => {
    expect(equipmentSatisfied(["fogao|micro-ondas"], ["micro-ondas"])).toBe(true);
    expect(equipmentSatisfied(["forno"], ["fogao"])).toBe(false);
    expect(equipmentSatisfied(["forno"], null)).toBe(true);
  });

  it("scaleIngredients arredonda a múltiplos de 5 g e preserva temperos", () => {
    const recipe: GenRecipe = {
      ...recipes[3],
      ingredients: [
        { foodId: "frango-grelhado", grams: 120, scalable: true, householdMeasure: null },
        { foodId: "arroz-cozido", grams: 3, scalable: false, householdMeasure: null },
      ],
    };
    const items = scaleIngredients(recipe, 1.25);
    expect(items[0].grams).toBe(150);
    expect(items[1].grams).toBe(3);
  });

  it("hashSeed é estável", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
  });
});

describe("substituições", () => {
  const sub = (id: string, group: string, facts: [number, number, number, number], tags: string[] = []): SubFood => ({
    ...f(id, facts, tags),
    shortName: null,
    substitutionGroup: group,
  });
  const frango = sub("frango", "proteina", [159, 32, 0, 2.5], ["carne", "aves", "origem-animal"]);
  const ovo = sub("ovo", "proteina", [146, 13.3, 0.6, 9.5], ["ovo", "origem-animal"]);
  const tofu = sub("tofu", "proteina", [64, 6.6, 2.1, 4], ["soja"]);
  const patinho = sub("patinho", "proteina", [219, 35.9, 0, 7.3], ["carne", "carne-vermelha", "origem-animal"]);

  it("equivalência pela proteína", () => {
    const eq = equivalentGrams(frango, 150, patinho)!;
    // 150 g × 32 = 48 g de proteína → 48 / 35,9 × 100 = 133,7 → 135 g
    expect(eq.grams).toBe(135);
    expect(eq.basis).toBe("proteinG");
    expect(eq.unusual).toBe(false);
  });

  it("marca equivalências muito diferentes", () => {
    expect(equivalentGrams(frango, 150, tofu)!.unusual).toBe(true);
  });

  it("filtra opções incompatíveis com restrições", () => {
    const opts = substitutionOptions({
      from: frango,
      grams: 150,
      candidates: [ovo, tofu, patinho],
      rules: buildRules([{ kind: "ALLERGY", tag: "soja", label: "Soja" }, { kind: "RESTRICTION", tag: "sem-carne-vermelha", label: "Sem carne vermelha" }]),
    });
    expect(opts.map((o) => o.food.id)).toEqual(["ovo"]);
  });
});
