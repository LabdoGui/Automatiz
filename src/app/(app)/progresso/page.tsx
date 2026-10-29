import type { Metadata } from "next";
import Link from "next/link";
import { Archive, Info, Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import { addDays, diffDays, isISODate, localDate, rangeDates, startOfWeek, toDbDate } from "@/domain/dates";
import { formatBRL, formatDateBR, formatDayMonth, formatDec, formatInt } from "@/domain/format";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionForm, FormMessage } from "@/components/forms/action-form";
import { NumberField, SelectField, SubmitButton, TextField } from "@/components/forms/fields";
import { LineChart } from "@/components/charts/line-chart";
import { ColumnChart } from "@/components/charts/column-chart";
import { HeatCalendar } from "@/components/charts/heat-calendar";
import { HabitGrid } from "@/components/progress/habit-grid";
import { HABIT_ICONS } from "@/components/ui/dynamic-icon";
import { cn } from "@/components/ui/cn";
import { clockFor, requireOnboardedUser } from "@/server/session";
import { db } from "@/server/db";
import { listHabits, listMeasurements, mealConsistency, spendingByList, waterByDay, workoutsPerWeek } from "@/server/services/progress";
import { exerciseProgress, trainedExercises } from "@/server/services/training";
import { activeDates } from "@/server/services/gamification";
import { archiveHabitAction, createHabitAction, deleteMeasurementAction, saveMeasurementAction } from "@/server/actions/progress";

export const metadata: Metadata = { title: "Progresso" };

const RANGES = [
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["90", "90 dias"],
] as const;

const MEASURE_FIELDS = [
  ["weightKg", "Peso", "kg"],
  ["waistCm", "Cintura", "cm"],
  ["hipCm", "Quadril", "cm"],
  ["chestCm", "Peito", "cm"],
  ["armCm", "Braço", "cm"],
  ["thighCm", "Coxa", "cm"],
] as const;

function MeasurementForm({ today, record }: { today: string; record?: { id: string; date: string; values: Record<string, number | null>; notes: string | null } }) {
  return (
    <ActionForm action={saveMeasurementAction} closeDialogOnSuccess className="flex flex-col gap-4">
      <input type="hidden" name="id" value={record?.id ?? ""} />
      <TextField name="date" label="Data" type="date" defaultValue={record?.date ?? today} max={today} />
      <div className="grid grid-cols-2 gap-3">
        {MEASURE_FIELDS.map(([name, label, unit]) => (
          <NumberField key={name} name={name} label={label} decimal suffix={unit} defaultValue={record?.values[name] != null ? String(record.values[name]).replace(".", ",") : ""} />
        ))}
      </div>
      <TextField name="notes" label="Observação (opcional)" maxLength={300} defaultValue={record?.notes ?? ""} />
      <p className="text-xs text-ink-3">Tudo é opcional. Registre só o que fizer sentido para você.</p>
      <SubmitButton block>{record ? "Salvar correção" : "Registrar"}</SubmitButton>
    </ActionForm>
  );
}

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ dias?: string; de?: string; ate?: string; exercicio?: string }> }) {
  const { user, settings, profile } = await requireOnboardedUser();
  const { tz, today } = clockFor(settings);
  const sp = await searchParams;
  let from: string;
  let to = today;
  let active = sp.dias ?? "30";
  if (sp.de && sp.ate && isISODate(sp.de) && isISODate(sp.ate) && sp.de <= sp.ate) {
    from = sp.de;
    to = sp.ate > today ? today : sp.ate;
    active = "custom";
    if (diffDays(to, from) > 366) from = addDays(to, -366);
  } else {
    const n = Number(active) || 30;
    from = addDays(today, -(Math.min(366, n) - 1));
  }

  const [measurements, workouts, consistency, spending, water, habits, exercises, activeDays, achievements, challengesDone] = await Promise.all([
    listMeasurements(user.id, from, to),
    workoutsPerWeek(user.id, from, to, tz),
    mealConsistency(user.id, from, to),
    spendingByList(user.id, from, to),
    profile.trackWater ? waterByDay(user.id, from, to) : Promise.resolve(new Map<string, number>()),
    listHabits(user.id, addDays(today, -6), today),
    trainedExercises(user.id),
    activeDates(user.id, tz, from),
    db.userAchievement.count({ where: { userId: user.id, unlockedAt: { gte: toDbDate(from), lte: toDbDate(addDays(to, 1)) } } }),
    db.userChallenge.count({ where: { userId: user.id, status: "COMPLETED", completedAt: { gte: toDbDate(from), lte: toDbDate(addDays(to, 1)) } } }),
  ]);
  const exerciseId = exercises.find((e) => e.id === sp.exercicio)?.id ?? exercises[0]?.id;
  const loads = exerciseId ? await exerciseProgress(user.id, exerciseId, 30) : [];
  // Um ponto por dia: maior carga do dia; último peso registrado no dia.
  const loadByDay = new Map<string, number>();
  for (const l of loads) {
    const day = localDate(l.date, tz);
    if (l.maxWeight === null || day < from) continue;
    loadByDay.set(day, Math.max(loadByDay.get(day) ?? 0, l.maxWeight));
  }
  const loadPoints = [...loadByDay].map(([x, y]) => ({ x, y }));
  const weightByDay = new Map<string, number>();
  for (const m of measurements) if (m.weightKg !== null) weightByDay.set(m.date.toISOString().slice(0, 10), m.weightKg);
  const weightPoints = [...weightByDay].map(([x, y]) => ({ x, y }));
  const totalWorkouts = workouts.reduce((a, w) => a + w.y, 0);
  const planned = consistency.reduce((a, d) => a + d.planned, 0);
  const done = consistency.reduce((a, d) => a + d.done, 0);
  const paid = spending.reduce((a, s) => a + s.paidCents, 0);
  const weekDays = rangeDates(addDays(today, -6), today);
  const rangeQuery = active === "custom" ? `de=${from}&ate=${to}` : `dias=${active}`;

  return (
    <>
      <PageHeader eyebrow="Progresso" title="Sua evolução" description="Consistência, treinos, hábitos e gastos. O peso é só um dos indicadores — e nunca o único." />

      {/* Filtros: uma linha acima de tudo o que eles afetam */}
      <div className="mb-8 flex flex-wrap items-end gap-2">
        {RANGES.map(([v, l]) => (
          <Link
            key={v}
            href={`/progresso?dias=${v}`}
            aria-current={active === v ? "page" : undefined}
            className={cn("rounded-full border px-4 py-2 text-sm font-semibold", active === v ? "border-ink bg-ink text-bg" : "border-line text-ink-2 hover:bg-surface-2")}
          >
            {l}
          </Link>
        ))}
        <form action="/progresso" className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-ink-2">
            De
            <input type="date" name="de" defaultValue={from} max={today} className="mt-1 block h-10 rounded-xl border border-line bg-surface-2 px-2 text-sm text-ink" />
          </label>
          <label className="text-xs font-semibold text-ink-2">
            Até
            <input type="date" name="ate" defaultValue={to} max={today} className="mt-1 block h-10 rounded-xl border border-line bg-surface-2 px-2 text-sm text-ink" />
          </label>
          <button type="submit" className={cn("h-10 rounded-full border px-4 text-sm font-semibold", active === "custom" ? "border-ink bg-ink text-bg" : "border-line")}>
            Aplicar
          </button>
        </form>
      </div>

      <dl className="mb-10 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-line py-6 sm:grid-cols-4">
        {[
          ["Dias com registros", formatInt(activeDays.length)],
          ["Treinos", formatInt(totalWorkouts)],
          ["Refeições do plano feitas", planned ? `${Math.round((done / planned) * 100)}%` : "—"],
          ["Pago em compras", paid ? formatBRL(paid) : "—"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-ink-2">{label}</dt>
            <dd className="mt-1 font-display text-3xl font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-12 lg:grid-cols-2 [&>*]:min-w-0">
        <section aria-labelledby="habitos" className="lg:col-span-2">
          <SectionTitle
            id="habitos"
            action={
              <Dialog title="Novo hábito" description="Algo pequeno e possível. Sem metas de restrição." trigger={<><Plus className="h-4 w-4" aria-hidden /> Hábito</>} triggerSize="sm">
                <ActionForm action={createHabitAction} closeDialogOnSuccess className="flex flex-col gap-4">
                  <TextField name="name" label="Hábito" placeholder="Ex.: dormir antes das 23h, caminhar 15 min" maxLength={50} />
                  <SelectField name="icon" label="Ícone" defaultValue="sparkles">
                    {HABIT_ICONS.map((i) => (
                      <option key={i} value={i}>
                        {{ sparkles: "Brilho", droplets: "Água", leaf: "Folha", flame: "Energia", star: "Estrela", repeat: "Rotina", sprout: "Broto", utensils: "Refeição" }[i]}
                      </option>
                    ))}
                  </SelectField>
                  <SubmitButton block>Criar hábito</SubmitButton>
                </ActionForm>
              </Dialog>
            }
          >
            Hábitos da semana
          </SectionTitle>
          {habits.length === 0 ? (
            <p className="text-sm text-ink-2">Crie hábitos simples para acompanhar — dormir bem, caminhar, cozinhar em casa. Dias sem marcação não “quebram” nada.</p>
          ) : (
            <>
              <HabitGrid
                habits={habits.map((h) => ({ id: h.id, name: h.name, icon: h.icon, checked: h.checks.map((c) => c.date.toISOString().slice(0, 10)) }))}
                days={weekDays}
                today={today}
              />
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-xs font-semibold text-ink-2">Arquivar hábitos</summary>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {habits.map((h) => (
                    <li key={h.id}>
                      <ActionForm action={archiveHabitAction}>
                        <input type="hidden" name="habitId" value={h.id} />
                        <SubmitButton variant="ghost" size="sm" pendingLabel="…">
                          <Archive className="h-3.5 w-3.5" aria-hidden /> {h.name}
                        </SubmitButton>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </section>

        <section aria-labelledby="consistencia" className="lg:col-span-2">
          <SectionTitle id="consistencia">Consistência alimentar</SectionTitle>
          {planned === 0 ? (
            <p className="text-sm text-ink-2">Quando houver planejamento no período, cada dia aparece aqui com a proporção de refeições marcadas.</p>
          ) : (
            <HeatCalendar
              label="Refeições do plano concluídas por dia"
              days={consistency.map((d) => ({
                date: d.date,
                ratio: d.planned ? d.done / d.planned : null,
                detail: d.planned ? `${d.done} de ${d.planned} refeições concluídas` : "sem refeições planejadas",
              }))}
            />
          )}
        </section>

        <section aria-labelledby="treinos-semana">
          <SectionTitle id="treinos-semana">Treinos por semana</SectionTitle>
          {totalWorkouts === 0 ? (
            <p className="text-sm text-ink-2">Nenhum treino concluído no período. Tudo bem — descanso também conta.</p>
          ) : (
            <ColumnChart
              label="Treinos concluídos por semana"
              unit="treinos"
              format="int"
              data={workouts.map((w) => ({ key: w.x, label: formatDayMonth(w.x), value: w.y, detail: `Semana de ${formatDayMonth(startOfWeek(w.x))}` }))}
            />
          )}
        </section>

        <section aria-labelledby="cargas">
          <SectionTitle id="cargas">Evolução de cargas</SectionTitle>
          {exercises.length === 0 ? (
            <p className="text-sm text-ink-2">Registre cargas nos treinos para ver a evolução por exercício.</p>
          ) : (
            <>
              <form action="/progresso" className="mb-3 flex items-end gap-2">
                <input type="hidden" name={active === "custom" ? "de" : "dias"} value={active === "custom" ? from : active} />
                {active === "custom" && <input type="hidden" name="ate" value={to} />}
                <label className="flex-1 text-xs font-semibold text-ink-2">
                  Exercício
                  <select name="exercicio" defaultValue={exerciseId} className="mt-1 block h-10 w-full rounded-xl border border-line bg-surface-2 px-2 text-sm text-ink">
                    {exercises.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="h-10 rounded-full border border-line px-4 text-sm font-semibold">
                  Ver
                </button>
              </form>
              {loadPoints.length >= 2 ? (
                <LineChart points={loadPoints} label="Carga máxima por sessão" unit="kg" format="dec" />
              ) : (
                <p className="text-sm text-ink-2">São necessários pelo menos dois registros com carga no período.</p>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="peso" className="lg:col-span-2">
          <SectionTitle
            id="peso"
            action={
              <Dialog title="Registrar medidas" trigger={<><Ruler className="h-4 w-4" aria-hidden /> Registrar</>} triggerSize="sm">
                <MeasurementForm today={today} />
              </Dialog>
            }
          >
            Peso e medidas (opcional)
          </SectionTitle>
          <p className="mb-4 flex items-start gap-2 text-sm text-ink-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            O peso varia de um dia para o outro por água, sal, intestino e ciclo hormonal — isso não significa mudança de gordura. Observe
            tendências de semanas, junto com energia, sono e força.
          </p>
          {weightPoints.length >= 2 && <LineChart points={weightPoints} label="Peso registrado" unit="kg" format="dec" />}
          {measurements.length === 0 ? (
            <EmptyState title="Sem medidas no período" className="mt-2">
              Registrar é opcional. Se preferir não se pesar, acompanhe hábitos e treinos.
            </EmptyState>
          ) : (
            <div className="relative -mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[36rem] text-sm tabular">
                <caption className="sr-only">Medidas registradas</caption>
                <thead>
                  <tr className="text-left text-xs text-ink-3">
                    <th scope="col" className="py-2">Data</th>
                    {MEASURE_FIELDS.map(([k, l, u]) => (
                      <th key={k} scope="col" className="py-2 text-right">
                        {l} ({u})
                      </th>
                    ))}
                    <th scope="col" className="py-2 text-right">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...measurements].reverse().map((m) => {
                    const date = m.date.toISOString().slice(0, 10);
                    const values = Object.fromEntries(MEASURE_FIELDS.map(([k]) => [k, m[k]]));
                    return (
                      <tr key={m.id} className="border-t border-line">
                        <td className="py-2">{formatDateBR(date)}</td>
                        {MEASURE_FIELDS.map(([k]) => (
                          <td key={k} className="py-2 text-right">
                            {m[k] !== null ? formatDec(m[k]!) : "—"}
                          </td>
                        ))}
                        <td className="py-1 text-right whitespace-nowrap">
                          <Dialog title={`Corrigir registro de ${formatDateBR(date)}`} trigger={<Pencil className="h-4 w-4" aria-hidden />} triggerLabel={`Corrigir registro de ${formatDateBR(date)}`} triggerVariant="ghost" triggerSize="icon-sm">
                            <MeasurementForm today={today} record={{ id: m.id, date, values, notes: m.notes }} />
                          </Dialog>
                          <Dialog title="Excluir registro?" trigger={<Trash2 className="h-4 w-4" aria-hidden />} triggerLabel={`Excluir registro de ${formatDateBR(date)}`} triggerVariant="ghost" triggerSize="icon-sm">
                            <ActionForm action={deleteMeasurementAction} closeDialogOnSuccess>
                              <input type="hidden" name="id" value={m.id} />
                              <SubmitButton variant="danger" block>
                                Excluir
                              </SubmitButton>
                            </ActionForm>
                          </Dialog>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {profile.trackWater && profile.waterGoalMl && (
          <section aria-labelledby="agua">
            <SectionTitle id="agua">Água por dia</SectionTitle>
            {water.size === 0 ? (
              <p className="text-sm text-ink-2">Nenhum registro de água no período.</p>
            ) : (
              <ColumnChart
                label="Água"
                unit="ml"
                referenceLabel="Meta diária"
                format="int"
                data={rangeDates(from, to)
                  .slice(-31)
                  .map((d) => ({ key: d, label: formatDayMonth(d), value: water.get(d) ?? 0, reference: profile.waterGoalMl }))}
              />
            )}
          </section>
        )}

        <section aria-labelledby="gastos-titulo" id="gastos" className="scroll-mt-24">
          <SectionTitle id="gastos-titulo">Gastos com alimentação</SectionTitle>
          {spending.length === 0 ? (
            <p className="text-sm text-ink-2">Listas de compras do período aparecem aqui, com o valor pago e o orçamento.</p>
          ) : (
            <>
              <ColumnChart
                label="Pago por lista"
                unit="R$"
                referenceLabel="Orçamento"
                format="brl"
                data={spending.map((s) => ({
                  key: s.id,
                  label: formatDayMonth(s.date),
                  value: s.paidCents / 100,
                  reference: s.budgetCents !== null ? s.budgetCents / 100 : null,
                  detail: `Estimado: ${formatBRL(s.estimatedCents)} · ${s.status === "DONE" ? "finalizada" : "em aberto"}`,
                }))}
              />
              <p className="mt-2 text-xs text-ink-3">Considera apenas valores pagos informados por você.</p>
            </>
          )}
        </section>

        <section aria-labelledby="metas">
          <SectionTitle id="metas">Metas concluídas</SectionTitle>
          <dl className="grid grid-cols-2 gap-4">
            <div className="rounded-3xl border border-line p-4">
              <dt className="text-sm text-ink-2">Conquistas no período</dt>
              <dd className="font-display text-3xl font-extrabold">{achievements}</dd>
            </div>
            <div className="rounded-3xl border border-line p-4">
              <dt className="text-sm text-ink-2">Desafios concluídos</dt>
              <dd className="font-display text-3xl font-extrabold">{challengesDone}</dd>
            </div>
          </dl>
          <FormMessage className="mt-4">
            Resultados físicos variam de pessoa para pessoa e não seguem prazos fixos. O VIVA acompanha seus hábitos — não promete
            resultados.
          </FormMessage>
          <p className="mt-2 text-xs text-ink-3">
            Período: {formatDateBR(from)} a {formatDateBR(to)}. <Link className="underline" href={`/progresso?${rangeQuery}#peso`}>Ir para medidas</Link>
          </p>
        </section>
      </div>
    </>
  );
}
