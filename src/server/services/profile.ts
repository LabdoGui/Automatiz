import "server-only";
import type { z } from "zod";
import type { MealType, PreferenceKind } from "@/generated/prisma/client";
import { DEFAULT_MEAL_TIME, sortSlots } from "@/domain/planner/meal-types";
import { localDate, toDbDate } from "@/domain/dates";
import { GOAL_MAX_KCAL_PER_DAY, SELF_GOAL_MIN_KCAL_PER_DAY } from "@/domain/nutrition/calc";
import { ALLERGENS, DIET_RESTRICTIONS, FAMILY_LABEL, INTOLERANCES } from "@/domain/restrictions/vocabulary";
import { db } from "../db";
import { UserFacingError } from "../action-utils";
import {
  PANTRY_STAPLES,
  STEP_KEYS,
  type despensaSchema,
  type gostosSchema,
  type metaSchema,
  type objetivoSchema,
  type orcamentoSchema,
  type perfilSchema,
  type refeicoesSchema,
  type restricoesSchema,
  type rotinaSchema,
  type StepKey,
} from "../profile/schemas";

async function ensureProfile(userId: string, fallbackName: string) {
  return db.profile.upsert({
    where: { userId },
    create: { userId, displayName: fallbackName.slice(0, 40) || "Você" },
    update: {},
  });
}

async function replacePreferences(
  userId: string,
  kinds: PreferenceKind[],
  items: { kind: PreferenceKind; tag: string | null; label: string }[],
) {
  const seen = new Set<string>();
  const unique = items.filter((i) => {
    const key = `${i.kind}:${i.label.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  await db.$transaction([
    db.foodPreference.deleteMany({ where: { userId, kind: { in: kinds } } }),
    db.foodPreference.createMany({ data: unique.map((i) => ({ userId, ...i })) }),
  ]);
}

const tagged = (kind: PreferenceKind, tags: string[], labelOf: (t: string) => string) =>
  tags.map((tag) => ({ kind, tag, label: labelOf(tag) }));
const free = (kind: PreferenceKind, texts: string[]) => texts.map((label) => ({ kind, tag: null, label }));
const labelFrom = (list: readonly { tag: string; label: string }[]) => (t: string) => list.find((x) => x.tag === t)?.label ?? t;

export async function saveStep(params: {
  userId: string;
  userName: string;
  step: StepKey;
  data: unknown;
  timeZone: string;
  advanceOnboarding: boolean;
}) {
  const { userId, step, timeZone } = params;
  await ensureProfile(userId, params.userName);

  switch (step) {
    case "perfil": {
      const d = params.data as z.infer<typeof perfilSchema>;
      await db.profile.update({
        where: { userId },
        data: { displayName: d.displayName, age: d.age ?? null, heightCm: d.heightCm ?? null },
      });
      if (d.weightKg !== undefined) {
        const today = toDbDate(localDate(new Date(), timeZone));
        const existing = await db.bodyMeasurement.findFirst({ where: { userId, date: today } });
        if (existing) await db.bodyMeasurement.update({ where: { id: existing.id }, data: { weightKg: d.weightKg } });
        else await db.bodyMeasurement.create({ data: { userId, date: today, weightKg: d.weightKg } });
      }
      break;
    }
    case "objetivo": {
      const d = params.data as z.infer<typeof objetivoSchema>;
      await db.profile.update({ where: { userId }, data: { goal: d.goal } });
      break;
    }
    case "rotina": {
      const d = params.data as z.infer<typeof rotinaSchema>;
      const weekdays = [...new Set(d.trainingWeekdays.map(Number))].sort();
      await db.profile.update({
        where: { userId },
        data: {
          experienceLevel: d.experienceLevel ?? null,
          wakeTime: d.wakeTime ?? null,
          sleepTime: d.sleepTime ?? null,
          trainingWeekdays: weekdays,
          trainingDaysPerWeek: weekdays.length,
          trainingTime: d.trainingTime ?? null,
          trainingMinutes: d.trainingMinutes ?? null,
          trainingLocation: d.trainingLocation ?? null,
          trainingEquipment: d.trainingEquipment,
          routineNotes: d.routineNotes ?? null,
        },
      });
      break;
    }
    case "refeicoes": {
      const d = params.data as z.infer<typeof refeicoesSchema>;
      const slots = sortSlots(d.mealSlots as MealType[]);
      const times = slots.map((m) => (d as unknown as Record<string, string | undefined>)[`time_${m}`] ?? DEFAULT_MEAL_TIME[m]);
      if (d.flexibleMealEnabled && d.flexibleMealType && !slots.includes(d.flexibleMealType as MealType)) {
        throw new UserFacingError("A refeição flexível precisa ser uma das refeições escolhidas.");
      }
      await db.profile.update({
        where: { userId },
        data: {
          mealSlots: slots,
          mealTimes: times,
          cookingStyle: d.cookingStyle ?? null,
          cookingMinutes: d.cookingMinutes ?? null,
          kitchenEquipment: d.kitchenEquipment,
          flexibleMealEnabled: d.flexibleMealEnabled,
          flexibleMealWeekday: d.flexibleMealEnabled ? (d.flexibleMealWeekday ?? null) : null,
          flexibleMealType: d.flexibleMealEnabled ? ((d.flexibleMealType as MealType) ?? null) : null,
        },
      });
      break;
    }
    case "gostos": {
      const d = params.data as z.infer<typeof gostosSchema>;
      const fam = (t: string) => FAMILY_LABEL[t] ?? t;
      await replacePreferences(userId, ["FAVORITE", "DISLIKE", "AVOID"], [
        ...tagged("FAVORITE", d.favorites, fam),
        ...free("FAVORITE", d.favoritesText),
        ...tagged("DISLIKE", d.dislikes, fam),
        ...free("DISLIKE", d.dislikesText),
        ...free("AVOID", d.avoidText),
      ]);
      break;
    }
    case "restricoes": {
      const d = params.data as z.infer<typeof restricoesSchema>;
      await replacePreferences(userId, ["ALLERGY", "INTOLERANCE", "RESTRICTION"], [
        ...tagged("ALLERGY", d.allergies, labelFrom(ALLERGENS)),
        ...free("ALLERGY", d.allergiesText),
        ...tagged("INTOLERANCE", d.intolerances, labelFrom(INTOLERANCES)),
        ...tagged("RESTRICTION", d.restrictions, labelFrom(DIET_RESTRICTIONS)),
      ]);
      break;
    }
    case "orcamento": {
      const d = params.data as z.infer<typeof orcamentoSchema>;
      await db.profile.update({
        where: { userId },
        data: { budgetCents: d.budget ?? null, budgetPeriod: d.budget !== undefined ? (d.budgetPeriod ?? null) : null },
      });
      break;
    }
    case "meta": {
      const d = params.data as z.infer<typeof metaSchema>;
      await db.profile.update({
        where: { userId },
        data: {
          hasNutritionist: d.hasNutritionist === undefined ? null : d.hasNutritionist === "yes",
          trackWater: d.trackWater,
          waterGoalMl: d.trackWater ? (d.waterGoalMl ?? 2000) : null,
        },
      });
      if (d.hasNutritionist === "yes" && (d.kcal !== undefined || d.proteinG !== undefined || d.carbsG !== undefined || d.fatG !== undefined)) {
        await saveGoal(userId, {
          source: "PROFESSIONAL",
          period: d.period ?? "DAY",
          kcal: d.kcal ?? null,
          proteinG: d.proteinG ?? null,
          carbsG: d.carbsG ?? null,
          fatG: d.fatG ?? null,
          mealsPerDay: d.mealsPerDay ?? null,
          professionalName: d.professionalName ?? null,
          notes: d.notes ?? null,
        });
      }
      break;
    }
    case "despensa": {
      const d = params.data as z.infer<typeof despensaSchema>;
      const foods = await db.food.findMany({
        where: { catalogKey: { in: [...PANTRY_STAPLES] } },
        select: { id: true, catalogKey: true },
      });
      for (const f of foods) {
        const qty = (d as unknown as Record<string, number | undefined>)[`pantry_${f.catalogKey}`];
        if (qty === undefined || qty === 0) {
          await db.pantryItem.deleteMany({ where: { userId, foodId: f.id } });
        } else {
          await db.pantryItem.upsert({
            where: { userId_foodId: { userId, foodId: f.id } },
            create: { userId, foodId: f.id, quantityG: qty },
            update: { quantityG: qty },
          });
        }
      }
      break;
    }
  }

  if (params.advanceOnboarding) {
    const index = STEP_KEYS.indexOf(step) + 1;
    await db.profile.updateMany({
      where: { userId, onboardingStep: { lt: index } },
      data: { onboardingStep: index },
    });
  }
}

export interface GoalInput {
  source: "PROFESSIONAL" | "SELF";
  period: "DAY" | "WEEK";
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  mealsPerDay: number | null;
  professionalName: string | null;
  notes: string | null;
}

/** Valida limites de segurança e registra a meta ativa (a anterior fica no histórico). */
export async function saveGoal(userId: string, goal: GoalInput) {
  if (goal.kcal !== null) {
    const daily = goal.period === "WEEK" ? goal.kcal / 7 : goal.kcal;
    if (daily > GOAL_MAX_KCAL_PER_DAY) {
      throw new UserFacingError(
        goal.period === "WEEK"
          ? "Esse valor semanal equivale a mais de 6.000 kcal por dia. Confira se a meta não é diária."
          : "Esse valor parece alto demais para uma meta diária. Confira o número informado.",
      );
    }
    if (goal.period === "WEEK" && goal.kcal < 3500) {
      throw new UserFacingError("Esse valor é muito baixo para uma meta semanal. Ele não seria uma meta diária?");
    }
    if (goal.source === "SELF" && daily < SELF_GOAL_MIN_KCAL_PER_DAY) {
      throw new UserFacingError(
        "Metas abaixo de 1.200 kcal por dia só podem ser registradas com orientação profissional. Converse com um(a) nutricionista.",
      );
    }
  }
  await db.$transaction([
    db.nutritionGoal.updateMany({ where: { userId, active: true }, data: { active: false } }),
    db.nutritionGoal.create({ data: { userId, ...goal, active: true } }),
  ]);
}

export async function clearGoal(userId: string) {
  await db.nutritionGoal.updateMany({ where: { userId, active: true }, data: { active: false } });
}

export async function getActiveGoal(userId: string) {
  return db.nutritionGoal.findFirst({ where: { userId, active: true }, orderBy: { createdAt: "desc" } });
}

export async function getPreferences(userId: string) {
  return db.foodPreference.findMany({ where: { userId }, orderBy: [{ kind: "asc" }, { label: "asc" }] });
}

export async function completeOnboarding(userId: string) {
  await db.profile.update({
    where: { userId },
    data: { onboardingCompletedAt: new Date(), onboardingStep: STEP_KEYS.length },
  });
}
