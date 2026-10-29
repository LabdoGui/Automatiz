import type { Metadata } from "next";
import { ArrowDown, ArrowUp, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { WEEKDAY_SHORT } from "@/domain/dates";
import { MUSCLE_GROUP_LABEL, MUSCLE_GROUPS } from "@/domain/training/training";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionForm, FormMessage } from "@/components/forms/action-form";
import { NumberField, SelectField, SubmitButton, TextField } from "@/components/forms/fields";
import { ChipCheckbox } from "@/components/forms/choices";
import { requireOnboardedUser } from "@/server/session";
import { exerciseCatalog, getActiveRoutine, listRoutines } from "@/server/services/training";
import {
  addTemplateExerciseAction,
  createRoutineAction,
  deleteWorkoutAction,
  routineAdminAction,
  suggestRoutineAction,
  templateExerciseOpAction,
  updateTemplateExerciseAction,
  upsertWorkoutAction,
} from "@/server/actions/training";

export const metadata: Metadata = { title: "Editar rotina" };

function WorkoutFields({ routineId, workout }: { routineId: string; workout?: { id: string; label: string; name: string; weekdays: number[] } }) {
  return (
    <ActionForm action={upsertWorkoutAction} closeDialogOnSuccess className="flex flex-col gap-4">
      <input type="hidden" name="routineId" value={routineId} />
      <input type="hidden" name="workoutId" value={workout?.id ?? ""} />
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <TextField name="label" label="Letra" maxLength={3} defaultValue={workout?.label ?? ""} placeholder="A" />
        <TextField name="name" label="Nome" maxLength={50} defaultValue={workout?.name ?? ""} placeholder="Peito e tríceps" />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Dias da semana</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_SHORT.map((d, i) => (
            <ChipCheckbox key={d} name="weekdays" value={String(i)} label={d} defaultChecked={workout?.weekdays.includes(i)} />
          ))}
        </div>
      </fieldset>
      <SubmitButton block>{workout ? "Salvar treino" : "Adicionar treino"}</SubmitButton>
    </ActionForm>
  );
}

export default async function RoutineEditorPage() {
  const { user } = await requireOnboardedUser();
  const [routine, routines, catalog] = await Promise.all([getActiveRoutine(user.id), listRoutines(user.id), exerciseCatalog()]);

  const exerciseOptions = MUSCLE_GROUPS.map((g) => (
    <optgroup key={g} label={MUSCLE_GROUP_LABEL[g]}>
      {catalog
        .filter((e) => e.primaryGroup === g)
        .map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
    </optgroup>
  ));

  return (
    <>
      <PageHeader backHref="/treino" eyebrow="Treino" title="Editar rotina" description="Monte treinos A/B/C (ou outra divisão), escolha os dias e ajuste séries, repetições e descanso." />

      {!routine ? (
        <EmptyState
          title="Nenhuma rotina ativa"
          action={
            <div className="flex flex-col items-center gap-3">
              <ActionForm action={suggestRoutineAction}>
                <SubmitButton pendingLabel="Montando…">
                  <Sparkles className="h-4 w-4" aria-hidden /> Sugerir pelo meu perfil
                </SubmitButton>
              </ActionForm>
              <ActionForm action={createRoutineAction} className="flex items-end gap-2">
                <TextField name="name" label="Ou crie uma rotina vazia" placeholder="Minha rotina" maxLength={60} />
                <SubmitButton variant="secondary">Criar</SubmitButton>
              </ActionForm>
            </div>
          }
        />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold">{routine.name}</h2>
            <Dialog
              title="Novo treino"
              trigger={
                <>
                  <Plus className="h-4 w-4" aria-hidden /> Treino
                </>
              }
              triggerSize="sm"
            >
              <WorkoutFields routineId={routine.id} />
            </Dialog>
          </div>
          <div className="flex flex-col gap-6">
            {routine.workouts.map((w) => (
              <section key={w.id} aria-labelledby={`w-${w.id}`} className="rounded-[2rem] border border-line bg-surface p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lime font-display text-xl font-extrabold text-lime-ink">{w.label}</span>
                  <div className="min-w-0 flex-1">
                    <h3 id={`w-${w.id}`} className="font-bold">
                      {w.name}
                    </h3>
                    <p className="text-sm text-ink-2">{w.weekdays.length ? w.weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ") : "sem dia fixo"}</p>
                  </div>
                  <Dialog title={`Editar treino ${w.label}`} trigger={<Pencil className="h-4 w-4" aria-hidden />} triggerLabel={`Editar treino ${w.label}`} triggerVariant="ghost" triggerSize="icon-sm">
                    <WorkoutFields routineId={routine.id} workout={w} />
                    <ActionForm action={deleteWorkoutAction} closeDialogOnSuccess className="mt-4">
                      <input type="hidden" name="workoutId" value={w.id} />
                      <SubmitButton variant="danger" block>
                        <Trash2 className="h-4 w-4" aria-hidden /> Excluir treino
                      </SubmitButton>
                    </ActionForm>
                  </Dialog>
                </div>
                <ol className="divide-y divide-line">
                  {w.exercises.map((e, i) => (
                    <li key={e.id} className="flex items-center gap-2 py-2.5">
                      <span className="w-6 text-center text-sm text-ink-3 tabular">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{e.exercise.name}</p>
                        <p className="text-xs text-ink-2 tabular">
                          {e.sets} séries · {e.repsMin === e.repsMax ? e.repsMin : `${e.repsMin}–${e.repsMax}`} reps · {e.restSeconds}s de descanso
                          {e.notes ? ` · ${e.notes}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center">
                        {(["up", "down"] as const).map((op) => (
                          <ActionForm key={op} action={templateExerciseOpAction}>
                            <input type="hidden" name="id" value={e.id} />
                            <input type="hidden" name="op" value={op} />
                            <SubmitButton variant="ghost" size="icon-sm" pendingLabel="" disabled={op === "up" ? i === 0 : i === w.exercises.length - 1}>
                              {op === "up" ? <ArrowUp className="h-4 w-4" aria-hidden /> : <ArrowDown className="h-4 w-4" aria-hidden />}
                              <span className="sr-only">{op === "up" ? "Mover para cima" : "Mover para baixo"}</span>
                            </SubmitButton>
                          </ActionForm>
                        ))}
                        <Dialog title={e.exercise.name} description="Séries, repetições e descanso" trigger={<Pencil className="h-4 w-4" aria-hidden />} triggerLabel={`Ajustar ${e.exercise.name}`} triggerVariant="ghost" triggerSize="icon-sm">
                          <ActionForm action={updateTemplateExerciseAction} closeDialogOnSuccess className="flex flex-col gap-4">
                            <input type="hidden" name="id" value={e.id} />
                            <div className="grid grid-cols-2 gap-3">
                              <NumberField name="sets" label="Séries" defaultValue={String(e.sets)} />
                              <NumberField name="restSeconds" label="Descanso" suffix="s" defaultValue={String(e.restSeconds)} />
                              <NumberField name="repsMin" label="Reps mín." defaultValue={String(e.repsMin)} />
                              <NumberField name="repsMax" label="Reps máx." defaultValue={String(e.repsMax)} />
                            </div>
                            <TextField name="notes" label="Observação" maxLength={200} defaultValue={e.notes ?? ""} />
                            <SubmitButton block>Salvar</SubmitButton>
                          </ActionForm>
                          <ActionForm action={templateExerciseOpAction} closeDialogOnSuccess className="mt-3">
                            <input type="hidden" name="id" value={e.id} />
                            <input type="hidden" name="op" value="remove" />
                            <SubmitButton variant="danger" block>
                              <Trash2 className="h-4 w-4" aria-hidden /> Remover do treino
                            </SubmitButton>
                          </ActionForm>
                        </Dialog>
                      </div>
                    </li>
                  ))}
                  {w.exercises.length === 0 && <li className="py-3 text-sm text-ink-2">Adicione exercícios a este treino.</li>}
                </ol>
                <Dialog
                  title={`Adicionar ao treino ${w.label}`}
                  trigger={
                    <>
                      <Plus className="h-4 w-4" aria-hidden /> Exercício
                    </>
                  }
                  triggerVariant="ghost"
                  triggerSize="sm"
                  triggerClassName="mt-2"
                >
                  <ActionForm action={addTemplateExerciseAction} closeDialogOnSuccess className="flex flex-col gap-4">
                    <input type="hidden" name="workoutId" value={w.id} />
                    <SelectField name="exerciseId" label="Exercício" defaultValue="">
                      <option value="" disabled>
                        Escolha…
                      </option>
                      {exerciseOptions}
                    </SelectField>
                    <div className="grid grid-cols-2 gap-3">
                      <NumberField name="sets" label="Séries" defaultValue="3" />
                      <NumberField name="restSeconds" label="Descanso" suffix="s" defaultValue="60" />
                      <NumberField name="repsMin" label="Reps mín." defaultValue="8" />
                      <NumberField name="repsMax" label="Reps máx." defaultValue="12" />
                    </div>
                    <SubmitButton block>Adicionar</SubmitButton>
                  </ActionForm>
                </Dialog>
              </section>
            ))}
            {routine.workouts.length === 0 && <EmptyState title="Rotina sem treinos">Adicione o primeiro treino (ex.: “A — Corpo inteiro”).</EmptyState>}
          </div>
        </>
      )}

      <section aria-labelledby="rotinas" className="mt-12">
        <SectionTitle id="rotinas">Suas rotinas</SectionTitle>
        <ul className="divide-y divide-line rounded-3xl border border-line">
          {routines.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.name}</p>
                <p className="text-xs text-ink-2">{r._count.workouts} treinos</p>
              </div>
              {r.active ? (
                <Badge tone="lime">ativa</Badge>
              ) : (
                <ActionForm action={routineAdminAction}>
                  <input type="hidden" name="routineId" value={r.id} />
                  <input type="hidden" name="op" value="activate" />
                  <SubmitButton variant="secondary" size="sm">
                    Ativar
                  </SubmitButton>
                </ActionForm>
              )}
              <Dialog title={`Excluir “${r.name}”?`} description="Os treinos já registrados continuam no histórico." trigger={<Trash2 className="h-4 w-4" aria-hidden />} triggerLabel={`Excluir rotina ${r.name}`} triggerVariant="ghost" triggerSize="icon-sm">
                <ActionForm action={routineAdminAction} closeDialogOnSuccess>
                  <input type="hidden" name="routineId" value={r.id} />
                  <input type="hidden" name="op" value="delete" />
                  <SubmitButton variant="danger" block>
                    Excluir rotina
                  </SubmitButton>
                </ActionForm>
              </Dialog>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <ActionForm action={createRoutineAction} className="flex items-end gap-2">
            <TextField name="name" label="Nova rotina" placeholder="Ex.: Rotina de férias" maxLength={60} />
            <SubmitButton variant="secondary">Criar</SubmitButton>
          </ActionForm>
          <ActionForm action={suggestRoutineAction}>
            <SubmitButton variant="ghost" pendingLabel="Montando…">
              <Sparkles className="h-4 w-4" aria-hidden /> Nova sugestão pelo perfil
            </SubmitButton>
          </ActionForm>
        </div>
        <FormMessage className="mt-4">
          O VIVA não aumenta cargas sozinho. Ele sugere ajustes com base nos seus registros, e a decisão é sempre sua — de
          preferência com orientação de um profissional.
        </FormMessage>
      </section>
    </>
  );
}
