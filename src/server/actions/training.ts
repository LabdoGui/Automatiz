"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-types";
import {
  zBool,
  zId,
  zInt,
  zOptionalDecimal,
  zOptionalInt,
  zOptionalText,
  zRequiredText,
  zStringArray,
} from "@/lib/validation";
import { db } from "../db";
import { parseInput, safeAction, UserFacingError } from "../action-utils";
import { requireUser, userTimezone } from "../session";
import * as training from "../services/training";
import { recordActivity } from "../services/gamification";

async function ctx() {
  const user = await requireUser();
  const s = await db.userSettings.findUnique({ where: { userId: user.id }, select: { timezone: true } });
  return { user, tz: userTimezone(s) };
}

function refresh() {
  revalidatePath("/treino", "layout");
  revalidatePath("/inicio");
  revalidatePath("/progresso", "layout");
}

export async function startWorkoutAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  let target: string | null = null;
  const result = await safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ workoutId: z.preprocess((v) => (v === "" ? undefined : v), zId.optional()) }), formData);
    if (!parsed.ok) return parsed.result;
    const session = await training.startSession(user.id, parsed.data.workoutId ?? null);
    target = `/treino/sessao/${session.id}`;
    refresh();
    return { ok: true };
  });
  if (target) redirect(target);
  return result;
}

const setSchema = z.object({
  setId: zId,
  reps: zOptionalInt(0, 500, "as repetições"),
  weightKg: zOptionalDecimal(0, 1000, "a carga"),
  completed: zBool,
});

export async function logSetAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(setSchema, formData);
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    await training.logSet(user.id, d.setId, { reps: d.reps ?? null, weightKg: d.weightKg ?? null, completed: d.completed });
    revalidatePath("/treino/sessao", "layout");
    return { ok: true };
  });
}

export async function addSetAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ sessionExerciseId: zId, remove: zBool }), formData);
    if (!parsed.ok) return parsed.result;
    if (parsed.data.remove) await training.removeLastSet(user.id, parsed.data.sessionExerciseId);
    else await training.addSet(user.id, parsed.data.sessionExerciseId);
    revalidatePath("/treino/sessao", "layout");
    return { ok: true };
  });
}

export async function exerciseDoneAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ sessionExerciseId: zId, done: zBool, notes: zOptionalText(300) }), formData);
    if (!parsed.ok) return parsed.result;
    await training.setExerciseDone(user.id, parsed.data.sessionExerciseId, parsed.data.done, parsed.data.notes ?? null);
    revalidatePath("/treino/sessao", "layout");
    return { ok: true, message: parsed.data.done ? "Exercício finalizado." : "Exercício reaberto." };
  });
}

export async function removeSessionExerciseAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ sessionExerciseId: zId }), formData);
    if (!parsed.ok) return parsed.result;
    await training.removeSessionExercise(user.id, parsed.data.sessionExerciseId);
    revalidatePath("/treino/sessao", "layout");
    return { ok: true, message: "Exercício removido desta sessão." };
  });
}

export async function addSessionExerciseAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ sessionId: zId, exerciseId: z.string().min(1, "Escolha um exercício.").pipe(zId) }), formData);
    if (!parsed.ok) return parsed.result;
    await training.addExerciseToSession(user.id, parsed.data.sessionId, parsed.data.exerciseId);
    revalidatePath("/treino/sessao", "layout");
    return { ok: true, message: "Exercício adicionado." };
  });
}

export async function pauseSessionAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ sessionId: zId, resume: zBool }), formData);
    if (!parsed.ok) return parsed.result;
    if (parsed.data.resume) await training.resumeSession(user.id, parsed.data.sessionId);
    else await training.pauseSession(user.id, parsed.data.sessionId);
    refresh();
    return { ok: true, message: parsed.data.resume ? "Treino retomado." : "Treino pausado." };
  });
}

export async function finishSessionAction(_prev: unknown, formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  return safeAction<{ redirectTo: string }>(async () => {
    const { user, tz } = await ctx();
    const parsed = parseInput(
      z.object({ sessionId: zId, notes: zOptionalText(600), perceivedEffort: zOptionalInt(1, 10, "o esforço percebido"), discomfort: zBool }),
      formData,
    );
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    await training.finishSession(user.id, d.sessionId, {
      notes: d.notes ?? null,
      perceivedEffort: d.perceivedEffort ?? null,
      discomfort: d.discomfort,
    });
    const celebrations = await recordActivity(user.id, [{ kind: "WORKOUT_COMPLETED", refId: d.sessionId }], { timeZone: tz });
    // Sem revalidatePath: ele re-renderizaria a sessão atual (já finalizada) e
    // descartaria o resultado. As rotas são dinâmicas; o destino carrega dados novos.
    // O cliente navega depois de exibir as celebrações (um redirect aqui as descartaria).
    return { ok: true, celebrations, data: { redirectTo: `/treino/historico/${d.sessionId}?concluido=1` } };
  });
}

export async function cancelSessionAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  let done = false;
  const result = await safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ sessionId: zId }), formData);
    if (!parsed.ok) return parsed.result;
    await training.cancelSession(user.id, parsed.data.sessionId);
    refresh();
    done = true;
    return { ok: true };
  });
  if (done) redirect("/treino");
  return result;
}

export async function deleteSessionAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  let done = false;
  const result = await safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ sessionId: zId }), formData);
    if (!parsed.ok) return parsed.result;
    await training.deleteSession(user.id, parsed.data.sessionId);
    refresh();
    done = true;
    return { ok: true };
  });
  if (done) redirect("/treino/historico");
  return result;
}

// ─────────────────────────────────────────────────────────────
// Rotinas
// ─────────────────────────────────────────────────────────────

export async function suggestRoutineAction(_prev: unknown, _formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const count = await db.workoutRoutine.count({ where: { userId: user.id } });
    if (count >= 20) throw new UserFacingError("Limite de 20 rotinas atingido. Exclua uma rotina antiga.");
    await training.createSuggestedRoutine(user.id);
    refresh();
    return { ok: true, message: "Rotina sugerida criada. Ajuste à vontade." };
  });
}

export async function createRoutineAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ name: zRequiredText("o nome da rotina", 60) }), formData);
    if (!parsed.ok) return parsed.result;
    await training.createRoutine(user.id, parsed.data.name);
    refresh();
    return { ok: true, message: "Rotina criada. Adicione os treinos." };
  });
}

export async function routineAdminAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ routineId: zId, op: z.enum(["activate", "delete"]) }), formData);
    if (!parsed.ok) return parsed.result;
    if (parsed.data.op === "activate") await training.activateRoutine(user.id, parsed.data.routineId);
    else await training.deleteRoutine(user.id, parsed.data.routineId);
    refresh();
    return { ok: true, message: parsed.data.op === "activate" ? "Rotina ativada." : "Rotina excluída." };
  });
}

export async function upsertWorkoutAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(
      z.object({
        routineId: zId,
        workoutId: z.preprocess((v) => (v === "" ? undefined : v), zId.optional()),
        label: zRequiredText("a letra do treino", 3),
        name: zRequiredText("o nome do treino", 50),
        weekdays: zStringArray(7).refine((a) => a.every((d) => /^[0-6]$/.test(d)), "Dia inválido."),
      }),
      formData,
    );
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    await training.upsertWorkout(user.id, {
      routineId: d.routineId,
      workoutId: d.workoutId ?? null,
      label: d.label.toUpperCase(),
      name: d.name,
      weekdays: [...new Set(d.weekdays.map(Number))].sort(),
    });
    refresh();
    return { ok: true, message: d.workoutId ? "Treino atualizado." : "Treino adicionado." };
  });
}

export async function deleteWorkoutAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ workoutId: zId }), formData);
    if (!parsed.ok) return parsed.result;
    await training.deleteWorkout(user.id, parsed.data.workoutId);
    refresh();
    return { ok: true, message: "Treino removido da rotina." };
  });
}

const prescriptionFields = {
  sets: zInt(1, 12, "as séries"),
  repsMin: zInt(1, 300, "o mínimo de repetições"),
  repsMax: zInt(1, 300, "o máximo de repetições"),
  restSeconds: zInt(0, 600, "o descanso"),
};

export async function addTemplateExerciseAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ workoutId: zId, exerciseId: z.string().min(1, "Escolha um exercício.").pipe(zId), ...prescriptionFields }), formData);
    if (!parsed.ok) return parsed.result;
    await training.addTemplateExercise(user.id, parsed.data);
    refresh();
    return { ok: true, message: "Exercício adicionado ao treino." };
  });
}

export async function updateTemplateExerciseAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ id: zId, notes: zOptionalText(200), ...prescriptionFields }), formData);
    if (!parsed.ok) return parsed.result;
    const { id, notes, ...rest } = parsed.data;
    await training.updateTemplateExercise(user.id, id, { ...rest, notes: notes ?? null });
    refresh();
    return { ok: true, message: "Exercício atualizado." };
  });
}

export async function templateExerciseOpAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { user } = await ctx();
    const parsed = parseInput(z.object({ id: zId, op: z.enum(["up", "down", "remove"]) }), formData);
    if (!parsed.ok) return parsed.result;
    if (parsed.data.op === "remove") await training.removeTemplateExercise(user.id, parsed.data.id);
    else await training.moveTemplateExercise(user.id, parsed.data.id, parsed.data.op);
    refresh();
    return { ok: true, message: parsed.data.op === "remove" ? "Exercício removido." : undefined };
  });
}
