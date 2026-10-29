import "server-only";
import { addDays, rangeDates, startOfWeek, toDbDate, type ISODate } from "@/domain/dates";
import { db } from "../db";
import { NotFoundError, UserFacingError } from "../action-utils";
import { itemLine } from "./shopping";

// ─────────────────────────────────────────────────────────────
// Medidas corporais (opcionais)
// ─────────────────────────────────────────────────────────────

export interface MeasurementInput {
  date: ISODate;
  weightKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  notes: string | null;
}

export async function listMeasurements(userId: string, from?: ISODate, to?: ISODate) {
  return db.bodyMeasurement.findMany({
    where: {
      userId,
      ...(from || to ? { date: { ...(from ? { gte: toDbDate(from) } : {}), ...(to ? { lte: toDbDate(to) } : {}) } } : {}),
    },
    orderBy: { date: "asc" },
  });
}

export async function saveMeasurement(userId: string, id: string | null, data: MeasurementInput) {
  const values = [data.weightKg, data.waistCm, data.hipCm, data.chestCm, data.armCm, data.thighCm];
  if (values.every((v) => v === null)) throw new UserFacingError("Informe pelo menos uma medida.");
  const payload = { ...data, date: toDbDate(data.date) };
  if (id) {
    const res = await db.bodyMeasurement.updateMany({ where: { id, userId }, data: payload });
    if (res.count === 0) throw new NotFoundError("Registro");
    return;
  }
  await db.bodyMeasurement.create({ data: { userId, ...payload } });
}

export async function deleteMeasurement(userId: string, id: string) {
  const res = await db.bodyMeasurement.deleteMany({ where: { id, userId } });
  if (res.count === 0) throw new NotFoundError("Registro");
}

// ─────────────────────────────────────────────────────────────
// Água
// ─────────────────────────────────────────────────────────────

export async function addWater(userId: string, date: ISODate, amountMl: number) {
  const total = await waterTotal(userId, date);
  if (total + amountMl > 10_000) throw new UserFacingError("Esse registro passa de 10 litros no dia. Confira o valor.");
  return db.waterLog.create({ data: { userId, date: toDbDate(date), amountMl } });
}

export async function undoLastWater(userId: string, date: ISODate) {
  const last = await db.waterLog.findFirst({ where: { userId, date: toDbDate(date) }, orderBy: { createdAt: "desc" } });
  if (!last) throw new UserFacingError("Não há registros de água hoje.");
  await db.waterLog.delete({ where: { id: last.id } });
}

export async function waterTotal(userId: string, date: ISODate): Promise<number> {
  const agg = await db.waterLog.aggregate({ where: { userId, date: toDbDate(date) }, _sum: { amountMl: true } });
  return agg._sum.amountMl ?? 0;
}

export async function waterByDay(userId: string, from: ISODate, to: ISODate): Promise<Map<ISODate, number>> {
  const rows = await db.waterLog.groupBy({
    by: ["date"],
    where: { userId, date: { gte: toDbDate(from), lte: toDbDate(to) } },
    _sum: { amountMl: true },
  });
  return new Map(rows.map((r) => [r.date.toISOString().slice(0, 10), r._sum.amountMl ?? 0]));
}

// ─────────────────────────────────────────────────────────────
// Hábitos
// ─────────────────────────────────────────────────────────────

export async function listHabits(userId: string, from: ISODate, to: ISODate) {
  return db.habit.findMany({
    where: { userId, active: true },
    include: { checks: { where: { date: { gte: toDbDate(from), lte: toDbDate(to) } } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createHabit(userId: string, name: string, icon: string) {
  const count = await db.habit.count({ where: { userId, active: true } });
  if (count >= 12) throw new UserFacingError("Você pode acompanhar até 12 hábitos ao mesmo tempo.");
  return db.habit.create({ data: { userId, name, icon } });
}

export async function archiveHabit(userId: string, habitId: string) {
  const res = await db.habit.updateMany({ where: { id: habitId, userId }, data: { active: false } });
  if (res.count === 0) throw new NotFoundError("Hábito");
}

export async function toggleHabit(userId: string, habitId: string, date: ISODate): Promise<{ checked: boolean; checkId: string | null }> {
  const habit = await db.habit.findFirst({ where: { id: habitId, userId } });
  if (!habit) throw new NotFoundError("Hábito");
  const existing = await db.habitCheck.findUnique({ where: { habitId_date: { habitId, date: toDbDate(date) } } });
  if (existing) {
    await db.habitCheck.delete({ where: { id: existing.id } });
    return { checked: false, checkId: null };
  }
  const check = await db.habitCheck.create({ data: { habitId, date: toDbDate(date) } });
  return { checked: true, checkId: check.id };
}

// ─────────────────────────────────────────────────────────────
// Séries para gráficos
// ─────────────────────────────────────────────────────────────

export interface Series {
  label: string;
  points: { x: ISODate; y: number | null }[];
}

export async function workoutsPerWeek(userId: string, from: ISODate, to: ISODate, timeZone: string) {
  const rows = await db.$queryRaw<{ day: Date }[]>`
    SELECT ("startedAt" AT TIME ZONE ${timeZone})::date AS day FROM "workout_session"
    WHERE "userId" = ${userId} AND status = 'COMPLETED'
      AND ("startedAt" AT TIME ZONE ${timeZone})::date BETWEEN ${toDbDate(from)}::date AND ${toDbDate(to)}::date`;
  const weeks = new Map<ISODate, number>();
  for (let w = startOfWeek(from); w <= to; w = addDays(w, 7)) weeks.set(w, 0);
  for (const r of rows) {
    const w = startOfWeek(r.day.toISOString().slice(0, 10));
    weeks.set(w, (weeks.get(w) ?? 0) + 1);
  }
  return [...weeks.entries()].map(([x, y]) => ({ x, y }));
}

export async function mealConsistency(userId: string, from: ISODate, to: ISODate) {
  const meals = await db.plannedMeal.findMany({
    where: { plan: { userId, status: "ACTIVE" }, date: { gte: toDbDate(from), lte: toDbDate(to) }, isFlexible: false },
    select: { date: true, completedAt: true },
  });
  const map = new Map<ISODate, { planned: number; done: number }>();
  for (const d of rangeDates(from, to)) map.set(d, { planned: 0, done: 0 });
  for (const m of meals) {
    const k = m.date.toISOString().slice(0, 10);
    const v = map.get(k) ?? { planned: 0, done: 0 };
    v.planned += 1;
    if (m.completedAt) v.done += 1;
    map.set(k, v);
  }
  return [...map.entries()].map(([date, v]) => ({ date, ...v }));
}

export async function spendingByList(userId: string, from: ISODate, to: ISODate) {
  const lists = await db.shoppingList.findMany({
    where: { userId, createdAt: { gte: toDbDate(from), lte: toDbDate(addDays(to, 1)) } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });
  return lists.map((l) => {
    const paid = l.items.reduce((acc, i) => acc + (i.purchased && i.paidCents ? i.paidCents : 0), 0);
    const estimated = l.items.reduce((acc, i) => acc + (itemLine(i).purchaseCents ?? 0), 0);
    return {
      id: l.id,
      date: l.createdAt.toISOString().slice(0, 10),
      title: l.title,
      status: l.status,
      paidCents: paid,
      estimatedCents: estimated,
      budgetCents: l.budgetCents,
    };
  });
}
