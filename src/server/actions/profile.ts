"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localDate, startOfWeek } from "@/domain/dates";
import type { ActionResult } from "@/lib/action-types";
import { zBool } from "@/lib/validation";
import { db } from "../db";
import { parseInput, safeAction, UserFacingError } from "../action-utils";
import { consumeRateLimit } from "../rate-limit";
import { requireUser, userTimezone } from "../session";
import { goalFieldsSchema, STEP_KEYS, STEP_SCHEMAS, type StepKey } from "../profile/schemas";
import { completeOnboarding, clearGoal, saveGoal, saveStep } from "../services/profile";
import { generatePlan } from "../services/planner";
import { createSuggestedRoutine } from "../services/training";
import { recordActivity } from "../services/gamification";
import { recordConsents, revokeConsent } from "../services/account";
import { CELEBRATE_COOKIE, MOTION_COOKIE, THEME_COOKIE, UI_COOKIE_OPTIONS, themeFromSetting } from "../ui-prefs";

const stepKeySchema = z.enum(STEP_KEYS);

async function timezoneOf(userId: string) {
  const s = await db.userSettings.findUnique({ where: { userId }, select: { timezone: true } });
  return userTimezone(s);
}

async function saveStepFrom(formData: FormData, advanceOnboarding: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const stepParsed = stepKeySchema.safeParse(formData.get("step"));
  if (!stepParsed.success) throw new UserFacingError("Etapa inválida.");
  const step: StepKey = stepParsed.data;
  const parsed = parseInput(STEP_SCHEMAS[step], formData);
  if (!parsed.ok) return parsed.result;
  await saveStep({
    userId: user.id,
    userName: user.name,
    step,
    data: parsed.data,
    timeZone: await timezoneOf(user.id),
    advanceOnboarding,
  });
  revalidatePath("/", "layout");
  return { ok: true, message: advanceOnboarding ? undefined : "Alterações salvas." };
}

export async function saveOnboardingStepAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(() => saveStepFrom(formData, true));
}

export async function saveProfileSectionAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(() => saveStepFrom(formData, false));
}

export async function skipOnboardingStepAction(step: string): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser();
    const parsed = stepKeySchema.safeParse(step);
    if (!parsed.success) throw new UserFacingError("Etapa inválida.");
    await db.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, displayName: user.name.slice(0, 40), onboardingStep: STEP_KEYS.indexOf(parsed.data) + 1 },
      update: {},
    });
    await db.profile.updateMany({
      where: { userId: user.id, onboardingStep: { lt: STEP_KEYS.indexOf(parsed.data) + 1 } },
      data: { onboardingStep: STEP_KEYS.indexOf(parsed.data) + 1 },
    });
    return { ok: true };
  });
}

/** Confirma o resumo, gera o primeiro plano e (se houver dias de treino) uma rotina sugerida. */
export async function finishOnboardingAction(_prev: unknown, _formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser();
    const profile = await db.profile.findUnique({ where: { userId: user.id } });
    if (!profile?.goal) throw new UserFacingError("Escolha seu objetivo antes de continuar.");
    if (profile.mealSlots.length === 0) throw new UserFacingError("Informe suas refeições antes de continuar.");
    const tz = await timezoneOf(user.id);
    const week = startOfWeek(localDate(new Date(), tz));
    await completeOnboarding(user.id);
    const existingPlan = await db.mealPlan.count({ where: { userId: user.id } });
    if (existingPlan === 0) await generatePlan(user.id, week);
    const routines = await db.workoutRoutine.count({ where: { userId: user.id } });
    if (routines === 0 && profile.trainingWeekdays.length > 0) await createSuggestedRoutine(user.id);
    const celebrations = await recordActivity(
      user.id,
      [
        { kind: "ONBOARDING_DONE", refId: "onboarding" },
        { kind: "PLAN_CREATED", refId: `week:${week}` },
      ],
      { timeZone: tz },
    );
    // Sem revalidatePath aqui: a página de onboarding redirecionaria e o
    // resultado (com as celebrações) seria descartado. O cliente navega para /inicio.
    return { ok: true, celebrations };
  });
}

const goalSchema = goalFieldsSchema.extend({ source: z.enum(["PROFESSIONAL", "SELF"]) });

export async function saveGoalAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser();
    const parsed = parseInput(goalSchema, formData);
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    if (d.kcal === undefined && d.proteinG === undefined && d.carbsG === undefined && d.fatG === undefined) {
      return { ok: false, error: "Informe pelo menos um valor da meta.", fieldErrors: { kcal: ["Informe a energia ou algum macronutriente."] } };
    }
    await saveGoal(user.id, {
      source: d.source,
      period: d.period,
      kcal: d.kcal ?? null,
      proteinG: d.proteinG ?? null,
      carbsG: d.carbsG ?? null,
      fatG: d.fatG ?? null,
      mealsPerDay: d.mealsPerDay ?? null,
      professionalName: d.professionalName ?? null,
      notes: d.notes ?? null,
    });
    if (d.source === "PROFESSIONAL") await db.profile.update({ where: { userId: user.id }, data: { hasNutritionist: true } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Meta registrada." };
  });
}

export async function clearGoalAction(): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser();
    await clearGoal(user.id);
    revalidatePath("/", "layout");
    return { ok: true, message: "Meta removida. Você verá porções de referência." };
  });
}

const settingsSchema = z.object({
  theme: z.enum(["DARK", "LIGHT", "SYSTEM"]),
  animations: zBool,
  celebrations: zBool,
  notifyMeals: zBool,
  notifyWorkouts: zBool,
  notifyWater: zBool,
  notifyChallenges: zBool,
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Fuso horário inválido."),
});

export async function saveSettingsAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser();
    const parsed = parseInput(settingsSchema, formData);
    if (!parsed.ok) return parsed.result;
    await db.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...parsed.data },
      update: parsed.data,
    });
    const store = await cookies();
    store.set(THEME_COOKIE, themeFromSetting(parsed.data.theme), UI_COOKIE_OPTIONS);
    store.set(MOTION_COOKIE, parsed.data.animations ? "on" : "off", UI_COOKIE_OPTIONS);
    store.set(CELEBRATE_COOKIE, parsed.data.celebrations ? "on" : "off", UI_COOKIE_OPTIONS);
    revalidatePath("/", "layout");
    return { ok: true, message: "Preferências salvas." };
  });
}

export async function setAiOptInAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser();
    await consumeRateLimit(`ai-optin:${user.id}`, 10, 60);
    const enable = formData.get("enable") === "1";
    await db.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, assistantAiOptIn: enable },
      update: { assistantAiOptIn: enable },
    });
    if (enable) await recordConsents(user.id, ["AI_PROCESSING"]);
    else await revokeConsent(user.id, "AI_PROCESSING");
    revalidatePath("/assistente");
    revalidatePath("/perfil");
    return { ok: true, message: enable ? "Assistente com IA ativado." : "Assistente com IA desativado." };
  });
}
