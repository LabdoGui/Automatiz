"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDays, localDate } from "@/domain/dates";
import type { ActionResult } from "@/lib/action-types";
import { zId, zInt, zISODate, zOptionalDecimal, zOptionalText, zRequiredText } from "@/lib/validation";
import { db } from "../db";
import { parseInput, safeAction, UserFacingError } from "../action-utils";
import { requireUser, userTimezone } from "../session";
import * as progress from "../services/progress";
import { joinChallenge, pauseChallenge, recordActivity, resumeChallenge } from "../services/gamification";

async function ctx() {
  const user = await requireUser();
  const s = await db.userSettings.findUnique({ where: { userId: user.id }, select: { timezone: true } });
  const tz = userTimezone(s);
  return { user, tz, today: localDate(new Date(), tz) };
}

function refresh() {
  revalidatePath("/inicio");
  revalidatePath("/progresso", "layout");
  revalidatePath("/conquistas");
}

export async function addWaterAction(amountMl: number): Promise<ActionResult<{ total: number }>> {
  return safeAction<{ total: number }>(async () => {
    const { user, tz, today } = await ctx();
    const parsed = z.number().int().min(50).max(2000).safeParse(amountMl);
    if (!parsed.success) throw new UserFacingError("Quantidade inválida.");
    await progress.addWater(user.id, today, parsed.data);
    const total = await progress.waterTotal(user.id, today);
    const profile = await db.profile.findUnique({ where: { userId: user.id }, select: { waterGoalMl: true } });
    const reached = profile?.waterGoalMl ? total >= profile.waterGoalMl : false;
    const celebrations = reached ? await recordActivity(user.id, [{ kind: "WATER_GOAL", refId: today }], { timeZone: tz }) : [];
    refresh();
    return { ok: true, data: { total }, celebrations, message: reached && celebrations.length ? "Meta de água do dia alcançada." : undefined };
  });
}

export async function undoWaterAction(): Promise<ActionResult> {
  return safeAction(async () => {
    const { user, today } = await ctx();
    await progress.undoLastWater(user.id, today);
    refresh();
    return { ok: true, message: "Último registro de água desfeito." };
  });
}

const measurementSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), zId.optional()),
  date: zISODate,
  weightKg: zOptionalDecimal(25, 400, "o peso"),
  waistCm: zOptionalDecimal(30, 250, "a cintura"),
  hipCm: zOptionalDecimal(30, 250, "o quadril"),
  chestCm: zOptionalDecimal(30, 250, "o peito"),
  armCm: zOptionalDecimal(10, 100, "o braço"),
  thighCm: zOptionalDecimal(20, 150, "a coxa"),
  notes: zOptionalText(300),
});

export async function saveMeasurementAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user, today } = await ctx();
    const parsed = parseInput(measurementSchema, formData);
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    if (d.date > today) return { ok: false, error: "A data não pode estar no futuro.", fieldErrors: { date: ["Escolha hoje ou um dia anterior."] } };
    if (d.date < addDays(today, -365 * 5)) return { ok: false, error: "Data muito antiga.", fieldErrors: { date: ["Data muito antiga."] } };
    await progress.saveMeasurement(user.id, d.id ?? null, {
      date: d.date,
      weightKg: d.weightKg ?? null,
      waistCm: d.waistCm ?? null,
      hipCm: d.hipCm ?? null,
      chestCm: d.chestCm ?? null,
      armCm: d.armCm ?? null,
      thighCm: d.thighCm ?? null,
      notes: d.notes ?? null,
    });
    refresh();
    return { ok: true, message: d.id ? "Registro corrigido." : "Medidas registradas." };
  });
}

export async function deleteMeasurementAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ id: zId }), formData);
    if (!parsed.ok) return parsed.result;
    await progress.deleteMeasurement(user.id, parsed.data.id);
    refresh();
    return { ok: true, message: "Registro excluído." };
  });
}

export async function createHabitAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(
      z.object({ name: zRequiredText("o nome do hábito", 50), icon: z.enum(["sparkles", "droplets", "leaf", "flame", "star", "repeat", "sprout", "utensils"]) }),
      formData,
    );
    if (!parsed.ok) return parsed.result;
    await progress.createHabit(user.id, parsed.data.name, parsed.data.icon);
    refresh();
    return { ok: true, message: "Hábito criado." };
  });
}

export async function archiveHabitAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ habitId: zId }), formData);
    if (!parsed.ok) return parsed.result;
    await progress.archiveHabit(user.id, parsed.data.habitId);
    refresh();
    return { ok: true, message: "Hábito arquivado. O histórico continua salvo." };
  });
}

export async function toggleHabitAction(habitId: string, date: string): Promise<ActionResult<{ checked: boolean }>> {
  return safeAction<{ checked: boolean }>(async () => {
    const { user, tz, today } = await ctx();
    if (!zId.safeParse(habitId).success || !zISODate.safeParse(date).success) throw new UserFacingError("Dados inválidos.");
    if (date > today || date < addDays(today, -6)) throw new UserFacingError("Marque hábitos dos últimos 7 dias.");
    const res = await progress.toggleHabit(user.id, habitId, date);
    const celebrations = res.checked && res.checkId ? await recordActivity(user.id, [{ kind: "HABIT_CHECK", refId: res.checkId }], { timeZone: tz }) : [];
    refresh();
    return { ok: true, data: { checked: res.checked }, celebrations };
  });
}

export async function joinChallengeAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user, tz, today } = await ctx();
    const parsed = parseInput(z.object({ code: z.string().min(1).max(40) }), formData);
    if (!parsed.ok) return parsed.result;
    const uc = await joinChallenge(user.id, parsed.data.code, today);
    if (!uc) throw new UserFacingError("Desafio não encontrado.");
    const celebrations = await recordActivity(user.id, [], { timeZone: tz });
    refresh();
    return { ok: true, message: "Desafio aceito. Bom ritmo!", celebrations };
  });
}

export async function pauseChallengeAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ id: zId, resume: z.enum(["0", "1"]) }), formData);
    if (!parsed.ok) return parsed.result;
    if (parsed.data.resume === "1") await resumeChallenge(user.id, parsed.data.id);
    else await pauseChallenge(user.id, parsed.data.id);
    refresh();
    return { ok: true, message: parsed.data.resume === "1" ? "Desafio retomado." : "Desafio pausado. Sem problemas." };
  });
}

export async function setWaterGoalAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ waterGoalMl: zInt(500, 6000, "a meta de água") }), formData);
    if (!parsed.ok) return parsed.result;
    await db.profile.update({ where: { userId: user.id }, data: { trackWater: true, waterGoalMl: parsed.data.waterGoalMl } });
    refresh();
    return { ok: true, message: "Meta de água atualizada." };
  });
}
