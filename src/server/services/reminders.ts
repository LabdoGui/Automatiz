import "server-only";
import { localDate, localTime, startOfWeek, toDbDate, weekdayIndex } from "@/domain/dates";
import { buildReminders, type Reminder } from "@/domain/gamification/reminders";
import { MEAL_TYPE_LABEL } from "@/domain/planner/meal-types";
import { db } from "../db";
import { userTimezone } from "../session";
import { getActivePlan } from "./planner";
import { getActiveRoutine, openSession } from "./training";
import { waterTotal } from "./progress";

/**
 * Lembretes atuais de uma pessoa, segundo as preferências dela. Usado pelo
 * início (lembretes no app) e pelo envio agendado de notificações push.
 */
export async function remindersFor(userId: string, now: Date = new Date()): Promise<{ reminders: Reminder[]; time: string; wake: string | null; sleep: string | null }> {
  const [settings, profile] = await Promise.all([
    db.userSettings.findUnique({ where: { userId } }),
    db.profile.findUnique({ where: { userId }, select: { trackWater: true, waterGoalMl: true, wakeTime: true, sleepTime: true } }),
  ]);
  const tz = userTimezone(settings);
  const today = localDate(now, tz);
  const time = localTime(now, tz);
  const base = { time, wake: profile?.wakeTime ?? null, sleep: profile?.sleepTime ?? null };
  if (!settings || !(settings.notifyMeals || settings.notifyWater || settings.notifyWorkouts || settings.notifyChallenges)) {
    return { reminders: [], ...base };
  }

  const weekStart = startOfWeek(today);
  const [plan, routine, session, lastWorkout, challenges, water] = await Promise.all([
    settings.notifyMeals ? getActivePlan(userId, weekStart) : Promise.resolve(null),
    settings.notifyWorkouts ? getActiveRoutine(userId) : Promise.resolve(null),
    settings.notifyWorkouts ? openSession(userId) : Promise.resolve(null),
    settings.notifyWorkouts
      ? db.workoutSession.findFirst({ where: { userId, status: "COMPLETED" }, orderBy: { startedAt: "desc" }, select: { startedAt: true } })
      : Promise.resolve(null),
    settings.notifyChallenges
      ? db.userChallenge.findMany({ where: { userId, weekStart: toDbDate(weekStart) }, include: { challenge: true } })
      : Promise.resolve([]),
    settings.notifyWater && profile?.trackWater ? waterTotal(userId, today) : Promise.resolve(0),
  ]);

  const weekday = weekdayIndex(today);
  const todaysWorkout = routine?.workouts.find((w) => w.weekdays.includes(weekday)) ?? null;
  const pendingMeals = (plan?.meals ?? []).filter((m) => m.date.toISOString().slice(0, 10) === today && !m.completedAt);

  const reminders = buildReminders({
    now: time,
    prefs: settings,
    pendingMeals: pendingMeals.map((m) => ({ id: m.id, label: MEAL_TYPE_LABEL[m.mealType], time: m.time })),
    water: profile?.trackWater && profile.waterGoalMl ? { totalMl: water, goalMl: profile.waterGoalMl } : null,
    workout: todaysWorkout
      ? {
          label: todaysWorkout.label,
          name: todaysWorkout.name,
          doneToday: lastWorkout ? localDate(lastWorkout.startedAt, tz) === today : false,
          inProgress: Boolean(session),
        }
      : null,
    challenges: challenges.map((c) => ({ id: c.id, title: c.challenge.title, progress: c.progress, target: c.challenge.target, status: c.status })),
    daysLeftInWeek: 7 - weekday,
  });
  return { reminders, ...base };
}
