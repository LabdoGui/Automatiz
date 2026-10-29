import "server-only";
import { db } from "../db";

export const CONSENT_VERSION = "2026-10";

/** Exporta todos os dados pessoais do usuário (portabilidade — LGPD art. 18, V). */
export async function exportUserData(userId: string) {
  const [user, profile, settings, consents, preferences, goals, plans, logs, pantry, prices, lists, routines, sessions, measurements, water, habits, xp, achievements, challenges, messages, foods, products, recipes] =
    await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, createdAt: true } }),
      db.profile.findUnique({ where: { userId } }),
      db.userSettings.findUnique({ where: { userId } }),
      db.consentRecord.findMany({ where: { userId } }),
      db.foodPreference.findMany({ where: { userId } }),
      db.nutritionGoal.findMany({ where: { userId } }),
      db.mealPlan.findMany({ where: { userId }, include: { meals: { include: { items: true } } } }),
      db.mealLog.findMany({ where: { userId }, include: { items: true } }),
      db.pantryItem.findMany({ where: { userId } }),
      db.priceRecord.findMany({ where: { userId } }),
      db.shoppingList.findMany({ where: { userId }, include: { items: true } }),
      db.workoutRoutine.findMany({ where: { userId }, include: { workouts: { include: { exercises: true } } } }),
      db.workoutSession.findMany({ where: { userId }, include: { exercises: { include: { sets: true } } } }),
      db.bodyMeasurement.findMany({ where: { userId } }),
      db.waterLog.findMany({ where: { userId } }),
      db.habit.findMany({ where: { userId }, include: { checks: true } }),
      db.xpEvent.findMany({ where: { userId } }),
      db.userAchievement.findMany({ where: { userId }, include: { achievement: { select: { code: true, title: true } } } }),
      db.userChallenge.findMany({ where: { userId }, include: { challenge: { select: { code: true, title: true } } } }),
      db.assistantMessage.findMany({ where: { userId } }),
      db.food.findMany({ where: { ownerId: userId } }),
      db.product.findMany({ where: { ownerId: userId } }),
      db.recipe.findMany({ where: { ownerId: userId }, include: { ingredients: true } }),
    ]);
  return {
    exportedAt: new Date().toISOString(),
    format: "VIVA export v1",
    user,
    profile,
    settings,
    consents,
    preferences,
    nutritionGoals: goals,
    mealPlans: plans,
    mealLogs: logs,
    pantry,
    prices,
    shoppingLists: lists,
    workoutRoutines: routines,
    workoutSessions: sessions,
    bodyMeasurements: measurements,
    waterLogs: water,
    habits,
    xpEvents: xp,
    achievements,
    challenges,
    assistantMessages: messages,
    customFoods: foods,
    customProducts: products,
    customRecipes: recipes,
  };
}

export async function recordConsents(userId: string, kinds: ("PRIVACY_POLICY" | "HEALTH_DATA" | "AI_PROCESSING")[]) {
  await db.consentRecord.createMany({ data: kinds.map((kind) => ({ userId, kind, version: CONSENT_VERSION })) });
}

export async function revokeConsent(userId: string, kind: "AI_PROCESSING") {
  await db.consentRecord.updateMany({ where: { userId, kind, revokedAt: null }, data: { revokedAt: new Date() } });
}
