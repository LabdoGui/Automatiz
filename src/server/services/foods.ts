import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { NutritionFacts } from "@/domain/nutrition/calc";
import { normalizeText } from "@/domain/restrictions/engine";
import { db } from "../db";

export const FOOD_SELECT = {
  id: true,
  catalogKey: true,
  name: true,
  shortName: true,
  brand: true,
  category: true,
  state: true,
  basis: true,
  kcal: true,
  proteinG: true,
  carbsG: true,
  fatG: true,
  fiberG: true,
  sodiumMg: true,
  missingFields: true,
  notApplicable: true,
  tags: true,
  family: true,
  allergenReviewed: true,
  substitutionGroup: true,
  purchaseFoodId: true,
  purchaseFactor: true,
  purchaseFactorMethod: true,
  householdMeasure: true,
  unitWeightG: true,
  sourceRef: true,
  ownerId: true,
  dataUpdatedAt: true,
  source: { select: { code: true, name: true, edition: true, year: true, publisher: true } },
} satisfies Prisma.FoodSelect;

export type FoodRecord = Prisma.FoodGetPayload<{ select: typeof FOOD_SELECT }>;

export function foodLabel(food: { shortName: string | null; name: string }): string {
  return food.shortName ?? food.name;
}

export function factsOf(food: Pick<FoodRecord, "kcal" | "proteinG" | "carbsG" | "fatG" | "fiberG">): NutritionFacts {
  return { kcal: food.kcal, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG, fiberG: food.fiberG };
}

export const STATE_LABEL: Record<string, string> = { RAW: "cru", COOKED: "preparado", READY: "pronto" };

/** Alimentos visíveis para o usuário: catálogo + os que ele mesmo cadastrou. */
export function visibleFoodsWhere(userId: string): Prisma.FoodWhereInput {
  return { OR: [{ ownerId: null }, { ownerId: userId }] };
}

export async function searchFoods(userId: string, query: string, limit = 20): Promise<FoodRecord[]> {
  const tokens = normalizeText(query).split(" ").filter((t) => t.length >= 2).slice(0, 5);
  if (tokens.length === 0) return [];
  const results = await db.food.findMany({
    where: {
      AND: [visibleFoodsWhere(userId), ...tokens.map((t) => ({ searchText: { contains: t } }))],
    },
    select: FOOD_SELECT,
    take: 80,
  });
  // Revisados primeiro, depois nomes mais curtos (mais genéricos).
  return results
    .sort(
      (a, b) =>
        Number(b.allergenReviewed) - Number(a.allergenReviewed) ||
        Number(b.missingFields.length === 0) - Number(a.missingFields.length === 0) ||
        foodLabel(a).length - foodLabel(b).length,
    )
    .slice(0, limit);
}

export async function getFood(userId: string, id: string): Promise<FoodRecord | null> {
  return db.food.findFirst({ where: { id, ...visibleFoodsWhere(userId) }, select: FOOD_SELECT });
}

export async function getFoodsByIds(userId: string, ids: string[]): Promise<Map<string, FoodRecord>> {
  if (ids.length === 0) return new Map();
  const foods = await db.food.findMany({
    where: { id: { in: [...new Set(ids)] }, ...visibleFoodsWhere(userId) },
    select: FOOD_SELECT,
  });
  return new Map(foods.map((f) => [f.id, f]));
}

/** Alimentos revisados com grupo de substituição (candidatos a trocas). */
export async function substitutionCandidates(userId: string, group: string): Promise<FoodRecord[]> {
  return db.food.findMany({
    where: { substitutionGroup: group, allergenReviewed: true, ...visibleFoodsWhere(userId) },
    select: FOOD_SELECT,
  });
}

export async function createCustomFood(
  userId: string,
  data: {
    name: string;
    brand: string | null;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number | null;
    tags: string[];
  },
) {
  const count = await db.food.count({ where: { ownerId: userId } });
  if (count >= 300) throw new Error("Limite de alimentos personalizados atingido.");
  return db.food.create({
    data: {
      ownerId: userId,
      name: data.name,
      brand: data.brand,
      searchText: normalizeText(`${data.name} ${data.brand ?? ""}`),
      category: "Meus alimentos",
      state: "READY",
      kcal: data.kcal,
      proteinG: data.proteinG,
      carbsG: data.carbsG,
      fatG: data.fatG,
      fiberG: data.fiberG,
      missingFields: data.fiberG === null ? ["fiberG"] : [],
      tags: data.tags,
      // Alergênicos informados pelo próprio usuário (ele conhece o rótulo).
      allergenReviewed: true,
      dataUpdatedAt: new Date(),
    },
    select: FOOD_SELECT,
  });
}
