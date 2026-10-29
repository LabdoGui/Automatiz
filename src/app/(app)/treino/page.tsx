import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CalendarDays, Dumbbell, History, PlayCircle, Settings2, ShieldAlert, Sparkles } from "lucide-react";
import { weekdayIndex, WEEKDAY_SHORT } from "@/domain/dates";
import { formatDateLong, formatInt } from "@/domain/format";
import { MUSCLE_GROUP_LABEL, MUSCLE_GROUPS, sessionDurationSeconds, setVolume } from "@/domain/training/training";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionForm, FormMessage } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/fields";
import { cn } from "@/components/ui/cn";
import { clockFor, requireOnboardedUser } from "@/server/session";
import { getActiveRoutine, openSession, sessionHistory } from "@/server/services/training";
import { startWorkoutAction, suggestRoutineAction } from "@/server/actions/training";

export const metadata: Metadata = { title: "Treino" };

export default async function TrainingPage() {
  const { user, settings, profile } = await requireOnboardedUser();
  const { today } = clockFor(settings);
  const [routine, session, recent] = await Promise.all([getActiveRoutine(user.id), openSession(user.id), sessionHistory(user.id, 3)]);
  const weekday = weekdayIndex(today);

  return (
    <>
      <PageHeader
        eyebrow="Treino"
        title={routine ? routine.name : "Sua rotina"}
        description={routine ? "Treinos da semana. Descanso entre os dias também é parte do plano." : "Monte uma rotina sugerida pelo VIVA ou crie a sua."}
        actions={
          <LinkButton href="/treino/rotina" variant="secondary" size="sm">
            <Settings2 className="h-4 w-4" aria-hidden /> Editar
          </LinkButton>
        }
      />

      {session && (
        <Link href={`/treino/sessao/${session.id}`} className="mb-6 flex items-center gap-4 rounded-[2rem] bg-lime p-5 text-lime-ink">
          <PlayCircle className="h-10 w-10 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-lime-ink/70">{session.status === "PAUSED" ? "Treino pausado" : "Treino em andamento"}</p>
            <p className="font-display text-xl font-extrabold">{session.title}</p>
          </div>
          <span className="font-semibold">Continuar</span>
        </Link>
      )}

      {!routine ? (
        <EmptyState
          icon={<Dumbbell className="h-6 w-6" aria-hidden />}
          title="Nenhuma rotina ativa"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ActionForm action={suggestRoutineAction}>
                <SubmitButton pendingLabel="Montando…">
                  <Sparkles className="h-4 w-4" aria-hidden /> Sugerir rotina pelo meu perfil
                </SubmitButton>
              </ActionForm>
              <LinkButton href="/treino/rotina" variant="secondary">
                Criar do zero
              </LinkButton>
            </div>
          }
        >
          {profile.trainingWeekdays.length
            ? `Vamos considerar seus ${profile.trainingWeekdays.length} dias de treino, nível e equipamentos.`
            : "Informe seus dias de treino no perfil para uma sugestão mais adequada."}
        </EmptyState>
      ) : (
        <section aria-labelledby="treinos" className="mb-10">
          <h2 id="treinos" className="sr-only">
            Treinos da rotina
          </h2>
          <ol className="grid gap-3 md:grid-cols-2">
            {routine.workouts.map((w) => {
              const isToday = w.weekdays.includes(weekday);
              return (
                <li
                  key={w.id}
                  className={cn(
                    "flex flex-col rounded-[2rem] border p-5",
                    isToday ? "grain relative overflow-hidden border-lime/50 bg-lime-soft" : "border-line bg-surface",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <span className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-2xl font-display text-2xl font-extrabold", isToday ? "bg-lime text-lime-ink" : "bg-surface-2")}>
                      {w.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg leading-tight font-bold">{w.name}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
                        <CalendarDays className="h-4 w-4" aria-hidden />
                        {w.weekdays.length ? w.weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ") : "sem dia fixo"}
                        {isToday && <strong className="text-lime-text"> · hoje</strong>}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-1.5 text-sm">
                    {w.exercises.map((e) => (
                      <li key={e.id} className="flex justify-between gap-3">
                        <Link href={`/treino/exercicios/${e.exercise.slug}`} className="hover:underline">
                          {e.exercise.name}
                        </Link>
                        <span className="shrink-0 text-ink-2 tabular">
                          {e.sets}×{e.repsMin === e.repsMax ? e.repsMin : `${e.repsMin}–${e.repsMax}`}
                        </span>
                      </li>
                    ))}
                    {w.exercises.length === 0 && <li className="text-ink-3">Nenhum exercício ainda.</li>}
                  </ul>
                  <div className="mt-auto pt-5">
                    <ActionForm action={startWorkoutAction}>
                      <input type="hidden" name="workoutId" value={w.id} />
                      <SubmitButton variant={isToday ? "primary" : "secondary"} block disabled={Boolean(session) || w.exercises.length === 0} pendingLabel="Preparando…">
                        <PlayCircle className="h-4 w-4" aria-hidden /> Começar treino {w.label}
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </li>
              );
            })}
          </ol>
          {!session && (
            <ActionForm action={startWorkoutAction} className="mt-3">
              <input type="hidden" name="workoutId" value="" />
              <SubmitButton variant="ghost" size="sm" pendingLabel="Preparando…">
                Fazer um treino livre
              </SubmitButton>
            </ActionForm>
          )}
          {routine.notes && <FormMessage className="mt-4">{routine.notes}</FormMessage>}
        </section>
      )}

      <section aria-labelledby="catalogo" className="mb-10">
        <SectionTitle
          id="catalogo"
          action={
            <Link href="/treino/exercicios" className="text-sm font-semibold text-lime-text hover:underline">
              Ver todos
            </Link>
          }
        >
          <span className="inline-flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-ink-2" aria-hidden /> Exercícios por grupo
          </span>
        </SectionTitle>
        <nav aria-label="Grupos musculares" className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((g) => (
            <Link key={g} href={`/treino/exercicios?grupo=${g}`} className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold hover:border-lime hover:bg-lime-soft">
              {MUSCLE_GROUP_LABEL[g]}
            </Link>
          ))}
        </nav>
      </section>

      <section aria-labelledby="recentes" className="mb-10">
        <SectionTitle
          id="recentes"
          action={
            <Link href="/treino/historico" className="text-sm font-semibold text-lime-text hover:underline">
              Histórico completo
            </Link>
          }
        >
          <span className="inline-flex items-center gap-2">
            <History className="h-5 w-5 text-ink-2" aria-hidden /> Últimos treinos
          </span>
        </SectionTitle>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-2">Seus treinos concluídos aparecem aqui.</p>
        ) : (
          <ul className="divide-y divide-line rounded-3xl border border-line">
            {recent.map((s) => {
              const sets = s.exercises.flatMap((e) => e.sets);
              return (
                <li key={s.id}>
                  <Link href={`/treino/historico/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{s.title}</p>
                      <p className="text-sm text-ink-2">
                        {formatDateLong(s.startedAt.toISOString().slice(0, 10))} · {Math.round(sessionDurationSeconds(s) / 60)} min · {sets.filter((x) => x.completed).length} séries
                      </p>
                    </div>
                    <span className="text-sm text-ink-2 tabular">{formatInt(setVolume(sets))} kg</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside className="flex gap-3 rounded-3xl border border-amber/30 bg-amber-soft p-4 text-sm">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-text" aria-hidden />
        <p>
          As rotinas do VIVA são educativas e não substituem um profissional de educação física. Interrompa o exercício em caso
          de dor aguda, tontura, falta de ar fora do normal ou dor no peito, e procure atendimento.
        </p>
      </aside>
    </>
  );
}
