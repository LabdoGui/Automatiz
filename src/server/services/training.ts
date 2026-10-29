import "server-only";
import type { MuscleGroup, Prisma } from "@/generated/prisma/client";
import { equipmentSatisfied } from "@/domain/planner/generator";
import { TRAINING_EQUIPMENT } from "@/domain/restrictions/vocabulary";
import {
  assignWeekdays,
  maxWeight,
  progressionAdvice,
  setVolume,
  suggestSplit,
  type ProgressionAdvice,
} from "@/domain/training/training";
import { db } from "../db";
import { NotFoundError, UserFacingError } from "../action-utils";

const DIFFICULTY_ORDER = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 } as const;

/** Extrai a faixa de repetições sugerida ("8–12", "20–45 s", "Até 8"). */
export function parseRepsRange(text: string): { min: number; max: number; seconds: boolean } {
  const nums = text.match(/\d+/g)?.map(Number) ?? [];
  const seconds = /\bs\b/.test(text);
  if (nums.length >= 2) return { min: nums[0], max: nums[1], seconds };
  if (nums.length === 1) return { min: Math.min(nums[0], /até/i.test(text) ? 1 : nums[0]), max: nums[0], seconds };
  return { min: 8, max: 12, seconds };
}

export async function exerciseCatalog(group?: MuscleGroup) {
  return db.exercise.findMany({
    where: group ? { primaryGroup: group } : undefined,
    orderBy: [{ primaryGroup: "asc" }, { difficulty: "asc" }, { name: "asc" }],
  });
}

export async function getExercise(slug: string) {
  return db.exercise.findUnique({ where: { slug } });
}

const ROUTINE_INCLUDE = {
  workouts: {
    orderBy: { position: "asc" },
    include: { exercises: { orderBy: { position: "asc" }, include: { exercise: true } } },
  },
} satisfies Prisma.WorkoutRoutineInclude;

export type RoutineFull = Prisma.WorkoutRoutineGetPayload<{ include: typeof ROUTINE_INCLUDE }>;

export async function getActiveRoutine(userId: string): Promise<RoutineFull | null> {
  return db.workoutRoutine.findFirst({ where: { userId, active: true }, include: ROUTINE_INCLUDE, orderBy: { updatedAt: "desc" } });
}

export async function listRoutines(userId: string) {
  return db.workoutRoutine.findMany({ where: { userId }, include: { _count: { select: { workouts: true } } }, orderBy: { updatedAt: "desc" } });
}

/** Rotina educativa sugerida a partir do perfil (frequência, nível, local e equipamentos). */
export async function createSuggestedRoutine(userId: string) {
  const profile = await db.profile.findUnique({ where: { userId } });
  const weekdays = profile?.trainingWeekdays?.length ? profile.trainingWeekdays : [0, 2, 4];
  const level = profile?.experienceLevel ?? "BEGINNER";
  const split = suggestSplit(weekdays.length, level);
  const days = assignWeekdays(split.length, weekdays);
  const available =
    profile?.trainingLocation === "GYM"
      ? TRAINING_EQUIPMENT.map((e) => e.tag)
      : [...new Set(["peso-corporal", ...(profile?.trainingEquipment ?? [])])];

  const catalog = await db.exercise.findMany();
  const feasible = catalog
    .filter((e) => equipmentSatisfied(e.equipment, available))
    .filter((e) => DIFFICULTY_ORDER[e.difficulty] <= DIFFICULTY_ORDER[level] + (level === "BEGINNER" ? 0 : 1))
    .sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty] || a.name.localeCompare(b.name));

  const used = new Set<string>();
  const routine = await db.$transaction(async (tx) => {
    await tx.workoutRoutine.updateMany({ where: { userId, active: true }, data: { active: false } });
    return tx.workoutRoutine.create({
      data: {
        userId,
        name: split.length === 2 && split[0].name.startsWith("Corpo") ? "Corpo inteiro A/B" : `Divisão ${split.map((s) => s.label).join("")}`,
        notes: "Rotina educativa sugerida pelo VIVA a partir do seu perfil. Ajuste com um profissional de educação física sempre que possível.",
      },
    });
  });

  for (const [i, w] of split.entries()) {
    const picks: typeof catalog = [];
    for (const group of w.groups) {
      const options = feasible.filter((e) => e.primaryGroup === group && !used.has(e.id));
      const count = ["LEGS", "BACK", "CHEST"].includes(group) && w.groups.length <= 4 ? 2 : 1;
      for (const e of options.slice(0, count)) {
        picks.push(e);
        used.add(e.id);
      }
    }
    // Garante pelo menos 3 exercícios mesmo com poucos equipamentos.
    if (picks.length < 3) {
      for (const e of feasible.filter((x) => !picks.includes(x) && (x.primaryGroup === "FULL_BODY" || x.primaryGroup === "ABS"))) {
        picks.push(e);
        if (picks.length >= 4) break;
      }
    }
    await db.workoutTemplate.create({
      data: {
        routineId: routine.id,
        label: w.label,
        name: w.name,
        weekdays: days[i] ?? [],
        position: i,
        exercises: {
          create: picks.map((e, position) => {
            const reps = parseRepsRange(e.repsSuggested);
            return {
              exerciseId: e.id,
              position,
              sets: e.setsSuggested,
              repsMin: reps.min,
              repsMax: reps.max,
              restSeconds: e.restSeconds,
              notes: reps.seconds ? "Tempo em segundos por série." : null,
            };
          }),
        },
      },
    });
  }
  return routine;
}

async function ownedRoutine(userId: string, routineId: string) {
  const r = await db.workoutRoutine.findFirst({ where: { id: routineId, userId } });
  if (!r) throw new NotFoundError("Rotina");
  return r;
}

async function ownedWorkout(userId: string, workoutId: string) {
  const w = await db.workoutTemplate.findFirst({ where: { id: workoutId, routine: { userId } }, include: { exercises: true } });
  if (!w) throw new NotFoundError("Treino");
  return w;
}

export async function createRoutine(userId: string, name: string) {
  const count = await db.workoutRoutine.count({ where: { userId } });
  if (count >= 20) throw new UserFacingError("Limite de 20 rotinas atingido.");
  return db.$transaction(async (tx) => {
    await tx.workoutRoutine.updateMany({ where: { userId, active: true }, data: { active: false } });
    return tx.workoutRoutine.create({ data: { userId, name } });
  });
}

export async function activateRoutine(userId: string, routineId: string) {
  await ownedRoutine(userId, routineId);
  await db.$transaction([
    db.workoutRoutine.updateMany({ where: { userId, active: true }, data: { active: false } }),
    db.workoutRoutine.update({ where: { id: routineId }, data: { active: true } }),
  ]);
}

export async function deleteRoutine(userId: string, routineId: string) {
  await ownedRoutine(userId, routineId);
  await db.workoutRoutine.delete({ where: { id: routineId } });
}

export async function upsertWorkout(
  userId: string,
  data: { routineId: string; workoutId: string | null; label: string; name: string; weekdays: number[] },
) {
  await ownedRoutine(userId, data.routineId);
  if (data.workoutId) {
    await ownedWorkout(userId, data.workoutId);
    return db.workoutTemplate.update({
      where: { id: data.workoutId },
      data: { label: data.label, name: data.name, weekdays: data.weekdays },
    });
  }
  const count = await db.workoutTemplate.count({ where: { routineId: data.routineId } });
  if (count >= 7) throw new UserFacingError("Uma rotina pode ter até 7 treinos.");
  return db.workoutTemplate.create({
    data: { routineId: data.routineId, label: data.label, name: data.name, weekdays: data.weekdays, position: count },
  });
}

export async function deleteWorkout(userId: string, workoutId: string) {
  await ownedWorkout(userId, workoutId);
  await db.workoutTemplate.delete({ where: { id: workoutId } });
}

export async function addTemplateExercise(
  userId: string,
  data: { workoutId: string; exerciseId: string; sets: number; repsMin: number; repsMax: number; restSeconds: number },
) {
  const w = await ownedWorkout(userId, data.workoutId);
  if (w.exercises.length >= 15) throw new UserFacingError("Um treino pode ter até 15 exercícios.");
  const exercise = await db.exercise.findUnique({ where: { id: data.exerciseId } });
  if (!exercise) throw new NotFoundError("Exercício");
  if (data.repsMin > data.repsMax) throw new UserFacingError("O mínimo de repetições não pode ser maior que o máximo.");
  return db.workoutTemplateExercise.create({
    data: { templateId: w.id, exerciseId: exercise.id, sets: data.sets, repsMin: data.repsMin, repsMax: data.repsMax, restSeconds: data.restSeconds, position: w.exercises.length },
  });
}

export async function updateTemplateExercise(
  userId: string,
  id: string,
  data: { sets: number; repsMin: number; repsMax: number; restSeconds: number; notes: string | null },
) {
  const item = await db.workoutTemplateExercise.findFirst({ where: { id, template: { routine: { userId } } } });
  if (!item) throw new NotFoundError("Exercício");
  if (data.repsMin > data.repsMax) throw new UserFacingError("O mínimo de repetições não pode ser maior que o máximo.");
  return db.workoutTemplateExercise.update({ where: { id }, data });
}

export async function removeTemplateExercise(userId: string, id: string) {
  const res = await db.workoutTemplateExercise.deleteMany({ where: { id, template: { routine: { userId } } } });
  if (res.count === 0) throw new NotFoundError("Exercício");
}

export async function moveTemplateExercise(userId: string, id: string, direction: "up" | "down") {
  const item = await db.workoutTemplateExercise.findFirst({ where: { id, template: { routine: { userId } } } });
  if (!item) throw new NotFoundError("Exercício");
  const siblings = await db.workoutTemplateExercise.findMany({ where: { templateId: item.templateId }, orderBy: { position: "asc" } });
  const index = siblings.findIndex((s) => s.id === id);
  const swapWith = siblings[direction === "up" ? index - 1 : index + 1];
  if (!swapWith) return;
  await db.$transaction(
    siblings.map((s, i) => {
      let position = i;
      if (s.id === item.id) position = direction === "up" ? index - 1 : index + 1;
      else if (s.id === swapWith.id) position = index;
      return db.workoutTemplateExercise.update({ where: { id: s.id }, data: { position } });
    }),
  );
}

// ─────────────────────────────────────────────────────────────
// Sessões
// ─────────────────────────────────────────────────────────────

const SESSION_INCLUDE = {
  exercises: {
    orderBy: { position: "asc" },
    include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } },
  },
  template: { select: { id: true, label: true, name: true } },
} satisfies Prisma.WorkoutSessionInclude;

export type SessionFull = Prisma.WorkoutSessionGetPayload<{ include: typeof SESSION_INCLUDE }>;

export async function openSession(userId: string) {
  return db.workoutSession.findFirst({
    where: { userId, status: { in: ["IN_PROGRESS", "PAUSED"] } },
    include: SESSION_INCLUDE,
    orderBy: { startedAt: "desc" },
  });
}

async function lastWeightFor(userId: string, exerciseId: string): Promise<number | null> {
  const last = await db.setLog.findFirst({
    where: { completed: true, weightKg: { not: null }, sessionExercise: { exerciseId, session: { userId, status: "COMPLETED" } } },
    orderBy: { completedAt: "desc" },
  });
  return last?.weightKg ?? null;
}

export async function startSession(userId: string, workoutId: string | null) {
  const existing = await openSession(userId);
  if (existing) return existing;
  let title = "Treino livre";
  let plan: { exerciseId: string; sets: number; repsMin: number; repsMax: number; restSeconds: number }[] = [];
  if (workoutId) {
    const w = await db.workoutTemplate.findFirst({
      where: { id: workoutId, routine: { userId } },
      include: { exercises: { orderBy: { position: "asc" } } },
    });
    if (!w) throw new NotFoundError("Treino");
    title = `Treino ${w.label} · ${w.name}`;
    plan = w.exercises;
  }
  const session = await db.workoutSession.create({ data: { userId, templateId: workoutId, title } });
  for (const [position, p] of plan.entries()) {
    const weight = await lastWeightFor(userId, p.exerciseId);
    await db.sessionExercise.create({
      data: {
        sessionId: session.id,
        exerciseId: p.exerciseId,
        position,
        restSeconds: p.restSeconds,
        sets: {
          create: Array.from({ length: p.sets }, (_, i) => ({
            setNumber: i + 1,
            targetRepsMin: p.repsMin,
            targetRepsMax: p.repsMax,
            weightKg: weight,
          })),
        },
      },
    });
  }
  return getSession(userId, session.id);
}

export async function getSession(userId: string, sessionId: string): Promise<SessionFull> {
  const s = await db.workoutSession.findFirst({ where: { id: sessionId, userId }, include: SESSION_INCLUDE });
  if (!s) throw new NotFoundError("Sessão");
  return s;
}

async function ownedOpenSessionExercise(userId: string, sessionExerciseId: string) {
  const se = await db.sessionExercise.findFirst({
    where: { id: sessionExerciseId, session: { userId, status: { in: ["IN_PROGRESS", "PAUSED"] } } },
    include: { sets: { orderBy: { setNumber: "asc" } } },
  });
  if (!se) throw new NotFoundError("Exercício da sessão");
  return se;
}

export async function addExerciseToSession(userId: string, sessionId: string, exerciseId: string) {
  const session = await db.workoutSession.findFirst({
    where: { id: sessionId, userId, status: { in: ["IN_PROGRESS", "PAUSED"] } },
    include: { exercises: true },
  });
  if (!session) throw new NotFoundError("Sessão");
  const exercise = await db.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) throw new NotFoundError("Exercício");
  const reps = parseRepsRange(exercise.repsSuggested);
  const weight = await lastWeightFor(userId, exercise.id);
  return db.sessionExercise.create({
    data: {
      sessionId: session.id,
      exerciseId: exercise.id,
      position: session.exercises.length,
      restSeconds: exercise.restSeconds,
      sets: {
        create: Array.from({ length: exercise.setsSuggested }, (_, i) => ({
          setNumber: i + 1,
          targetRepsMin: reps.min,
          targetRepsMax: reps.max,
          weightKg: weight,
        })),
      },
    },
  });
}

export async function logSet(userId: string, setId: string, data: { reps: number | null; weightKg: number | null; completed: boolean }) {
  const set = await db.setLog.findFirst({
    where: { id: setId, sessionExercise: { session: { userId, status: { in: ["IN_PROGRESS", "PAUSED"] } } } },
  });
  if (!set) throw new NotFoundError("Série");
  return db.setLog.update({
    where: { id: set.id },
    data: { reps: data.reps, weightKg: data.weightKg, completed: data.completed, completedAt: data.completed ? new Date() : null },
  });
}

export async function addSet(userId: string, sessionExerciseId: string) {
  const se = await ownedOpenSessionExercise(userId, sessionExerciseId);
  if (se.sets.length >= 12) throw new UserFacingError("Limite de 12 séries por exercício.");
  const last = se.sets.at(-1);
  return db.setLog.create({
    data: {
      sessionExerciseId: se.id,
      setNumber: (last?.setNumber ?? 0) + 1,
      targetRepsMin: last?.targetRepsMin ?? 8,
      targetRepsMax: last?.targetRepsMax ?? 12,
      weightKg: last?.weightKg ?? null,
    },
  });
}

export async function removeLastSet(userId: string, sessionExerciseId: string) {
  const se = await ownedOpenSessionExercise(userId, sessionExerciseId);
  const last = se.sets.at(-1);
  if (!last || se.sets.length <= 1) throw new UserFacingError("O exercício precisa de pelo menos uma série.");
  await db.setLog.delete({ where: { id: last.id } });
}

export async function setExerciseDone(userId: string, sessionExerciseId: string, done: boolean, notes: string | null) {
  const se = await ownedOpenSessionExercise(userId, sessionExerciseId);
  return db.sessionExercise.update({ where: { id: se.id }, data: { completedAt: done ? new Date() : null, notes } });
}

export async function removeSessionExercise(userId: string, sessionExerciseId: string) {
  const se = await ownedOpenSessionExercise(userId, sessionExerciseId);
  await db.sessionExercise.delete({ where: { id: se.id } });
}

export async function pauseSession(userId: string, sessionId: string) {
  const res = await db.workoutSession.updateMany({
    where: { id: sessionId, userId, status: "IN_PROGRESS" },
    data: { status: "PAUSED", pausedAt: new Date() },
  });
  if (res.count === 0) throw new UserFacingError("A sessão não está em andamento.");
}

export async function resumeSession(userId: string, sessionId: string) {
  const s = await db.workoutSession.findFirst({ where: { id: sessionId, userId, status: "PAUSED" } });
  if (!s || !s.pausedAt) throw new UserFacingError("A sessão não está pausada.");
  const paused = Math.max(0, Math.floor((Date.now() - s.pausedAt.getTime()) / 1000));
  await db.workoutSession.update({
    where: { id: s.id },
    data: { status: "IN_PROGRESS", pausedAt: null, pausedSeconds: { increment: paused } },
  });
}

export async function finishSession(
  userId: string,
  sessionId: string,
  data: { notes: string | null; perceivedEffort: number | null; discomfort: boolean },
) {
  const s = await db.workoutSession.findFirst({
    where: { id: sessionId, userId, status: { in: ["IN_PROGRESS", "PAUSED"] } },
    include: { exercises: { include: { sets: true } } },
  });
  if (!s) throw new UserFacingError("Sessão não encontrada ou já encerrada.");
  const anySet = s.exercises.some((e) => e.sets.some((x) => x.completed));
  if (!anySet) throw new UserFacingError("Marque pelo menos uma série concluída antes de finalizar, ou descarte o treino.");
  const extraPause = s.status === "PAUSED" && s.pausedAt ? Math.floor((Date.now() - s.pausedAt.getTime()) / 1000) : 0;
  await db.workoutSession.update({
    where: { id: s.id },
    data: {
      status: "COMPLETED",
      endedAt: new Date(),
      pausedAt: null,
      pausedSeconds: { increment: extraPause },
      notes: data.notes,
      perceivedEffort: data.perceivedEffort,
      discomfort: data.discomfort,
    },
  });
  return s;
}

export async function cancelSession(userId: string, sessionId: string) {
  const res = await db.workoutSession.deleteMany({ where: { id: sessionId, userId, status: { in: ["IN_PROGRESS", "PAUSED"] } } });
  if (res.count === 0) throw new UserFacingError("Sessão não encontrada.");
}

export async function sessionHistory(userId: string, take = 30) {
  return db.workoutSession.findMany({
    where: { userId, status: "COMPLETED" },
    include: { exercises: { include: { exercise: { select: { name: true, primaryGroup: true } }, sets: true } } },
    orderBy: { startedAt: "desc" },
    take,
  });
}

export async function deleteSession(userId: string, sessionId: string) {
  const res = await db.workoutSession.deleteMany({ where: { id: sessionId, userId } });
  if (res.count === 0) throw new NotFoundError("Sessão");
}

export interface ExercisePoint {
  date: Date;
  maxWeight: number | null;
  volume: number;
  sets: number;
}

export async function exerciseProgress(userId: string, exerciseId: string, take = 20): Promise<ExercisePoint[]> {
  const rows = await db.sessionExercise.findMany({
    where: { exerciseId, session: { userId, status: "COMPLETED" } },
    include: { sets: true, session: { select: { startedAt: true } } },
    orderBy: { session: { startedAt: "desc" } },
    take,
  });
  return rows
    .map((r) => ({
      date: r.session.startedAt,
      maxWeight: maxWeight(r.sets),
      volume: setVolume(r.sets),
      sets: r.sets.filter((s) => s.completed).length,
    }))
    .reverse();
}

export async function adviceFor(userId: string, exerciseId: string, repsMax: number): Promise<ProgressionAdvice> {
  const rows = await db.sessionExercise.findMany({
    where: { exerciseId, session: { userId, status: "COMPLETED" } },
    include: { sets: true, session: { select: { discomfort: true } } },
    orderBy: { session: { startedAt: "desc" } },
    take: 2,
  });
  return progressionAdvice({ lastSessions: rows.map((r) => ({ sets: r.sets, discomfort: r.session.discomfort })), repsMax });
}

export async function trainedExercises(userId: string) {
  const rows = await db.sessionExercise.findMany({
    where: { session: { userId, status: "COMPLETED" } },
    select: { exercise: { select: { id: true, name: true, slug: true } } },
    distinct: ["exerciseId"],
  });
  return rows.map((r) => r.exercise);
}
