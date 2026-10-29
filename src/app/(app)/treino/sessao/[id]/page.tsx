import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MUSCLE_GROUP_LABEL } from "@/domain/training/training";
import { SessionPlayer, type SessionView } from "@/components/training/session-player";
import { nowMs } from "@/lib/clock";
import { requireOnboardedUser } from "@/server/session";
import { NotFoundError } from "@/server/action-utils";
import { exerciseCatalog, getSession } from "@/server/services/training";

export const metadata: Metadata = { title: "Treino em andamento" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireOnboardedUser();
  const { id } = await params;
  let session;
  try {
    session = await getSession(user.id, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  if (session.status === "COMPLETED") {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-2xl font-extrabold">Treino finalizado</p>
        <Link href={`/treino/historico/${session.id}`} className="mt-3 inline-block font-semibold text-lime-text hover:underline">
          Ver o registro
        </Link>
      </div>
    );
  }
  if (session.status === "CANCELLED") notFound();
  const catalog = await exerciseCatalog();
  const view: SessionView = {
    id: session.id,
    title: session.title,
    status: session.status as "IN_PROGRESS" | "PAUSED",
    startedAt: session.startedAt.toISOString(),
    pausedAt: session.pausedAt?.toISOString() ?? null,
    pausedSeconds: session.pausedSeconds,
    exercises: session.exercises.map((e) => ({
      id: e.id,
      slug: e.exercise.slug,
      name: e.exercise.name,
      restSeconds: e.restSeconds,
      completed: Boolean(e.completedAt),
      steps: e.exercise.steps,
      tips: e.exercise.tips,
      safety: e.exercise.safety,
      sets: e.sets.map((s) => ({
        id: s.id,
        setNumber: s.setNumber,
        targetRepsMin: s.targetRepsMin,
        targetRepsMax: s.targetRepsMax,
        reps: s.reps,
        weightKg: s.weightKg,
        completed: s.completed,
      })),
    })),
  };
  return (
    <SessionPlayer
      session={view}
      serverNow={nowMs()}
      catalog={catalog.map((c) => ({ id: c.id, name: c.name, group: MUSCLE_GROUP_LABEL[c.primaryGroup] }))}
    />
  );
}
