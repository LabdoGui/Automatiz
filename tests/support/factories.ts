import { randomUUID } from "node:crypto";
import { db } from "@/server/db";

const created: string[] = [];

/** Usuário de teste com perfil completo (onboarding concluído) e preferências opcionais. */
export async function createTestUser(
  opts: { allergies?: { tag: string; label: string }[]; dislikes?: string[]; trainingWeekdays?: number[] } = {},
) {
  const id = `test_${randomUUID()}`;
  const email = `${id}@teste.viva.invalid`;
  await db.user.create({ data: { id, name: "Pessoa Teste", email } });
  await db.userSettings.create({ data: { userId: id } });
  await db.profile.create({
    data: {
      userId: id,
      displayName: "Pessoa Teste",
      goal: "HABITS",
      experienceLevel: "BEGINNER",
      trainingLocation: "GYM",
      trainingDaysPerWeek: (opts.trainingWeekdays ?? [0, 2, 4]).length,
      trainingWeekdays: opts.trainingWeekdays ?? [0, 2, 4],
      mealSlots: ["BREAKFAST", "LUNCH", "AFTERNOON_SNACK", "DINNER"],
      mealTimes: ["07:30", "12:30", "16:00", "19:30"],
      cookingStyle: "BALANCED",
      cookingMinutes: 30,
      budgetCents: 30000,
      budgetPeriod: "WEEK",
      onboardingStep: 9,
      onboardingCompletedAt: new Date(),
    },
  });
  for (const a of opts.allergies ?? []) {
    await db.foodPreference.create({ data: { userId: id, kind: "ALLERGY", tag: a.tag, label: a.label } });
  }
  for (const d of opts.dislikes ?? []) {
    await db.foodPreference.create({ data: { userId: id, kind: "DISLIKE", label: d } });
  }
  created.push(id);
  return { id, email };
}

export async function cleanupTestUsers() {
  if (created.length === 0) return;
  await db.user.deleteMany({ where: { id: { in: created.splice(0) } } });
}
