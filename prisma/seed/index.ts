/**
 * Seed do CATÁLOGO do VIVA (dados de referência, idempotente):
 * fonte TACO, alimentos, receitas, produtos (sem preços), exercícios,
 * conquistas e desafios. Não cria usuários nem dados pessoais.
 * Dados de demonstração ficam em prisma/seed/demo.ts (script separado).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "../../src/server/prisma-factory";
import { ACHIEVEMENTS, CHALLENGES } from "../../src/domain/gamification/rules";
import { CURATED_FOODS } from "./curated-foods";
import { RECIPES } from "./recipes";
import { PRODUCTS } from "./products";
import { EXERCISES } from "./exercises";
import { inferState, inferTags, moistureFactor, nutrientStatus, type TacoFood } from "./taco-rules";
import { normalizeText } from "../../src/domain/restrictions/engine";

const here = path.dirname(fileURLToPath(import.meta.url));
const db = createPrismaClient();

/** Data de publicação da 4ª edição da TACO (referência de atualização dos dados). */
const TACO_DATA_DATE = new Date("2011-01-01T00:00:00Z");
/** Data em que a extração estruturada foi convertida para o VIVA. */
const RETRIEVED_AT = new Date("2026-10-29T00:00:00Z");

async function seedFoods() {
  const raw = JSON.parse(readFileSync(path.join(here, "data/taco.json"), "utf8")) as {
    source: { code: string; name: string; publisher: string; edition: string; year: number; url: string; license: string };
    foods: TacoFood[];
  };

  const source = await db.nutritionSource.upsert({
    where: { code: raw.source.code },
    create: { ...raw.source, retrievedAt: RETRIEVED_AT },
    update: { ...raw.source, retrievedAt: RETRIEVED_AT },
  });

  const curatedByTaco = new Map(CURATED_FOODS.map((c) => [c.tacoId, c]));
  const idByTaco = new Map<number, string>();
  const moistureByTaco = new Map<number, number | null>();

  for (const f of raw.foods) {
    const curated = curatedByTaco.get(f.tacoId);
    const status = nutrientStatus(f);
    if (curated?.notApplicable) {
      for (const field of curated.notApplicable) {
        if (status.values[field] === null) {
          status.values[field] = 0;
          status.notApplicable.push(field);
        }
      }
    }
    const missingFields = (["kcal", "proteinG", "carbsG", "fatG", "fiberG"] as const).filter(
      (k) => status.values[k] === null,
    );
    const data = {
      catalogKey: curated?.key ?? null,
      name: f.name,
      shortName: curated?.shortName ?? null,
      searchText: normalizeText(`${curated?.shortName ?? ""} ${f.name}`),
      category: f.category,
      state: inferState(f.name),
      basis: "G" as const,
      kcal: status.values.kcal,
      proteinG: status.values.proteinG,
      carbsG: status.values.carbsG,
      fatG: status.values.fatG,
      fiberG: status.values.fiberG,
      sodiumMg: f.sodiumMg,
      moisturePct: f.moisturePct,
      missingFields: [...missingFields],
      notApplicable: [...new Set(status.notApplicable)],
      tags: curated ? curated.tags : inferTags(f),
      family: curated?.family ?? null,
      allergenReviewed: Boolean(curated),
      substitutionGroup: curated?.group ?? null,
      householdMeasure: curated?.householdMeasure ?? null,
      unitWeightG: curated?.unitWeightG ?? null,
      dataUpdatedAt: TACO_DATA_DATE,
    };
    const food = await db.food.upsert({
      where: { sourceId_sourceRef: { sourceId: source.id, sourceRef: String(f.tacoId) } },
      create: { ...data, sourceId: source.id, sourceRef: String(f.tacoId) },
      update: data,
    });
    idByTaco.set(f.tacoId, food.id);
    moistureByTaco.set(f.tacoId, f.moisturePct);
  }

  // Vínculos preparado → comprado
  const curatedByKey = new Map(CURATED_FOODS.map((c) => [c.key, c]));
  for (const c of CURATED_FOODS) {
    if (!c.purchase) continue;
    const target = curatedByKey.get(c.purchase);
    if (!target) throw new Error(`Alimento comprado desconhecido: ${c.purchase}`);
    let factor: number | null;
    let method: string;
    if (c.purchaseFactor) {
      factor = c.purchaseFactor.value;
      method = c.purchaseFactor.method;
    } else {
      factor = moistureFactor(moistureByTaco.get(c.tacoId) ?? null, moistureByTaco.get(target.tacoId) ?? null);
      method = "Estimativa por balanço de matéria seca (umidade da TACO, preparado × cru)";
    }
    if (factor === null) throw new Error(`Sem umidade para converter ${c.key} → ${c.purchase}`);
    await db.food.update({
      where: { id: idByTaco.get(c.tacoId)! },
      data: { purchaseFoodId: idByTaco.get(target.tacoId)!, purchaseFactor: factor, purchaseFactorMethod: method },
    });
  }
  console.log(`✓ ${raw.foods.length} alimentos TACO (${CURATED_FOODS.length} revisados)`);
}

async function seedRecipes() {
  const foods = await db.food.findMany({ where: { catalogKey: { not: null } }, select: { id: true, catalogKey: true } });
  const idByKey = new Map(foods.map((f) => [f.catalogKey!, f.id]));
  for (const r of RECIPES) {
    const data = {
      name: r.name,
      description: r.description,
      mealTypes: r.mealTypes,
      prepMinutes: r.prepMinutes,
      difficulty: r.difficulty ?? "BEGINNER",
      equipment: r.equipment,
      steps: r.steps,
      tags: r.tags,
    } as const;
    const recipe = await db.recipe.upsert({ where: { slug: r.slug }, create: { slug: r.slug, ...data }, update: data });
    await db.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
    await db.recipeIngredient.createMany({
      data: r.ingredients.map(([key, grams, household, scalable], position) => {
        const foodId = idByKey.get(key);
        if (!foodId) throw new Error(`Receita ${r.slug}: alimento desconhecido ${key}`);
        return { recipeId: recipe.id, foodId, grams, householdMeasure: household ?? null, scalable: scalable ?? true, position };
      }),
    });
  }
  console.log(`✓ ${RECIPES.length} receitas`);
}

async function seedProducts() {
  const foods = await db.food.findMany({ where: { catalogKey: { not: null } }, select: { id: true, catalogKey: true } });
  const idByKey = new Map(foods.map((f) => [f.catalogKey!, f.id]));
  for (const p of PRODUCTS) {
    const foodId = idByKey.get(p.food);
    if (!foodId) throw new Error(`Produto ${p.key}: alimento desconhecido ${p.food}`);
    const data = {
      name: p.name,
      category: p.category,
      foodId,
      packageSize: p.packageSize,
      packageUnit: p.packageUnit,
      soldByWeight: p.soldByWeight ?? false,
      densityGPerMl: p.densityGPerMl ?? null,
      unitWeightG: p.unitWeightG ?? null,
      isDefault: true,
    };
    await db.product.upsert({ where: { catalogKey: p.key }, create: { catalogKey: p.key, ...data }, update: data });
  }
  console.log(`✓ ${PRODUCTS.length} produtos de referência (sem preços)`);
}

async function seedExercises() {
  for (const e of EXERCISES) {
    const { slug, ...data } = e;
    await db.exercise.upsert({ where: { slug }, create: { slug, ...data }, update: data });
  }
  console.log(`✓ ${EXERCISES.length} exercícios`);
}

async function seedGamification() {
  for (const [position, a] of ACHIEVEMENTS.entries()) {
    const data = { title: a.title, description: a.description, icon: a.icon, xp: a.xp, position };
    await db.achievement.upsert({ where: { code: a.code }, create: { code: a.code, ...data }, update: data });
  }
  for (const [position, c] of CHALLENGES.entries()) {
    const data = { title: c.title, description: c.description, metric: c.metric, target: c.target, xp: c.xp, icon: c.icon, position };
    await db.challenge.upsert({ where: { code: c.code }, create: { code: c.code, ...data }, update: data });
  }
  console.log(`✓ ${ACHIEVEMENTS.length} conquistas e ${CHALLENGES.length} desafios`);
}

async function main() {
  await seedFoods();
  await seedRecipes();
  await seedProducts();
  await seedExercises();
  await seedGamification();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
