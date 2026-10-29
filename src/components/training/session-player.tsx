"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  BookOpen,
  Check,
  Minus,
  Pause,
  Play,
  Plus,
  ShieldAlert,
  SkipForward,
  Timer,
  Trash2,
} from "lucide-react";
import {
  addSessionExerciseAction,
  addSetAction,
  cancelSessionAction,
  exerciseDoneAction,
  finishSessionAction,
  logSetAction,
  pauseSessionAction,
  removeSessionExerciseAction,
} from "@/server/actions/training";
import { nowMs } from "@/lib/clock";
import { ActionForm, FormMessage } from "../forms/action-form";
import { SelectField, SubmitButton, TextAreaField } from "../forms/fields";
import { Dialog } from "../ui/dialog";
import { useFeedback } from "../ui/feedback";
import { buttonClasses } from "../ui/button";
import { cn } from "../ui/cn";

export interface SetView {
  id: string;
  setNumber: number;
  targetRepsMin: number;
  targetRepsMax: number;
  reps: number | null;
  weightKg: number | null;
  completed: boolean;
}

export interface SessionExerciseView {
  id: string;
  slug: string;
  name: string;
  restSeconds: number;
  completed: boolean;
  steps: string[];
  tips: string[];
  safety: string[];
  sets: SetView[];
}

export interface SessionView {
  id: string;
  title: string;
  status: "IN_PROGRESS" | "PAUSED";
  startedAt: string;
  pausedAt: string | null;
  pausedSeconds: number;
  exercises: SessionExerciseView[];
}

function fd(entries: Record<string, string | number | boolean | null>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    if (v === null) continue;
    if (typeof v === "boolean") {
      if (v) f.set(k, "on");
    } else f.set(k, String(v));
  }
  return f;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
const hms = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`;
};

function useNow(active: boolean, initial: number) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(nowMs()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

function SetRow({ set, onCompleted }: { set: SetView; onCompleted: () => void }) {
  const [reps, setReps] = useState(set.reps !== null ? String(set.reps) : "");
  const [weight, setWeight] = useState(set.weightKg !== null ? String(set.weightKg).replace(".", ",") : "");
  const [done, setDone] = useState(set.completed);
  const [pending, start] = useTransition();
  const { toast } = useFeedback();

  const save = (completed: boolean) =>
    start(async () => {
      const res = await logSetAction(null, fd({ setId: set.id, reps: reps || null, weightKg: weight || null, completed }));
      if (!res.ok) {
        toast(res.fieldErrors ? Object.values(res.fieldErrors).flat()[0] ?? res.error : res.error, "error");
        setDone(set.completed);
      }
    });

  const target = set.targetRepsMin === set.targetRepsMax ? `${set.targetRepsMin}` : `${set.targetRepsMin}–${set.targetRepsMax}`;
  return (
    <li className={cn("grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 py-2", done && "opacity-70")}>
      <span className="text-center font-display font-bold text-ink-2 tabular">{set.setNumber}</span>
      <label className="relative">
        <span className="sr-only">Repetições da série {set.setNumber}</span>
        <input
          inputMode="numeric"
          value={reps}
          placeholder={target}
          onChange={(e) => setReps(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
          onBlur={() => done && save(true)}
          className="h-12 w-full rounded-xl border border-line bg-surface-2 pr-10 pl-3 text-lg font-semibold tabular"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-3">reps</span>
      </label>
      <label className="relative">
        <span className="sr-only">Carga da série {set.setNumber} em kg</span>
        <input
          inputMode="decimal"
          value={weight}
          placeholder="—"
          onChange={(e) => setWeight(e.target.value.replace(/[^\d,.]/g, "").slice(0, 6))}
          onBlur={() => done && save(true)}
          className="h-12 w-full rounded-xl border border-line bg-surface-2 pr-8 pl-3 text-lg font-semibold tabular"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-3">kg</span>
      </label>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Série ${set.setNumber} ${done ? "concluída" : "pendente"}`}
        disabled={pending}
        onClick={() => {
          const next = !done;
          setDone(next);
          save(next);
          if (next) onCompleted();
        }}
        className={cn(
          "grid h-12 w-12 place-items-center rounded-xl border-2 transition-colors",
          done ? "border-lime bg-lime text-lime-ink" : "border-line-strong text-transparent hover:border-lime",
        )}
      >
        <Check className="h-6 w-6" strokeWidth={3} aria-hidden />
      </button>
    </li>
  );
}

export function SessionPlayer({
  session,
  catalog,
  serverNow,
}: {
  session: SessionView;
  catalog: { id: string; name: string; group: string }[];
  /** Horário do servidor no render, para hidratar o cronômetro sem divergência */
  serverNow: number;
}) {
  const paused = session.status === "PAUSED";
  const now = useNow(!paused, serverNow);
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const restNow = useNow(rest !== null, serverNow);
  const vibrated = useRef(false);
  const [pending, start] = useTransition();
  const { toast } = useFeedback();

  const end = paused && session.pausedAt ? new Date(session.pausedAt).getTime() : now;
  const elapsed = Math.max(0, Math.floor((end - new Date(session.startedAt).getTime()) / 1000) - session.pausedSeconds);
  const restLeft = rest ? Math.ceil((rest.endsAt - restNow) / 1000) : 0;

  useEffect(() => {
    if (rest && restLeft <= 0 && !vibrated.current) {
      vibrated.current = true;
      if ("vibrate" in navigator) navigator.vibrate?.(200);
    }
  }, [rest, restLeft]);

  const startRest = (seconds: number) => {
    vibrated.current = false;
    setRest({ endsAt: nowMs() + seconds * 1000, total: seconds });
  };

  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = session.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);

  const togglePause = () =>
    start(async () => {
      const res = await pauseSessionAction(null, fd({ sessionId: session.id, resume: paused }));
      if (!res.ok) toast(res.error, "error");
    });

  return (
    <div className="pb-24">
      <div className="sticky top-[3.6rem] z-20 -mx-4 mb-5 flex items-center gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-2">{session.title}</p>
          <p className="font-display text-3xl leading-none font-extrabold tabular" aria-live="off">
            {hms(elapsed)}
            {paused && <span className="ml-2 align-middle text-sm font-bold text-amber-text">pausado</span>}
          </p>
        </div>
        <p className="text-right text-sm text-ink-2 tabular">
          <strong className="text-ink">{doneSets}</strong>/{totalSets}
          <span className="block text-xs">séries</span>
        </p>
        <button type="button" onClick={togglePause} disabled={pending} className={buttonClasses({ variant: paused ? "primary" : "secondary", size: "icon" })} aria-label={paused ? "Retomar treino" : "Pausar treino"}>
          {paused ? <Play className="h-5 w-5" aria-hidden /> : <Pause className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      <details className="mb-5 rounded-2xl border border-amber/30 bg-amber-soft px-4 py-3 text-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-amber-text">
          <ShieldAlert className="h-4 w-4" aria-hidden /> Segurança durante o treino
        </summary>
        <p className="mt-2">
          Interrompa imediatamente se sentir dor aguda, dor no peito, tontura, falta de ar fora do normal ou mal-estar. Procure
          atendimento se os sintomas persistirem. Ajuste cargas para manter a técnica.
        </p>
      </details>

      {paused && (
        <FormMessage tone="warning" className="mb-5">
          Treino pausado. O tempo de pausa não conta na duração. Toque em retomar quando quiser.
        </FormMessage>
      )}

      <ol className="flex flex-col gap-5">
        {session.exercises.map((ex, i) => {
          const allDone = ex.sets.length > 0 && ex.sets.every((s) => s.completed);
          return (
            <li key={ex.id} className={cn("rounded-[1.75rem] border p-4 sm:p-5", ex.completed ? "border-lime/40 bg-lime-soft" : "border-line bg-surface")}>
              <div className="mb-2 flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 font-display font-bold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg leading-tight font-bold">{ex.name}</h2>
                  <p className="text-xs text-ink-2">
                    <Timer className="mr-1 inline h-3 w-3" aria-hidden />
                    {ex.restSeconds}s de descanso
                  </p>
                </div>
                <Dialog title={ex.name} description="Como executar" trigger={<BookOpen className="h-4 w-4" aria-hidden />} triggerLabel={`Instruções de ${ex.name}`} triggerVariant="ghost" triggerSize="icon-sm">
                  <ol className="list-decimal space-y-2 pl-5">
                    {ex.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  {ex.tips.length > 0 && (
                    <>
                      <h3 className="mt-5 font-bold">Dicas</h3>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                        {ex.tips.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {ex.safety.length > 0 && <FormMessage tone="warning" className="mt-5">{ex.safety.join(" ")}</FormMessage>}
                </Dialog>
                <Dialog title={`Remover ${ex.name}?`} description="Só desta sessão. A rotina não muda." trigger={<Trash2 className="h-4 w-4" aria-hidden />} triggerLabel={`Remover ${ex.name} da sessão`} triggerVariant="ghost" triggerSize="icon-sm">
                  <ActionForm action={removeSessionExerciseAction} closeDialogOnSuccess>
                    <input type="hidden" name="sessionExerciseId" value={ex.id} />
                    <SubmitButton variant="danger" block>
                      Remover
                    </SubmitButton>
                  </ActionForm>
                </Dialog>
              </div>
              <div className="grid grid-cols-[2rem_1fr_1fr_3rem] gap-2 px-0 text-[0.7rem] font-bold uppercase tracking-wider text-ink-3" aria-hidden>
                <span className="text-center">#</span>
                <span>Reps</span>
                <span>Carga</span>
                <span className="text-center">Feita</span>
              </div>
              <ul>
                {ex.sets.map((s) => (
                  <SetRow key={s.id} set={s} onCompleted={() => startRest(ex.restSeconds)} />
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => start(async () => void (await addSetAction(null, fd({ sessionExerciseId: ex.id, remove: false }))))}
                  className={buttonClasses({ variant: "ghost", size: "sm" })}
                >
                  <Plus className="h-4 w-4" aria-hidden /> Série
                </button>
                {ex.sets.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      start(async () => {
                        const res = await addSetAction(null, fd({ sessionExerciseId: ex.id, remove: true }));
                        if (!res.ok) toast(res.error, "error");
                      })
                    }
                    className={buttonClasses({ variant: "ghost", size: "sm" })}
                  >
                    <Minus className="h-4 w-4" aria-hidden /> Série
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    start(async () => {
                      const res = await exerciseDoneAction(null, fd({ sessionExerciseId: ex.id, done: !ex.completed }));
                      if (!res.ok) toast(res.error, "error");
                    })
                  }
                  className={buttonClasses({ variant: ex.completed ? "secondary" : allDone ? "primary" : "outline", size: "sm", className: "ml-auto" })}
                >
                  <Check className="h-4 w-4" aria-hidden /> {ex.completed ? "Finalizado" : "Finalizar exercício"}
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex flex-col gap-3">
        <Dialog title="Adicionar exercício" description="Só nesta sessão." trigger={<><Plus className="h-4 w-4" aria-hidden /> Adicionar exercício</>} triggerVariant="outline">
          <ActionForm action={addSessionExerciseAction} closeDialogOnSuccess className="flex flex-col gap-4">
            <input type="hidden" name="sessionId" value={session.id} />
            <SelectField name="exerciseId" label="Exercício" defaultValue="">
              <option value="" disabled>
                Escolha…
              </option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.group}
                </option>
              ))}
            </SelectField>
            <SubmitButton block>Adicionar</SubmitButton>
          </ActionForm>
        </Dialog>
        <Dialog title="Finalizar treino" description="Como foi? Isso ajuda a ajustar os próximos treinos." trigger={<><Check className="h-4 w-4" aria-hidden /> Finalizar treino</>} triggerVariant="primary">
          <ActionForm action={finishSessionAction} className="flex flex-col gap-4">
            <input type="hidden" name="sessionId" value={session.id} />
            <SelectField name="perceivedEffort" label="Esforço percebido (1 = muito leve, 10 = máximo)" defaultValue="">
              <option value="">Prefiro não informar</option>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </SelectField>
            <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-sm">
              <input type="checkbox" name="discomfort" className="mt-0.5 h-5 w-5 accent-[var(--danger)]" />
              <span>
                Senti dor ou desconforto incomum. <span className="text-ink-2">Vamos sugerir cautela no próximo treino. Se a dor persistir, procure um profissional de saúde.</span>
              </span>
            </label>
            <TextAreaField name="notes" label="Observações (opcional)" maxLength={600} />
            <SubmitButton block size="lg" pendingLabel="Salvando…">
              Salvar treino
            </SubmitButton>
          </ActionForm>
        </Dialog>
        <Dialog title="Descartar este treino?" description="Os registros desta sessão serão apagados." trigger="Descartar treino" triggerVariant="ghost">
          <ActionForm action={cancelSessionAction}>
            <input type="hidden" name="sessionId" value={session.id} />
            <SubmitButton variant="danger" block>
              Descartar
            </SubmitButton>
          </ActionForm>
        </Dialog>
      </div>

      {rest && (
        <div
          role="timer"
          aria-live="polite"
          className="fixed inset-x-3 bottom-[calc(5.6rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-[1.5rem] border border-line-strong bg-surface-2 p-3 shadow-lift lg:bottom-6"
        >
          <div className="relative grid h-14 w-14 shrink-0 place-items-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--surface-3)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke={restLeft > 0 ? "var(--sky)" : "var(--lime)"}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={97.4}
                strokeDashoffset={97.4 * (1 - Math.max(0, restLeft) / rest.total)}
              />
            </svg>
            <Timer className="h-5 w-5 text-ink-2" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink-2">{restLeft > 0 ? "Descanso" : "Pronto para a próxima série"}</p>
            <p className="font-display text-2xl font-extrabold tabular">{restLeft > 0 ? mmss(restLeft) : "0:00"}</p>
          </div>
          {restLeft > 0 && (
            <button type="button" onClick={() => setRest((r) => (r ? { ...r, endsAt: r.endsAt + 15_000, total: r.total + 15 } : r))} className={buttonClasses({ variant: "ghost", size: "sm" })} aria-label="Mais 15 segundos">
              +15s
            </button>
          )}
          <button type="button" onClick={() => setRest(null)} className={buttonClasses({ variant: "secondary", size: "icon-sm" })} aria-label="Encerrar descanso">
            <SkipForward className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
