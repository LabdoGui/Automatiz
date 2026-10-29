"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localDate, startOfWeek, toDbDate } from "@/domain/dates";
import type { ActionResult } from "@/lib/action-types";
import {
  zBool,
  zDecimal,
  zId,
  zISODate,
  zMoneyCents,
  zOptionalDecimal,
  zOptionalInt,
  zOptionalMoneyCents,
  zOptionalText,
  zRequiredText,
} from "@/lib/validation";
import { db } from "../db";
import { parseInput, safeAction, UserFacingError } from "../action-utils";
import { consumeRateLimit } from "../rate-limit";
import { requireUser, userTimezone } from "../session";
import * as shopping from "../services/shopping";
import * as prices from "../services/prices";
import { recordActivity } from "../services/gamification";

async function ctx() {
  const user = await requireUser();
  const s = await db.userSettings.findUnique({ where: { userId: user.id }, select: { timezone: true } });
  const tz = userTimezone(s);
  return { user, tz, today: localDate(new Date(), tz) };
}

function refresh() {
  revalidatePath("/compras", "layout");
  revalidatePath("/inicio");
  revalidatePath("/alimentacao", "layout");
}

export async function generateListAction(_prev: unknown, _formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user, tz, today } = await ctx();
    await consumeRateLimit(`list:${user.id}`, 30, 60 * 60);
    const weekStart = startOfWeek(today);
    const plan = await db.mealPlan.findFirst({ where: { userId: user.id, weekStart: toDbDate(weekStart), status: "ACTIVE" } });
    if (!plan) throw new UserFacingError("Gere o planejamento desta semana antes de montar a lista.");
    await shopping.generateFromPlan(user.id, plan.id, today);
    const celebrations = await recordActivity(user.id, [], { timeZone: tz });
    refresh();
    return { ok: true, message: "Lista atualizada com as refeições pendentes da semana.", celebrations };
  });
}

export async function togglePurchasedAction(itemId: string, purchased: boolean): Promise<ActionResult> {
  return safeAction(async () => {
    const { user, today } = await ctx();
    if (!zId.safeParse(itemId).success) throw new UserFacingError("Item inválido.");
    await shopping.setPurchased(user.id, itemId, purchased, null, today);
    refresh();
    return { ok: true };
  });
}

export async function setPaidAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user, tz, today } = await ctx();
    const parsed = parseInput(z.object({ itemId: zId, paid: zMoneyCents("o valor pago") }), formData);
    if (!parsed.ok) return parsed.result;
    await shopping.setPurchased(user.id, parsed.data.itemId, true, parsed.data.paid, today);
    const celebrations = await recordActivity(user.id, [{ kind: "PRICE_ADDED", refId: `paid:${parsed.data.itemId}` }], { timeZone: tz });
    refresh();
    return { ok: true, message: "Valor pago registrado. Ele também entra no seu histórico de preços.", celebrations };
  });
}

export async function setPackagesAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ itemId: zId, packages: zOptionalInt(0, 99, "a quantidade de embalagens") }), formData);
    if (!parsed.ok) return parsed.result;
    await shopping.setManualPackages(user.id, parsed.data.itemId, parsed.data.packages ?? null);
    refresh();
    return { ok: true, message: parsed.data.packages === undefined ? "Quantidade automática restaurada." : "Quantidade ajustada." };
  });
}

export async function setItemPriceAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user, tz, today } = await ctx();
    const parsed = parseInput(z.object({ itemId: zId, price: zMoneyCents("o preço"), store: zOptionalText(80) }), formData);
    if (!parsed.ok) return parsed.result;
    if (parsed.data.price === 0) return { ok: false, error: "Informe um preço maior que zero.", fieldErrors: { price: ["Informe um preço maior que zero."] } };
    await shopping.setItemPrice(user.id, parsed.data.itemId, parsed.data.price, parsed.data.store ?? null, today);
    const celebrations = await recordActivity(user.id, [{ kind: "PRICE_ADDED", refId: `item:${parsed.data.itemId}:${today}` }], { timeZone: tz });
    refresh();
    return { ok: true, message: "Preço registrado.", celebrations };
  });
}

export async function removeListItemAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ itemId: zId }), formData);
    if (!parsed.ok) return parsed.result;
    await shopping.removeItem(user.id, parsed.data.itemId);
    refresh();
    return { ok: true, message: "Item removido da lista." };
  });
}

export async function addManualItemAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(
      z.object({ listId: zId, name: zRequiredText("o nome do item", 60), quantityG: zOptionalDecimal(1, 100_000, "a quantidade"), price: zOptionalMoneyCents("o preço") }),
      formData,
    );
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    await shopping.addManualItem(user.id, d.listId, { name: d.name, quantityG: d.quantityG ?? null, priceCents: d.price ?? null });
    refresh();
    return { ok: true, message: "Item adicionado." };
  });
}

export async function completeListAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user, tz } = await ctx();
    const parsed = parseInput(z.object({ listId: zId, addLeftovers: zBool }), formData);
    if (!parsed.ok) return parsed.result;
    const list = await shopping.completeList(user.id, parsed.data.listId, parsed.data.addLeftovers);
    const celebrations = await recordActivity(user.id, [{ kind: "SHOPPING_DONE", refId: list.id }], { timeZone: tz });
    refresh();
    return { ok: true, message: "Lista finalizada.", celebrations };
  });
}

export async function deleteListAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ listId: zId }), formData);
    if (!parsed.ok) return parsed.result;
    await shopping.deleteList(user.id, parsed.data.listId);
    refresh();
    return { ok: true, message: "Lista excluída." };
  });
}

// ─────────────────────────────────────────────────────────────
// Preços e produtos
// ─────────────────────────────────────────────────────────────

export async function addPriceAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user, tz, today } = await ctx();
    const parsed = parseInput(
      z.object({ productId: zId, price: zMoneyCents("o preço"), store: zOptionalText(80), date: zISODate }),
      formData,
    );
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    if (d.date > today) return { ok: false, error: "A data não pode estar no futuro.", fieldErrors: { date: ["Use hoje ou uma data anterior."] } };
    const record = await prices.addPrice(user.id, { productId: d.productId, priceCents: d.price, storeName: d.store ?? null, observedAt: d.date, source: "USER" });
    const celebrations = await recordActivity(user.id, [{ kind: "PRICE_ADDED", refId: record.id }], { timeZone: tz });
    refresh();
    return { ok: true, message: "Preço registrado.", celebrations };
  });
}

export async function deletePriceAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ priceId: zId }), formData);
    if (!parsed.ok) return parsed.result;
    await prices.deletePrice(user.id, parsed.data.priceId);
    refresh();
    return { ok: true, message: "Preço excluído." };
  });
}

export async function importPricesAction(_prev: unknown, formData: FormData): Promise<ActionResult<{ imported: number; errors: { line: number; message: string }[] }>> {
  return safeAction<{ imported: number; errors: { line: number; message: string }[] }>(async () => {
    const { user, tz, today } = await ctx();
    await consumeRateLimit(`import:${user.id}`, 10, 60 * 60);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolha um arquivo CSV.", fieldErrors: { file: ["Escolha um arquivo CSV."] } };
    if (file.size > 200_000) return { ok: false, error: "Arquivo muito grande (máximo 200 KB).", fieldErrors: { file: ["Máximo 200 KB."] } };
    if (!/\.(csv|txt)$/i.test(file.name)) return { ok: false, error: "Use um arquivo .csv.", fieldErrors: { file: ["Use um arquivo .csv."] } };
    const text = (await file.text()).replace(/^﻿/, "");
    const report = await prices.importPricesCsv(user.id, text, today);
    const celebrations = report.imported ? await recordActivity(user.id, [], { timeZone: tz }) : [];
    refresh();
    return {
      ok: true,
      data: report,
      celebrations,
      message: report.errors.length
        ? `${report.imported} preços importados; ${report.errors.length} linhas com problema.`
        : `${report.imported} preços importados.`,
    };
  });
}

export async function createProductAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(
      z.object({
        name: zRequiredText("o nome do produto", 80),
        brand: zOptionalText(60),
        foodId: z.string().min(1, "Escolha o alimento correspondente.").pipe(zId),
        packageSize: zDecimal(0.1, 100_000, "o tamanho da embalagem"),
        packageUnit: z.enum(["G", "ML", "UNIT"]),
        soldByWeight: zBool,
        unitWeightG: zOptionalDecimal(1, 5000, "o peso por unidade"),
        densityGPerMl: zOptionalDecimal(0.3, 2, "a densidade"),
      }),
      formData,
    );
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    if (d.packageUnit === "ML" && d.densityGPerMl === undefined) {
      return { ok: false, error: "Informe a densidade para converter ml em gramas.", fieldErrors: { densityGPerMl: ["Ex.: 1,0 para líquidos parecidos com água; 0,92 para óleos."] } };
    }
    await prices.createCustomProduct(user.id, {
      name: d.name,
      brand: d.brand ?? null,
      foodId: d.foodId,
      packageSize: d.packageSize,
      packageUnit: d.packageUnit,
      soldByWeight: d.soldByWeight,
      unitWeightG: d.unitWeightG ?? null,
      densityGPerMl: d.densityGPerMl ?? null,
    });
    refresh();
    return { ok: true, message: "Produto criado. Informe o preço para usá-lo nas listas." };
  });
}
