import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { isISODate, startOfWeek, weekdayIndex, WEEKDAY_SHORT } from "@/domain/dates";
import { formatBRL, formatDateLong, formatDec, formatInt } from "@/domain/format";
import { roundTotals } from "@/domain/nutrition/calc";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/fields";
import { WeekNav } from "@/components/planner/week-strip";
import { IncompleteNote, MacroBar } from "@/components/nutrition/nutrients";
import { clockFor, requireOnboardedUser } from "@/server/session";
import { getActivePlan, mealCost, plannerContext, planVersions, summarizePlan } from "@/server/services/planner";
import { priceIndexByFood } from "@/server/services/prices";
import { activateVersionAction } from "@/server/actions/planner";

export const metadata: Metadata = { title: "Visão da semana" };

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { user, settings } = await requireOnboardedUser();
  const { today } = clockFor(settings);
  const { dia } = await searchParams;
  const weekStart = startOfWeek(dia && isISODate(dia) ? dia : today);
  const [plan, ctx, versions, prices] = await Promise.all([
    getActivePlan(user.id, weekStart),
    plannerContext(user.id),
    planVersions(user.id, weekStart),
    priceIndexByFood(user.id),
  ]);
  const { days, week } = summarizePlan(plan, weekStart);
  const goal = ctx.dailyGoal;
  const daysWithMeals = days.filter((d) => d.planned > 0);
  const avg = daysWithMeals.length
    ? roundTotals({
        values: {
          kcal: week.values.kcal / daysWithMeals.length,
          proteinG: week.values.proteinG / daysWithMeals.length,
          carbsG: week.values.carbsG / daysWithMeals.length,
          fatG: week.values.fatG / daysWithMeals.length,
          fiberG: week.values.fiberG / daysWithMeals.length,
        },
        incomplete: week.incomplete,
      })
    : null;
  const costs = days.map((d) =>
    d.meals.reduce(
      (acc, m) => {
        const c = mealCost(m.items, prices);
        return { cents: acc.cents + c.cents, complete: acc.complete && c.complete, priced: acc.priced || c.priced };
      },
      { cents: 0, complete: true, priced: false },
    ),
  );
  const weekCost = costs.reduce((a, c) => a + c.cents, 0);

  return (
    <>
      <PageHeader backHref={`/alimentacao?dia=${weekStart}`} eyebrow="Alimentação" title="Visão da semana" description="Totais estimados por dia e da semana inteira." />
      <WeekNav weekStart={weekStart} basePath="/alimentacao/semana" today={today} />

      {!plan ? (
        <EmptyState title="Sem plano nesta semana">Gere um planejamento na tela de alimentação.</EmptyState>
      ) : (
        <>
          <section aria-labelledby="totais" className="mb-10">
            <h2 id="totais" className="sr-only">
              Totais por dia
            </h2>
            <div className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-sm">
                <caption className="sr-only">Energia, macronutrientes, refeições e custo estimado por dia</caption>
                <thead>
                  <tr className="text-left text-xs font-bold uppercase tracking-wider text-ink-3">
                    <th scope="col" className="border-b border-line py-3 pr-3">Dia</th>
                    <th scope="col" className="border-b border-line px-3 py-3 text-right">kcal</th>
                    <th scope="col" className="border-b border-line px-3 py-3 text-right">Prot.</th>
                    <th scope="col" className="border-b border-line px-3 py-3 text-right">Carb.</th>
                    <th scope="col" className="border-b border-line px-3 py-3 text-right">Gord.</th>
                    <th scope="col" className="border-b border-line px-3 py-3 text-right">Fibras</th>
                    <th scope="col" className="border-b border-line px-3 py-3 text-right">Feitas</th>
                    <th scope="col" className="border-b border-line py-3 pl-3 text-right">Custo</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {days.map((d, i) => (
                    <tr key={d.date} className={d.date === today ? "bg-lime-soft" : undefined}>
                      <th scope="row" className="border-b border-line py-3 pr-3 text-left font-semibold">
                        <Link href={`/alimentacao?dia=${d.date}`} className="hover:underline">
                          {WEEKDAY_SHORT[weekdayIndex(d.date)]} {Number(d.date.slice(8))}
                        </Link>
                        {d.hasFlexible && <span className="ml-1.5 text-xs text-coral-text">flex</span>}
                      </th>
                      <td className="border-b border-line px-3 py-3 text-right font-semibold">
                        {formatInt(d.totals.values.kcal)}
                        {d.totals.incomplete.includes("kcal") && "*"}
                      </td>
                      <td className="border-b border-line px-3 py-3 text-right">{formatDec(d.totals.values.proteinG)}</td>
                      <td className="border-b border-line px-3 py-3 text-right">{formatDec(d.totals.values.carbsG)}</td>
                      <td className="border-b border-line px-3 py-3 text-right">{formatDec(d.totals.values.fatG)}</td>
                      <td className="border-b border-line px-3 py-3 text-right">{formatDec(d.totals.values.fiberG)}</td>
                      <td className="border-b border-line px-3 py-3 text-right">
                        {d.completed}/{d.planned}
                      </td>
                      <td className="border-b border-line py-3 pl-3 text-right">
                        {costs[i].priced ? `${formatBRL(costs[i].cents)}${costs[i].complete ? "" : "*"}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="tabular">
                  <tr className="font-bold">
                    <th scope="row" className="py-3 pr-3 text-left">Semana</th>
                    <td className="px-3 py-3 text-right">{formatInt(week.values.kcal)}</td>
                    <td className="px-3 py-3 text-right">{formatDec(week.values.proteinG)}</td>
                    <td className="px-3 py-3 text-right">{formatDec(week.values.carbsG)}</td>
                    <td className="px-3 py-3 text-right">{formatDec(week.values.fatG)}</td>
                    <td className="px-3 py-3 text-right">{formatDec(week.values.fiberG)}</td>
                    <td className="px-3 py-3 text-right">
                      {days.reduce((a, d) => a + d.completed, 0)}/{days.reduce((a, d) => a + d.planned, 0)}
                    </td>
                    <td className="py-3 pl-3 text-right">{weekCost ? formatBRL(weekCost) : "—"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <IncompleteNote totals={week} className="mt-3" />
            <p className="mt-2 text-xs text-ink-3">Valores em gramas, exceto energia. Custos proporcionais às quantidades, com seus preços cadastrados.</p>
          </section>

          {avg && (
            <section aria-labelledby="media" className="mb-10 grid gap-6 sm:grid-cols-2">
              <div className="rounded-3xl border border-line bg-surface p-5">
                <h2 id="media" className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  Média diária planejada
                </h2>
                <p className="mt-2 font-display text-4xl font-extrabold tabular">
                  {formatInt(avg.values.kcal)} <span className="text-base font-semibold text-ink-3">kcal</span>
                </p>
                <MacroBar totals={avg} className="mt-4" />
                <p className="mt-3 text-sm text-ink-2 tabular">
                  P {formatDec(avg.values.proteinG)} g · C {formatDec(avg.values.carbsG)} g · G {formatDec(avg.values.fatG)} g
                </p>
              </div>
              <div className="rounded-3xl border border-line p-5 text-sm text-ink-2">
                {goal?.kcal ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">Comparação com a meta</p>
                    <p className="mt-2">
                      Meta diária: <strong className="text-ink">{formatInt(goal.kcal)} kcal</strong>
                      {goal.derivedFromWeekly && " (média da meta semanal)"}.
                    </p>
                    <p className="mt-1">
                      Semana planejada: <strong className="text-ink">{formatInt(week.values.kcal)} kcal</strong> de{" "}
                      {formatInt(goal.kcal * 7)} kcal ({Math.round((week.values.kcal / (goal.kcal * 7)) * 100)}%).
                    </p>
                    <p className="mt-3 text-xs">Diferenças são esperadas: o plano usa porções de receitas dentro de limites seguros. Ajuste as quantidades com seu profissional.</p>
                  </>
                ) : (
                  <p>Sem meta registrada, mostramos apenas os totais estimados — sem comparar com números que não foram definidos por você ou por um profissional.</p>
                )}
              </div>
            </section>
          )}
        </>
      )}

      <section aria-labelledby="versoes" id="versoes">
        <SectionTitle id="versoes">
          <span className="inline-flex items-center gap-2">
            <History className="h-5 w-5 text-ink-2" aria-hidden /> Versões do plano
          </span>
        </SectionTitle>
        {versions.length === 0 ? (
          <p className="text-sm text-ink-2">Nenhuma versão para esta semana ainda.</p>
        ) : (
          <ul className="divide-y divide-line rounded-3xl border border-line">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {v.name} <span className="text-ink-3">· v{v.version}</span>
                  </p>
                  <p className="text-xs text-ink-2">
                    Criada em {formatDateLong(v.createdAt.toISOString().slice(0, 10))} · {v._count.meals} refeições
                  </p>
                </div>
                {v.status === "ACTIVE" ? (
                  <Badge tone="lime">em uso</Badge>
                ) : (
                  <ActionForm action={activateVersionAction}>
                    <input type="hidden" name="planId" value={v.id} />
                    <SubmitButton variant="secondary" size="sm" pendingLabel="…">
                      Restaurar
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
