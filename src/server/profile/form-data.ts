import "server-only";
import type { MealType } from "@/generated/prisma/client";
import { DEFAULT_MEAL_TIME, MEAL_TYPES } from "@/domain/planner/meal-types";
import { db } from "../db";
import { PANTRY_STAPLES } from "./schemas";

/** Dados do perfil no formato dos formulários (serializável para o cliente). */
export interface ProfileFormData {
  displayName: string;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  goal: string | null;
  experienceLevel: string | null;
  wakeTime: string;
  sleepTime: string;
  trainingWeekdays: number[];
  trainingTime: string;
  trainingMinutes: number | null;
  trainingLocation: string | null;
  trainingEquipment: string[];
  routineNotes: string;
  mealSlots: string[];
  mealTimes: Record<string, string>;
  cookingStyle: string | null;
  cookingMinutes: number | null;
  kitchenEquipment: string[];
  flexibleMealEnabled: boolean;
  flexibleMealWeekday: number | null;
  flexibleMealType: string | null;
  favorites: string[];
  favoritesText: string;
  dislikes: string[];
  dislikesText: string;
  avoidText: string;
  allergies: string[];
  allergiesText: string;
  intolerances: string[];
  restrictions: string[];
  budgetCents: number | null;
  budgetPeriod: string | null;
  hasNutritionist: "yes" | "no" | "";
  goalSource: "PROFESSIONAL" | "SELF" | null;
  goalPeriod: "DAY" | "WEEK";
  goalKcal: number | null;
  goalProteinG: number | null;
  goalCarbsG: number | null;
  goalFatG: number | null;
  goalMeals: number | null;
  goalProfessional: string;
  goalNotes: string;
  trackWater: boolean;
  waterGoalMl: number | null;
  pantry: Record<string, number>;
  pantryLabels: Record<string, string>;
}

export async function buildProfileFormData(userId: string, fallbackName: string): Promise<ProfileFormData> {
  const [profile, prefs, goal, weight, pantryFoods, pantry] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.foodPreference.findMany({ where: { userId } }),
    db.nutritionGoal.findFirst({ where: { userId, active: true }, orderBy: { createdAt: "desc" } }),
    db.bodyMeasurement.findFirst({ where: { userId, weightKg: { not: null } }, orderBy: { date: "desc" } }),
    db.food.findMany({ where: { catalogKey: { in: [...PANTRY_STAPLES] } }, select: { id: true, catalogKey: true, shortName: true, name: true } }),
    db.pantryItem.findMany({ where: { userId } }),
  ]);

  const tags = (kind: string) => prefs.filter((p) => p.kind === kind && p.tag).map((p) => p.tag!);
  const texts = (kind: string) =>
    prefs
      .filter((p) => p.kind === kind && !p.tag)
      .map((p) => p.label)
      .join(", ");

  const mealTimes: Record<string, string> = {};
  for (const m of MEAL_TYPES) mealTimes[m] = DEFAULT_MEAL_TIME[m];
  profile?.mealSlots.forEach((m, i) => {
    mealTimes[m] = profile.mealTimes[i] ?? DEFAULT_MEAL_TIME[m as MealType];
  });

  const pantryByFood = new Map(pantry.map((p) => [p.foodId, p.quantityG]));
  const pantryValues: Record<string, number> = {};
  const pantryLabels: Record<string, string> = {};
  for (const f of pantryFoods) {
    pantryLabels[f.catalogKey!] = f.shortName ?? f.name;
    const q = pantryByFood.get(f.id);
    if (q) pantryValues[f.catalogKey!] = q;
  }

  return {
    displayName: profile?.displayName ?? fallbackName,
    age: profile?.age ?? null,
    heightCm: profile?.heightCm ?? null,
    weightKg: weight?.weightKg ?? null,
    goal: profile?.goal ?? null,
    experienceLevel: profile?.experienceLevel ?? null,
    wakeTime: profile?.wakeTime ?? "",
    sleepTime: profile?.sleepTime ?? "",
    trainingWeekdays: profile?.trainingWeekdays ?? [],
    trainingTime: profile?.trainingTime ?? "",
    trainingMinutes: profile?.trainingMinutes ?? null,
    trainingLocation: profile?.trainingLocation ?? null,
    trainingEquipment: profile?.trainingEquipment ?? [],
    routineNotes: profile?.routineNotes ?? "",
    mealSlots: profile?.mealSlots?.length ? profile.mealSlots : ["BREAKFAST", "LUNCH", "AFTERNOON_SNACK", "DINNER"],
    mealTimes,
    cookingStyle: profile?.cookingStyle ?? null,
    cookingMinutes: profile?.cookingMinutes ?? null,
    kitchenEquipment: profile?.kitchenEquipment ?? [],
    flexibleMealEnabled: profile?.flexibleMealEnabled ?? false,
    flexibleMealWeekday: profile?.flexibleMealWeekday ?? null,
    flexibleMealType: profile?.flexibleMealType ?? null,
    favorites: tags("FAVORITE"),
    favoritesText: texts("FAVORITE"),
    dislikes: tags("DISLIKE"),
    dislikesText: texts("DISLIKE"),
    avoidText: texts("AVOID"),
    allergies: tags("ALLERGY"),
    allergiesText: texts("ALLERGY"),
    intolerances: tags("INTOLERANCE"),
    restrictions: tags("RESTRICTION"),
    budgetCents: profile?.budgetCents ?? null,
    budgetPeriod: profile?.budgetPeriod ?? null,
    hasNutritionist: profile?.hasNutritionist === true ? "yes" : profile?.hasNutritionist === false ? "no" : "",
    goalSource: goal?.source ?? null,
    goalPeriod: goal?.period ?? "DAY",
    goalKcal: goal?.kcal ?? null,
    goalProteinG: goal?.proteinG ?? null,
    goalCarbsG: goal?.carbsG ?? null,
    goalFatG: goal?.fatG ?? null,
    goalMeals: goal?.mealsPerDay ?? null,
    goalProfessional: goal?.professionalName ?? "",
    goalNotes: goal?.notes ?? "",
    trackWater: profile?.trackWater ?? false,
    waterGoalMl: profile?.waterGoalMl ?? null,
    pantry: pantryValues,
    pantryLabels,
  };
}
