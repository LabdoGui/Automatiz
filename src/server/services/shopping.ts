import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, fromDbDate, toDbDate, type ISODate } from "@/domain/dates";
import {
  computeLine,
  consolidate,
  packageGrams,
  summarizeBudget,
  weeklyBudgetCents,
  type LineResult,
  type PackageSpec,
} from "@/domain/pricing/pricing";
import { substitutionOptions } from "@/domain/nutrition/substitution";
import { foodConflicts } from "@/domain/restrictions/engine";
import { db } from "../db";
import { NotFoundError, UserFacingError } from "../action-utils";
import { FOOD_SELECT, foodLabel, type FoodRecord } from "./foods";
import { PRODUCT_SELECT, priceIndexByFood, specOf, type FoodPrice, type ProductRecord } from "./prices";
import { plannerContext, toSubFood } from "./planner";

const LIST_INCLUDE = {
  items: { orderBy: [{ category: "asc" }, { position: "asc" }] },
  plan: { select: { id: true, weekStart: true, name: true } },
} satisfies Prisma.ShoppingListInclude;

export type ShoppingListFull = Prisma.ShoppingListGetPayload<{ include: typeof LIST_INCLUDE }>;
export type ShoppingItem = ShoppingListFull["items"][number];

export function itemSpec(item: ShoppingItem): PackageSpec | null {
  if (item.packageSize === null || item.packageUnit === null) return null;
  // packageGrams já resolvido na criação; usamos como embalagem em gramas.
  if (item.soldByWeight) return { packageSize: 1000, packageUnit: "G", soldByWeight: true };
  if (item.packageGrams === null) return null;
  return { packageSize: item.packageGrams, packageUnit: "G", soldByWeight: false };
}

export function itemLine(item: ShoppingItem): LineResult {
  return computeLine({
    requiredG: item.requiredG,
    pantryG: item.pantryG,
    spec: itemSpec(item),
    priceCents: item.unitPriceCents,
    manualPackages: item.manualPackages,
  });
}

export async function getOpenList(userId: string) {
  return db.shoppingList.findFirst({ where: { userId, status: "OPEN" }, include: LIST_INCLUDE, orderBy: { createdAt: "desc" } });
}

export async function getList(userId: string, listId: string) {
  const list = await db.shoppingList.findFirst({ where: { id: listId, userId }, include: LIST_INCLUDE });
  if (!list) throw new NotFoundError("Lista");
  return list;
}

export async function listHistory(userId: string) {
  return db.shoppingList.findMany({
    where: { userId },
    include: { items: { select: { paidCents: true, purchased: true, unitPriceCents: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

function chooseProduct(foodId: string, prices: Map<string, FoodPrice>, defaults: Map<string, ProductRecord>) {
  const priced = prices.get(foodId);
  if (priced) return { product: priced.product, price: priced.price };
  const product = defaults.get(foodId);
  return product ? { product, price: null } : null;
}

/**
 * Gera (ou atualiza) a lista de compras a partir do plano ativo.
 * Considera as refeições a partir de `fromDate` ainda não concluídas,
 * consolida ingredientes, converte preparados em alimentos comprados,
 * desconta a despensa e calcula embalagens. Itens já comprados e itens
 * adicionados manualmente são preservados.
 */
export async function generateFromPlan(userId: string, planId: string, fromDate: ISODate) {
  const plan = await db.mealPlan.findFirst({
    where: { id: planId, userId },
    include: {
      meals: {
        where: { date: { gte: toDbDate(fromDate) }, completedAt: null, isFlexible: false },
        include: { items: { include: { food: { select: FOOD_SELECT } } } },
      },
    },
  });
  if (!plan) throw new NotFoundError("Plano");

  const entries = plan.meals.flatMap((m) =>
    m.items.map((i) => ({
      foodId: i.foodId,
      grams: i.grams,
      purchaseFoodId: i.food.purchaseFoodId,
      purchaseFactor: i.food.purchaseFactor,
    })),
  );
  const consolidated = consolidate(entries);
  if (consolidated.length === 0) throw new UserFacingError("Não há refeições pendentes no plano para gerar a lista.");

  const purchaseIds = consolidated.map((c) => c.purchaseFoodId);
  const [foods, pantry, prices, defaults, profile] = await Promise.all([
    db.food.findMany({ where: { id: { in: purchaseIds } }, select: FOOD_SELECT }),
    db.pantryItem.findMany({ where: { userId, foodId: { in: purchaseIds } } }),
    priceIndexByFood(userId),
    db.product.findMany({ where: { foodId: { in: purchaseIds }, ownerId: null, isDefault: true }, select: PRODUCT_SELECT }),
    db.profile.findUnique({ where: { userId }, select: { budgetCents: true, budgetPeriod: true } }),
  ]);
  const foodById = new Map(foods.map((f) => [f.id, f]));
  const pantryBy = new Map(pantry.map((p) => [p.foodId, p.quantityG]));
  const defaultBy = new Map(defaults.map((p) => [p.foodId, p]));

  const budget = profile?.budgetCents && profile.budgetPeriod ? weeklyBudgetCents(profile.budgetCents, profile.budgetPeriod).cents : null;

  const weekStart = fromDbDate(plan.weekStart);
  let list = await db.shoppingList.findFirst({ where: { userId, planId: plan.id, status: "OPEN" }, include: { items: true } });
  if (!list) {
    list = await db.shoppingList.create({
      data: {
        userId,
        planId: plan.id,
        title: "Compras da semana",
        periodStart: toDbDate(fromDate),
        periodEnd: toDbDate(addDays(weekStart, 6)),
        budgetCents: budget,
      },
      include: { items: true },
    });
  } else {
    await db.shoppingList.update({ where: { id: list.id }, data: { periodStart: toDbDate(fromDate), budgetCents: budget } });
  }

  const existing = new Map(list.items.filter((i) => !i.isManual && i.foodId).map((i) => [i.foodId!, i]));
  const seen = new Set<string>();
  let position = 0;
  for (const c of consolidated) {
    const food = foodById.get(c.purchaseFoodId);
    if (!food) continue;
    seen.add(food.id);
    const choice = chooseProduct(food.id, prices, defaultBy);
    const spec = choice ? specOf(choice.product) : null;
    const data = {
      name: choice?.product.name ?? foodLabel(food),
      brand: choice?.product.brand ?? null,
      category: choice?.product.category ?? food.category,
      productId: choice?.product.id ?? null,
      foodId: food.id,
      requiredG: c.grams,
      pantryG: pantryBy.get(food.id) ?? 0,
      packageSize: choice?.product.packageSize ?? null,
      packageUnit: choice?.product.packageUnit ?? null,
      packageGrams: spec ? (spec.soldByWeight ? 1000 : packageGrams(spec)) : null,
      soldByWeight: choice?.product.soldByWeight ?? false,
      unitPriceCents: choice?.price?.priceCents ?? null,
      priceSource: choice?.price?.source ?? null,
      priceStore: choice?.price?.storeName ?? null,
      priceDate: choice?.price?.observedAt ?? null,
      notes: c.converted ? "Quantidade convertida de preparado para cru (estimativa)." : null,
      position: position++,
    };
    const prev = existing.get(food.id);
    if (prev) {
      await db.shoppingListItem.update({
        where: { id: prev.id },
        // Mantém o que já foi comprado/pago e ajustes manuais de quantidade.
        data: prev.purchased ? { requiredG: data.requiredG, pantryG: data.pantryG, position: data.position } : data,
      });
    } else {
      await db.shoppingListItem.create({ data: { ...data, listId: list.id } });
    }
  }
  const stale = list.items.filter((i) => !i.isManual && i.foodId && !seen.has(i.foodId) && !i.purchased);
  if (stale.length) await db.shoppingListItem.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  return list.id;
}

async function ownedItem(userId: string, itemId: string) {
  const item = await db.shoppingListItem.findFirst({ where: { id: itemId, list: { userId } }, include: { list: true } });
  if (!item) throw new NotFoundError("Item");
  return item;
}

export async function setPurchased(userId: string, itemId: string, purchased: boolean, paidCents: number | null, today: ISODate) {
  const item = await ownedItem(userId, itemId);
  await db.shoppingListItem.update({
    where: { id: item.id },
    data: { purchased, purchasedAt: purchased ? new Date() : null, paidCents: purchased ? paidCents : null },
  });
  // O preço pago vira histórico de preços (por embalagem ou por kg).
  if (purchased && paidCents && item.productId) {
    const line = computeLine({
      requiredG: item.requiredG,
      pantryG: item.pantryG,
      spec: itemSpec(item as ShoppingItem),
      priceCents: item.unitPriceCents,
      manualPackages: item.manualPackages,
    });
    let unit: number | null = null;
    if (item.soldByWeight && line.purchasedG) unit = Math.round(paidCents / (line.purchasedG / 1000));
    else if (line.packages && line.packages > 0) unit = Math.round(paidCents / line.packages);
    if (unit && unit > 0) {
      await db.priceRecord.create({
        data: { userId, productId: item.productId, priceCents: unit, observedAt: toDbDate(today), source: "PAID", storeName: item.priceStore },
      });
    }
  }
  return item;
}

export async function setManualPackages(userId: string, itemId: string, packages: number | null) {
  const item = await ownedItem(userId, itemId);
  await db.shoppingListItem.update({ where: { id: item.id }, data: { manualPackages: packages } });
}

export async function setItemPrice(userId: string, itemId: string, priceCents: number, storeName: string | null, today: ISODate) {
  const item = await ownedItem(userId, itemId);
  if (item.productId) {
    await db.priceRecord.create({
      data: { userId, productId: item.productId, priceCents, storeName, observedAt: toDbDate(today), source: "USER" },
    });
  }
  await db.shoppingListItem.update({
    where: { id: item.id },
    data: { unitPriceCents: priceCents, priceSource: "USER", priceStore: storeName, priceDate: toDbDate(today) },
  });
}

export async function removeItem(userId: string, itemId: string) {
  const item = await ownedItem(userId, itemId);
  await db.shoppingListItem.delete({ where: { id: item.id } });
}

export async function addManualItem(userId: string, listId: string, data: { name: string; quantityG: number | null; priceCents: number | null }) {
  const list = await db.shoppingList.findFirst({ where: { id: listId, userId, status: "OPEN" } });
  if (!list) throw new NotFoundError("Lista");
  const count = await db.shoppingListItem.count({ where: { listId } });
  if (count >= 200) throw new UserFacingError("A lista chegou ao limite de 200 itens.");
  return db.shoppingListItem.create({
    data: {
      listId,
      name: data.name,
      category: "Outros",
      requiredG: data.quantityG ?? 0,
      isManual: true,
      unitPriceCents: data.priceCents,
      priceSource: data.priceCents ? "USER" : null,
      packageSize: data.priceCents ? 1 : null,
      packageUnit: data.priceCents ? "UNIT" : null,
      packageGrams: data.priceCents ? Math.max(1, data.quantityG ?? 1) : null,
      manualPackages: data.priceCents ? 1 : null,
      position: 1000 + count,
    },
  });
}

/** Finaliza a lista. Opcionalmente soma as sobras estimadas à despensa. */
export async function completeList(userId: string, listId: string, addLeftovers: boolean) {
  const list = await getList(userId, listId);
  if (list.status === "DONE") return list;
  if (addLeftovers) {
    for (const item of list.items) {
      if (!item.purchased || !item.foodId) continue;
      const line = itemLine(item);
      if (!line.leftoverG || line.leftoverG <= 0) continue;
      await db.pantryItem.upsert({
        where: { userId_foodId: { userId, foodId: item.foodId } },
        create: { userId, foodId: item.foodId, quantityG: Math.round(line.leftoverG) },
        update: { quantityG: { increment: Math.round(line.leftoverG) } },
      });
    }
  }
  await db.shoppingList.update({ where: { id: list.id }, data: { status: "DONE", completedAt: new Date() } });
  return list;
}

export async function deleteList(userId: string, listId: string) {
  const res = await db.shoppingList.deleteMany({ where: { id: listId, userId } });
  if (res.count === 0) throw new NotFoundError("Lista");
}

export function listSummary(list: ShoppingListFull) {
  const lines = list.items.map((i) => ({ item: i, line: itemLine(i) }));
  const budget = summarizeBudget({
    budgetCents: list.budgetCents,
    lines: lines.map(({ item, line }) => ({ purchaseCents: line.purchaseCents, paidCents: item.paidCents, purchased: item.purchased })),
  });
  const consumedCents = lines.reduce((acc, { line }) => acc + (line.consumedCents ?? 0), 0);
  const toBuy = lines.filter(({ item, line }) => !item.purchased && (item.isManual || line.toBuyG > 0));
  const covered = lines.filter(({ item, line }) => !item.isManual && line.toBuyG === 0);
  return { lines, budget, consumedCents, pending: toBuy.length, coveredByPantry: covered.length };
}

export interface SavingTip {
  fromFood: FoodRecord;
  toFood: FoodRecord;
  savingsCents: number;
  occurrences: number;
}

/**
 * Sugestões de economia: troca de alimentos do plano por equivalentes do
 * mesmo grupo nutricional, compatíveis com restrições, mais baratos segundo
 * os preços cadastrados pelo usuário.
 */
export async function savingTips(userId: string, planId: string, fromDate: ISODate): Promise<SavingTip[]> {
  const plan = await db.mealPlan.findFirst({
    where: { id: planId, userId },
    include: {
      meals: {
        where: { date: { gte: toDbDate(fromDate) }, completedAt: null },
        include: { items: { include: { food: { select: FOOD_SELECT } } } },
      },
    },
  });
  if (!plan) return [];
  const [ctx, prices] = await Promise.all([plannerContext(userId), priceIndexByFood(userId)]);
  if (prices.size === 0) return [];
  const groups = [...new Set(plan.meals.flatMap((m) => m.items.map((i) => i.food.substitutionGroup)).filter(Boolean))] as string[];
  const candidates = await db.food.findMany({
    where: { substitutionGroup: { in: groups }, allergenReviewed: true, OR: [{ ownerId: null }, { ownerId: userId }] },
    select: FOOD_SELECT,
  });
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const costPerGram = (f: { id: string; purchaseFoodId: string | null; purchaseFactor: number | null }) => {
    const p = prices.get(f.purchaseFoodId ?? f.id);
    return p ? p.perGramCents * (f.purchaseFoodId && f.purchaseFactor ? f.purchaseFactor : 1) : null;
  };
  const tips = new Map<string, SavingTip>();
  for (const meal of plan.meals) {
    for (const item of meal.items) {
      if (!item.food.substitutionGroup) continue;
      const current = costPerGram(item.food);
      if (current === null) continue;
      const currentCost = current * item.grams;
      const options = substitutionOptions({
        from: toSubFood(item.food),
        grams: item.grams,
        candidates: candidates.filter((c) => c.substitutionGroup === item.food.substitutionGroup).map(toSubFood),
        rules: ctx.rules,
        costPerGram,
      }).filter((o) => o.costCents !== null && !o.unusual && o.costCents < currentCost * 0.85);
      const best = options[0];
      if (!best) continue;
      const to = byId.get(best.food.id)!;
      if (foodConflicts(to, ctx.rules).length > 0) continue;
      const key = `${item.food.id}->${to.id}`;
      const tip = tips.get(key) ?? { fromFood: item.food, toFood: to, savingsCents: 0, occurrences: 0 };
      tip.savingsCents += Math.round(currentCost - best.costCents!);
      tip.occurrences += 1;
      tips.set(key, tip);
    }
  }
  return [...tips.values()].filter((t) => t.savingsCents >= 50).sort((a, b) => b.savingsCents - a.savingsCents).slice(0, 5);
}
