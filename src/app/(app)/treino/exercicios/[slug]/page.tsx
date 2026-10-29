import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, Lightbulb, Plus, ShieldAlert, Timer, TrendingUp, TriangleAlert } from "lucide-react";
import { MUSCLE_GROUP_LABEL } from "@/domain/training/training";
import { DIFFICULTY_LABEL } from "@/lib/labels";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { ActionForm, FormMessage } from "@/components/forms/action-form";
import { NumberField, SelectField, SubmitButton } from "@/components/forms/fields";
import { BodyMap } from "@/components/training/body-map";
import { LineChart } from "@/components/charts/line-chart";
import { clockFor, requireOnboardedUser } from "@/server/session";
import { localDate } from "@/domain/dates";
import { db } from "@/server/db";
import { adviceFor, exerciseProgress, getActiveRoutine, getExercise, parseRepsRange } from "@/server/services/training";
import { addTemplateExerciseAction } from "@/server/actions/training";
import { equipmentText } from "@/components/training/equipment";

export const metadata: Metadata = { title: "Exercício" };

export default async function ExercisePage({ params }: { params: Promise<{ slug: string }> }) {
  const { user, settings } = await requireOnboardedUser();
  const { tz } = clockFor(settings);
  const { slug } = await params;
  const exercise = await getExercise(slug);
  if (!exercise) notFound();
  const reps = parseRepsRange(exercise.repsSuggested);
  const [routine, progress, advice, alternatives] = await Promise.all([
    getActiveRoutine(user.id),
    exerciseProgress(user.id, exercise.id),
    adviceFor(user.id, exercise.id, reps.max),
    db.exercise.findMany({ where: { slug: { in: exercise.alternatives } }, select: { slug: true, name: true } }),
  ]);
  const byDay = new Map<string, number>();
  for (const p of progress) {
    if (p.maxWeight === null) continue;
    const day = localDate(p.date, tz);
    byDay.set(day, Math.max(byDay.get(day) ?? 0, p.maxWeight));
  }
  const weightPoints = [...byDay].map(([x, y]) => ({ x, y }));

  return (
    <>
      <PageHeader
        backHref={`/treino/exercicios?grupo=${exercise.primaryGroup}`}
        backLabel={MUSCLE_GROUP_LABEL[exercise.primaryGroup]}
        eyebrow={MUSCLE_GROUP_LABEL[exercise.primaryGroup]}
        title={exercise.name}
        description={exercise.secondaryMuscles.length ? `Também trabalha: ${exercise.secondaryMuscles.join(", ")}.` : undefined}
      />
      <div className="grid gap-10 lg:grid-cols-[1fr_18rem] [&>*]:min-w-0">
        <div className="min-w-0">
          <dl className="mb-8 grid grid-cols-3 gap-3 rounded-3xl border border-line p-4 text-center">
            <div>
              <dt className="text-xs text-ink-3">Séries</dt>
              <dd className="font-display text-2xl font-extrabold">{exercise.setsSuggested}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Repetições</dt>
              <dd className="font-display text-2xl font-extrabold">{exercise.repsSuggested}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Descanso</dt>
              <dd className="font-display text-2xl font-extrabold">{exercise.restSeconds}s</dd>
            </div>
          </dl>

          <section aria-labelledby="passos" className="mb-8">
            <SectionTitle id="passos">Como fazer</SectionTitle>
            <ol className="flex flex-col gap-4">
              {exercise.steps.map((s, i) => (
                <li key={i} className="flex gap-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime font-display font-extrabold text-lime-ink">{i + 1}</span>
                  <p className="pt-1.5">{s}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-ink-3">Não há vídeo de demonstração para este exercício. Se tiver dúvidas sobre a execução, peça ajuda a um profissional na academia.</p>
          </section>

          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <section aria-labelledby="dicas" className="rounded-3xl bg-lime-soft p-5">
              <h2 id="dicas" className="mb-3 flex items-center gap-2 font-bold text-lime-text">
                <Lightbulb className="h-4 w-4" aria-hidden /> Dicas de execução
              </h2>
              <ul className="list-disc space-y-1.5 pl-5 text-sm">
                {exercise.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="erros" className="rounded-3xl bg-coral-soft p-5">
              <h2 id="erros" className="mb-3 flex items-center gap-2 font-bold text-coral-text">
                <CircleAlert className="h-4 w-4" aria-hidden /> Erros comuns
              </h2>
              <ul className="list-disc space-y-1.5 pl-5 text-sm">
                {exercise.mistakes.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          </div>

          <section aria-labelledby="seguranca" className="mb-8 flex gap-3 rounded-3xl border border-amber/30 bg-amber-soft p-5 text-sm">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-text" aria-hidden />
            <div>
              <h2 id="seguranca" className="font-bold">
                Segurança
              </h2>
              <ul className="mt-1.5 list-disc space-y-1 pl-5">
                {exercise.safety.map((s) => (
                  <li key={s}>{s}</li>
                ))}
                <li>Pare imediatamente em caso de dor aguda, tontura, falta de ar fora do normal ou dor no peito.</li>
              </ul>
            </div>
          </section>

          <section aria-labelledby="evolucao">
            <SectionTitle id="evolucao">
              <span className="inline-flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-ink-2" aria-hidden /> Sua evolução
              </span>
            </SectionTitle>
            {weightPoints.length >= 2 ? (
              <LineChart points={weightPoints} label={`Carga máxima por sessão em ${exercise.name}`} unit="kg" format="dec" />
            ) : (
              <p className="text-sm text-ink-2">
                {progress.length === 0 ? "Registre este exercício em um treino para acompanhar suas cargas." : "Mais um registro e o gráfico de carga aparece aqui."}
              </p>
            )}
            {advice.kind !== "no-data" && (
              <FormMessage tone={advice.kind === "caution" ? "warning" : "info"} className="mt-4">
                {advice.message}
              </FormMessage>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center gap-4 rounded-3xl border border-line p-4">
            <BodyMap group={exercise.primaryGroup} className="h-32" />
            <div className="text-sm">
              <Badge tone={exercise.difficulty === "BEGINNER" ? "lime" : exercise.difficulty === "INTERMEDIATE" ? "sky" : "coral"}>{DIFFICULTY_LABEL[exercise.difficulty]}</Badge>
              <p className="mt-2 font-semibold">Equipamento</p>
              <p className="text-ink-2">{equipmentText(exercise.equipment)}</p>
            </div>
          </div>
          {alternatives.length > 0 && (
            <div className="rounded-3xl border border-line p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-bold">
                <TriangleAlert className="h-4 w-4 text-ink-3" aria-hidden /> Sem o equipamento? Alternativas
              </p>
              <ul className="space-y-1.5 text-sm">
                {alternatives.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/treino/exercicios/${a.slug}`} className="font-semibold text-lime-text hover:underline">
                      {a.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {routine && routine.workouts.length > 0 && (
            <Dialog
              title="Adicionar a um treino"
              description={`Na rotina “${routine.name}”.`}
              trigger={
                <>
                  <Plus className="h-4 w-4" aria-hidden /> Adicionar a um treino
                </>
              }
              triggerVariant="primary"
            >
              <ActionForm action={addTemplateExerciseAction} closeDialogOnSuccess className="flex flex-col gap-4">
                <input type="hidden" name="exerciseId" value={exercise.id} />
                <SelectField name="workoutId" label="Treino">
                  {routine.workouts.map((w) => (
                    <option key={w.id} value={w.id}>
                      Treino {w.label} — {w.name}
                    </option>
                  ))}
                </SelectField>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField name="sets" label="Séries" defaultValue={String(exercise.setsSuggested)} />
                  <NumberField name="restSeconds" label="Descanso" suffix="s" defaultValue={String(exercise.restSeconds)} />
                  <NumberField name="repsMin" label="Reps mín." defaultValue={String(reps.min)} />
                  <NumberField name="repsMax" label="Reps máx." defaultValue={String(reps.max)} />
                </div>
                {reps.seconds && <p className="text-xs text-ink-3">Este exercício é medido em segundos: use as “reps” como segundos.</p>}
                <SubmitButton block>Adicionar</SubmitButton>
              </ActionForm>
            </Dialog>
          )}
          <p className="flex items-center gap-2 text-xs text-ink-3">
            <Timer className="h-3.5 w-3.5" aria-hidden /> Sugestões educativas para iniciantes e intermediários.
          </p>
        </aside>
      </div>
    </>
  );
}
