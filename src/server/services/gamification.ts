import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { addDays, localDate, startOfWeek, toDbDate, type ISODate } from "@/domain/dates";
import {
  ACHIEVEMENTS,
  CHALLENGES,
  XP_REWARDS,
  consistentWeeks,
  levelFromXp,
  newlyUnlocked,
  type UserStats,
  type WeekActivity,
  type XpKind,
} from "@/domain/gamification/rules";
import type { Celebration } from "@/lib/action-types";
import { db } from "../db";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Concede XP de forma idempotente (mesmo tipo + referência só conta uma vez). */
export async function awardXp(userId: string, kind: XpKind, refId: string, amount?: number): Promise<number> {
  const value = amount ?? (kind in XP_REWARDS ? XP_REWARDS[kind as keyof typeof XP_REWARDS] : 0);
  if (value <= 0) return 0;
  try {
    await db.$transaction([
      db.xpEvent.create({ data: { userId, kind, refId, amount: value } }),
      db.profile.updateMany({ where: { userId }, data: { xpTotal: { increment: value } } }),
    ]);
    return value;
  } catch (error) {
    if (isUniqueViolation(error)) return 0;
    throw error;
  }
}

async function currentXp(userId: string): Promise<number> {
  const p = await db.profile.findUnique({ where: { userId }, select: { xpTotal: true } });
  return p?.xpTotal ?? 0;
}

export async function computeStats(userId: string, timeZone: string): Promise<UserStats> {
  const [
    plansCreated,
    organized,
    mealsCompleted,
    mealsLogged,
    workoutsCompleted,
    shoppingListsDone,
    habitChecks,
    pricesRegistered,
    pantryItems,
    profile,
  ] = await Promise.all([
    db.mealPlan.count({ where: { userId } }),
    db.shoppingList.findMany({
      where: { userId, planId: { not: null } },
      select: { plan: { select: { weekStart: true } } },
    }),
    db.plannedMeal.count({ where: { plan: { userId }, completedAt: { not: null } } }),
    db.mealLog.count({ where: { userId } }),
    db.workoutSession.count({ where: { userId, status: "COMPLETED" } }),
    db.shoppingList.count({ where: { userId, status: "DONE" } }),
    db.habitCheck.count({ where: { habit: { userId } } }),
    db.priceRecord.count({ where: { userId } }),
    db.pantryItem.count({ where: { userId } }),
    db.profile.findUnique({ where: { userId }, select: { waterGoalMl: true } }),
  ]);

  const organizedWeeks = new Set(organized.map((s) => s.plan?.weekStart.toISOString())).size;

  let waterGoalDays = 0;
  if (profile?.waterGoalMl) {
    const rows = await db.$queryRaw<{ days: bigint }[]>`
      SELECT count(*)::bigint AS days FROM (
        SELECT "date" FROM "water_log" WHERE "userId" = ${userId}
        GROUP BY "date" HAVING sum("amountMl") >= ${profile.waterGoalMl}
      ) d`;
    waterGoalDays = Number(rows[0]?.days ?? 0);
  }

  const activeDays = (await activeDates(userId, timeZone)).length;

  return {
    plansCreated,
    organizedWeeks,
    mealsCompleted,
    mealsLogged,
    workoutsCompleted,
    shoppingListsDone,
    waterGoalDays,
    habitChecks,
    pricesRegistered,
    pantryItems,
    activeDays,
  };
}

/** Dias distintos (no fuso do usuário) com qualquer registro. */
export async function activeDates(userId: string, timeZone: string, since?: ISODate): Promise<ISODate[]> {
  const from = since ? toDbDate(since) : new Date("2000-01-01T00:00:00Z");
  const rows = await db.$queryRaw<{ day: Date }[]>`
    SELECT DISTINCT day FROM (
      SELECT pm."date" AS day FROM "planned_meal" pm JOIN "meal_plan" mp ON mp.id = pm."planId"
        WHERE mp."userId" = ${userId} AND pm."completedAt" IS NOT NULL
      UNION SELECT "date" FROM "meal_log" WHERE "userId" = ${userId}
      UNION SELECT (("startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})::date FROM "workout_session"
        WHERE "userId" = ${userId} AND status = 'COMPLETED'
      UNION SELECT "date" FROM "water_log" WHERE "userId" = ${userId}
      UNION SELECT hc."date" FROM "habit_check" hc JOIN "habit" h ON h.id = hc."habitId" WHERE h."userId" = ${userId}
    ) t WHERE day >= ${from}::date ORDER BY day`;
  return rows.map((r) => r.day.toISOString().slice(0, 10));
}

export async function consistencyStreak(userId: string, timeZone: string, today: ISODate): Promise<number> {
  const thisWeek = startOfWeek(today);
  const since = addDays(thisWeek, -7 * 26);
  const days = await activeDates(userId, timeZone, since);
  const perWeek = new Map<string, number>();
  for (const d of days) {
    const w = startOfWeek(d);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  const counts = Array.from({ length: 27 }, (_, i) => perWeek.get(addDays(thisWeek, -7 * i)) ?? 0);
  return consistentWeeks(counts);
}

export async function weekActivity(userId: string, weekStart: ISODate, timeZone: string): Promise<WeekActivity> {
  const start = toDbDate(weekStart);
  const end = toDbDate(addDays(weekStart, 7));
  const profile = await db.profile.findUnique({ where: { userId }, select: { waterGoalMl: true } });

  const [workouts, mealsCompleted, habitChecks, budgetLists, veggieRows, waterRows] = await Promise.all([
    db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM "workout_session"
      WHERE "userId" = ${userId} AND status = 'COMPLETED'
        AND (("startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})::date >= ${start}::date
        AND (("startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})::date < ${end}::date`,
    db.plannedMeal.count({ where: { plan: { userId }, completedAt: { not: null }, date: { gte: start, lt: end } } }),
    db.habitCheck.count({ where: { habit: { userId }, date: { gte: start, lt: end } } }),
    db.shoppingList.findMany({
      where: { userId, status: "DONE", completedAt: { gte: start, lt: end }, budgetCents: { not: null } },
      select: { budgetCents: true, items: { select: { paidCents: true, purchased: true } } },
    }),
    db.$queryRaw<{ n: bigint }[]>`
      SELECT count(DISTINCT pm."date")::bigint AS n
      FROM "planned_meal" pm
      JOIN "meal_plan" mp ON mp.id = pm."planId"
      JOIN "planned_meal_item" pmi ON pmi."plannedMealId" = pm.id
      JOIN "food" f ON f.id = pmi."foodId"
      WHERE mp."userId" = ${userId} AND pm."completedAt" IS NOT NULL
        AND pm."date" >= ${start}::date AND pm."date" < ${end}::date
        AND f.category = 'Verduras, hortaliças e derivados'`,
    profile?.waterGoalMl
      ? db.$queryRaw<{ n: bigint }[]>`
          SELECT count(*)::bigint AS n FROM (
            SELECT "date" FROM "water_log" WHERE "userId" = ${userId}
              AND "date" >= ${start}::date AND "date" < ${end}::date
            GROUP BY "date" HAVING sum("amountMl") >= ${profile.waterGoalMl}
          ) d`
      : Promise.resolve([{ n: BigInt(0) }]),
  ]);

  const withinBudget = budgetLists.filter((l) => {
    const paid = l.items.reduce((acc, i) => acc + (i.purchased && i.paidCents ? i.paidCents : 0), 0);
    return paid > 0 && paid <= (l.budgetCents ?? 0);
  }).length;

  return {
    workouts: Number(workouts[0]?.n ?? 0),
    waterGoalDays: Number(waterRows[0]?.n ?? 0),
    mealsCompleted,
    veggieDays: Number(veggieRows[0]?.n ?? 0),
    habitChecks,
    budgetLists: withinBudget,
  };
}

/** Atualiza desafios ativos da semana; retorna celebrações de desafios concluídos. */
async function evaluateChallenges(userId: string, timeZone: string, today: ISODate): Promise<Celebration[]> {
  const weekStart = startOfWeek(today);
  const active = await db.userChallenge.findMany({
    where: { userId, weekStart: toDbDate(weekStart), status: "ACTIVE" },
    include: { challenge: true },
  });
  if (active.length === 0) return [];
  const activity = await weekActivity(userId, weekStart, timeZone);
  const celebrations: Celebration[] = [];
  for (const uc of active) {
    const metric = uc.challenge.metric as keyof WeekActivity;
    const progress = Math.min(activity[metric] ?? 0, uc.challenge.target);
    const done = progress >= uc.challenge.target;
    await db.userChallenge.update({
      where: { id: uc.id },
      data: { progress, status: done ? "COMPLETED" : "ACTIVE", completedAt: done ? new Date() : null },
    });
    if (done) {
      const xp = await awardXp(userId, "CHALLENGE", `${uc.challenge.code}:${weekStart}`, uc.challenge.xp);
      celebrations.push({
        kind: "challenge",
        title: uc.challenge.title,
        description: uc.challenge.description,
        icon: uc.challenge.icon,
        xp: xp || undefined,
      });
    }
  }
  return celebrations;
}

async function evaluateAchievements(userId: string, timeZone: string): Promise<Celebration[]> {
  const unlockedRows = await db.userAchievement.findMany({
    where: { userId },
    select: { achievement: { select: { code: true } } },
  });
  const unlocked = new Set(unlockedRows.map((u) => u.achievement.code));
  if (unlocked.size === ACHIEVEMENTS.length) return [];
  const stats = await computeStats(userId, timeZone);
  const fresh = newlyUnlocked(stats, unlocked);
  if (fresh.length === 0) return [];
  const defs = await db.achievement.findMany({ where: { code: { in: fresh.map((f) => f.code) } } });
  const celebrations: Celebration[] = [];
  for (const def of defs) {
    try {
      await db.userAchievement.create({ data: { userId, achievementId: def.id } });
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
    const xp = await awardXp(userId, "ACHIEVEMENT", def.code, def.xp);
    celebrations.push({ kind: "achievement", title: def.title, description: def.description, icon: def.icon, xp: xp || undefined });
  }
  return celebrations;
}

/**
 * Registra uma atividade: concede XP, avalia conquistas e desafios e detecta
 * mudança de nível. Retorna as celebrações a exibir.
 */
export async function recordActivity(
  userId: string,
  awards: { kind: XpKind; refId: string; amount?: number }[],
  options: { timeZone?: string } = {},
): Promise<Celebration[]> {
  const timeZone = options.timeZone ?? "America/Sao_Paulo";
  const before = levelFromXp(await currentXp(userId)).level;
  for (const a of awards) await awardXp(userId, a.kind, a.refId, a.amount);
  const today = localDate(new Date(), timeZone);
  const celebrations = [
    ...(await evaluateAchievements(userId, timeZone)),
    ...(await evaluateChallenges(userId, timeZone, today)),
  ];
  const after = levelFromXp(await currentXp(userId)).level;
  if (after > before) {
    celebrations.push({
      kind: "level",
      title: `Nível ${after}`,
      description: "Seu Broto cresceu. Constância conta mais do que perfeição.",
      icon: "sprout",
    });
  }
  return celebrations;
}

export async function joinChallenge(userId: string, code: string, today: ISODate) {
  const challenge = await db.challenge.findUnique({ where: { code } });
  if (!challenge) return null;
  const weekStart = toDbDate(startOfWeek(today));
  return db.userChallenge.upsert({
    where: { userId_challengeId_weekStart: { userId, challengeId: challenge.id, weekStart } },
    create: { userId, challengeId: challenge.id, weekStart },
    update: { status: "ACTIVE", pausedAt: null },
  });
}

export async function pauseChallenge(userId: string, userChallengeId: string) {
  return db.userChallenge.updateMany({
    where: { id: userChallengeId, userId, status: "ACTIVE" },
    data: { status: "PAUSED", pausedAt: new Date() },
  });
}

export async function resumeChallenge(userId: string, userChallengeId: string) {
  return db.userChallenge.updateMany({
    where: { id: userChallengeId, userId, status: "PAUSED" },
    data: { status: "ACTIVE", pausedAt: null },
  });
}

export async function levelInfo(userId: string) {
  return levelFromXp(await currentXp(userId));
}

/** Histórico de XP (mais recente primeiro) e total de eventos. */
export async function xpHistory(userId: string, take = 20) {
  const [events, total] = await Promise.all([
    db.xpEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, kind: true, amount: true, refId: true, createdAt: true },
    }),
    db.xpEvent.count({ where: { userId } }),
  ]);
  return { events, total };
}

/** XP ganho a partir de uma data local (inclusive), no fuso do usuário. */
export async function xpSince(userId: string, since: ISODate, timeZone: string): Promise<number> {
  const rows = await db.$queryRaw<{ xp: bigint | null }[]>`
    SELECT sum(amount)::bigint AS xp FROM "xp_event"
    WHERE "userId" = ${userId}
      AND (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})::date >= ${toDbDate(since)}::date`;
  return Number(rows[0]?.xp ?? 0);
}

/** Catálogo de desafios com a participação do usuário na semana. */
export async function weekChallenges(userId: string, weekStart: ISODate) {
  const [catalog, mine] = await Promise.all([
    db.challenge.findMany({ orderBy: { position: "asc" } }),
    db.userChallenge.findMany({ where: { userId, weekStart: toDbDate(weekStart) } }),
  ]);
  const byChallenge = new Map(mine.map((m) => [m.challengeId, m]));
  return catalog.map((challenge) => ({ challenge, mine: byChallenge.get(challenge.id) ?? null }));
}

export async function unlockedAchievements(userId: string) {
  return db.userAchievement.findMany({
    where: { userId },
    select: { unlockedAt: true, achievement: { select: { code: true, title: true, xp: true } } },
    orderBy: { unlockedAt: "desc" },
  });
}

export async function completedChallengesCount(userId: string): Promise<number> {
  return db.userChallenge.count({ where: { userId, status: "COMPLETED" } });
}

export { CHALLENGES };
