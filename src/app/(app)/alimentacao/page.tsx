import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarRange,
  ChefHat,
  Clock,
  History,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBasket,
  Sparkles,
  TriangleAlert,
  Utensils,
} from "lucide-react";
import { isISODate, startOfWeek, weekdayIndex, WEEKDAY_LONG } from "@/domain/dates";
import { formatBRL, formatDateLong, formatInt } from "@/domain/format";
import { MEAL_TYPE_LABEL, MEAL_TYPES } from "@/domain/planner/meal-types";
import { goalProgress } from "@/domain/nutrition/calc";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog } from "@/components/ui/dialog";
import { ProgressRing } from "@/components/ui/progress-ring";
import { ActionForm, FormMessage } from "@/components/forms/action-form";
import { SelectField, SubmitButton, TextField } from "@/components/forms/fields";
import { WeekNav, WeekStrip } from "@/components/planner/week-strip";
import { MealCheck } from "@/components/planner/meal-check";
import { IncompleteNote, MacroBar, MacroGrid, MacroLine, SourceNote } from "@/components/nutrition/nutrients";
import { clockFor, requireOnboardedUser } from "@/server/session";
import {
  compatibleRecipes,
  dayLogs,
  getActivePlan,
  mealCost,
  mealNutrition,
  plannerContext,
  summarizePlan,
} from "@/server/services/planner";
import { priceIndexByFood } from "@/server/services/prices";
import { addMealAction, generatePlanAction, deleteLogAction } from "@/server/actions/planner";
import { mealTotals, roundTotals } from "@/domain/nutrition/calc";
import { foodConflicts } from "@/domain/restrictions/engine";
import { factsOf } from "@/server/services/foods";

export const metadata: Metadata = { title: "Alimentação" };

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { user, settings } = await requireOnboardedUser();
  const { today } = clockFor(settings);
  const sp = await searchParams;
  const day = sp.dia && isISODate(sp.dia) ? sp.dia : today;
  const weekStart = startOfWeek(day);

  const [plan, ctx, logs, prices, recipes] = await Promise.all([
    getActivePlan(user.id, weekStart),
    plannerContext(user.id),
    dayLogs(user.id, day),
    priceIndexByFood(user.id),
    compatibleRecipes(user.id, null),
  ]);
  const { days } = summarizePlan(plan, weekStart);
  const selected = days.find((d) => d.date === day)!;
  const progress = Object.fromEntries(days.map((d) => [d.date, { planned: d.planned, completed: d.completed }]));
  const goal = ctx.dailyGoal;
  const kcalProgress = goalProgress(selected.totals.values.kcal, goal?.kcal ?? null);
  const dayCost = selected.meals.reduce(
    (acc, m) => {
      const c = mealCost(m.items, prices);
      return { cents: acc.cents + c.cents, complete: acc.complete && c.complete, priced: acc.priced || c.priced };
    },
    { cents: 0, complete: true, priced: false },
  );
  const isPast = day < today;

  const generateForm = (label: string, variant: "primary" | "secondary" = "primary") => (
    <ActionForm action={generatePlanAction} aria-label={label}>
      <input type="hidden" name="weekStart" value={weekStart} />
      <SubmitButton variant={variant} pendingLabel="Montando a semana…">
        <Sparkles className="h-4 w-4" aria-hidden /> {label}
      </SubmitButton>
    </ActionForm>
  );

  return (
    <>
      <PageHeader
        eyebrow="Alimentação"
        title="Sua semana"
        description="Toque em um dia para ver as refeições. Marque o que fez — sem culpa pelo que não fez."
        actions={
          <LinkButton href="/compras" variant="secondary" size="sm" className="hidden sm:inline-flex">
            <ShoppingBasket className="h-4 w-4" aria-hidden /> Compras
          </LinkButton>
        }
      />

      <WeekNav weekStart={weekStart} basePath="/alimentacao" today={today} />
      <WeekStrip weekStart={weekStart} selected={day} today={today} progress={progress} basePath="/alimentacao" />

      {!plan ? (
        <EmptyState
          icon={<CalendarRange className="h-6 w-6" aria-hidden />}
          title="Nenhum plano para esta semana"
          action={generateForm("Gerar planejamento da semana")}
        >
          O VIVA monta a semana a partir do seu perfil: refeições, restrições, utensílios, despensa e orçamento.
        </EmptyState>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem] [&>*]:min-w-0">
          <section aria-labelledby="dia-titulo" className="min-w-0">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="dia-titulo" className="text-2xl font-extrabold">
                  {WEEKDAY_LONG[weekdayIndex(day)]}
                  {day === today && <span className="ml-2 align-middle text-sm font-bold text-lime-text">hoje</span>}
                </h2>
                <p className="text-sm text-ink-2">{formatDateLong(day)}</p>
              </div>
              <Dialog
                title="Adicionar refeição"
                description={`Em ${formatDateLong(day)}`}
                trigger={
                  <>
                    <Plus className="h-4 w-4" aria-hidden /> Refeição
                  </>
                }
                triggerSize="sm"
              >
                <ActionForm action={addMealAction} closeDialogOnSuccess className="flex flex-col gap-4">
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="date" value={day} />
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField name="mealType" label="Refeição" defaultValue="LUNCH">
                      {MEAL_TYPES.map((m) => (
                        <option key={m} value={m}>
                          {MEAL_TYPE_LABEL[m]}
                        </option>
                      ))}
                    </SelectField>
                    <TextField name="time" label="Horário" type="time" />
                  </div>
                  <SelectField name="recipeId" label="Receita (compatível com seu perfil)" defaultValue="">
                    <option value="">Montar do zero (adicionar ingredientes depois)</option>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} — {r.prepMinutes} min · ≈{formatInt(r.totals.values.kcal)} kcal
                      </option>
                    ))}
                  </SelectField>
                  <TextField name="title" label="Nome (para refeição montada do zero)" maxLength={80} />
                  <SubmitButton block>Adicionar</SubmitButton>
                </ActionForm>
              </Dialog>
            </div>

            {selected.meals.length === 0 ? (
              <EmptyState icon={<Utensils className="h-6 w-6" aria-hidden />} title="Nenhuma refeição neste dia">
                Adicione uma refeição ou gere uma nova sugestão para a semana.
              </EmptyState>
            ) : (
              <ol className="relative flex flex-col">
                {selected.meals.map((meal, i) => {
                  const totals = mealNutrition(meal);
                  const cost = mealCost(meal.items, prices);
                  const last = i === selected.meals.length - 1;
                  const critical = [...new Set(meal.items.flatMap((it) => foodConflicts(it.food, ctx.rules).filter((c) => c.level === "critical").map((c) => c.label)))];
                  return (
                    <li key={meal.id} className="relative flex gap-3 sm:gap-4">
                      <div className="flex w-12 shrink-0 flex-col items-center pt-3 sm:w-14">
                        <span className="font-display text-sm font-bold tabular text-ink-2">{meal.time ?? "—"}</span>
                        {!last && <span aria-hidden className="mt-2 w-px flex-1 bg-line-strong" />}
                      </div>
                      <div
                        className={`mb-3 flex min-w-0 flex-1 items-start gap-3 rounded-3xl border p-4 transition-colors ${
                          meal.completedAt ? "border-lime/40 bg-lime-soft" : meal.isFlexible ? "border-dashed border-coral/50 bg-coral-soft" : "border-line bg-surface"
                        }`}
                      >
                        <Link href={`/alimentacao/refeicao/${meal.id}`} className="min-w-0 flex-1 rounded-xl">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{MEAL_TYPE_LABEL[meal.mealType]}</p>
                          <h3 className="mt-0.5 text-[1.05rem] leading-snug font-bold">{meal.title}</h3>
                          {meal.isFlexible ? (
                            <p className="mt-1 text-sm text-ink-2">Momento livre. Sem registro de nutrientes — e tudo bem.</p>
                          ) : meal.items.length === 0 ? (
                            <p className="mt-1 text-sm text-ink-2">Sem ingredientes ainda. Toque para montar.</p>
                          ) : (
                            <>
                              <MacroLine totals={totals} className="mt-1" />
                              <MacroBar totals={totals} className="mt-2.5 max-w-xs" />
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {meal.recipe && (
                                  <Badge>
                                    <Clock className="h-3 w-3" aria-hidden /> {meal.recipe.prepMinutes} min
                                  </Badge>
                                )}
                                {cost.priced && (
                                  <Badge tone={cost.complete ? "lime" : "amber"} title={cost.complete ? undefined : "Alguns ingredientes ainda sem preço"}>
                                    {formatBRL(cost.cents)}
                                    {!cost.complete && " (parcial)"}
                                  </Badge>
                                )}
                                {critical.length > 0 && (
                                  <Badge tone="danger">
                                    <TriangleAlert className="h-3 w-3" aria-hidden /> Conflita com {critical.join(", ")}
                                  </Badge>
                                )}
                                {meal.customized && <Badge tone="outline">personalizada</Badge>}
                                {meal.portionFactor !== 1 && <Badge tone="sky">porção ×{String(meal.portionFactor).replace(".", ",")}</Badge>}
                              </div>
                            </>
                          )}
                        </Link>
                        <MealCheck mealId={meal.id} completed={Boolean(meal.completedAt)} title={meal.title} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            <section aria-labelledby="fora-plano" className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="fora-plano" className="text-lg font-bold">
                  Fora do planejamento
                </h2>
                <LinkButton href={`/alimentacao/registrar?dia=${day}`} variant="ghost" size="sm">
                  <Plus className="h-4 w-4" aria-hidden /> Registrar
                </LinkButton>
              </div>
              {logs.length === 0 ? (
                <p className="text-sm text-ink-2">Comeu algo diferente do plano? Registre aqui, sem julgamentos.</p>
              ) : (
                <ul className="divide-y divide-line rounded-3xl border border-line">
                  {logs.map((log) => {
                    const t = roundTotals(mealTotals(log.items.map((i) => ({ facts: factsOf(i.food), grams: i.grams }))));
                    return (
                      <li key={log.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{log.title}</p>
                          <p className="text-sm text-ink-2">
                            {log.mealType ? `${MEAL_TYPE_LABEL[log.mealType]} · ` : ""}
                            {log.items.length ? `≈ ${formatInt(t.values.kcal)} kcal` : "sem detalhes nutricionais"}
                          </p>
                        </div>
                        <ActionForm action={deleteLogAction}>
                          <input type="hidden" name="logId" value={log.id} />
                          <SubmitButton variant="ghost" size="sm" pendingLabel="…">
                            Excluir
                          </SubmitButton>
                        </ActionForm>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </section>

          <aside aria-label="Resumo do dia" className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
            <div className="grain relative overflow-hidden rounded-[2rem] border border-line bg-surface p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">Total planejado do dia</p>
              <div className="mt-3 flex items-center gap-4">
                <ProgressRing
                  value={kcalProgress}
                  size={104}
                  stroke={9}
                  label={goal?.kcal ? `${Math.round((kcalProgress ?? 0) * 100)}% da meta de energia` : "Sem meta de energia"}
                >
                  <span className="font-display text-xl leading-none font-extrabold tabular">
                    {formatInt(selected.totals.values.kcal)}
                    <span className="block text-[0.65rem] font-semibold text-ink-3">kcal</span>
                  </span>
                </ProgressRing>
                <div className="text-sm text-ink-2">
                  {goal?.kcal ? (
                    <>
                      Meta: <strong className="text-ink">{formatInt(goal.kcal)} kcal</strong>
                      <span className="block text-xs">
                        {ctx.goalSource === "PROFESSIONAL" ? "informada pelo(a) nutricionista" : "registrada por você"}
                        {goal.derivedFromWeekly ? " · média diária da meta semanal" : ""}
                      </span>
                    </>
                  ) : (
                    <>Sem meta definida. Valores das porções de referência.</>
                  )}
                </div>
              </div>
              <MacroBar totals={selected.totals} className="mt-5" />
              <div className="mt-4">
                <MacroGrid totals={selected.totals} goal={goal} />
              </div>
              <IncompleteNote totals={selected.totals} className="mt-3" />
              <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-sm">
                <span className="text-ink-2">Concluídas</span>
                <span className="font-semibold tabular">
                  {selected.completed} de {selected.planned}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-ink-2">Custo estimado</span>
                <span className="font-semibold tabular">
                  {dayCost.priced ? `${formatBRL(dayCost.cents)}${dayCost.complete ? "" : "*"}` : "sem preços"}
                </span>
              </div>
              {!dayCost.complete && dayCost.priced && <p className="mt-1 text-xs text-ink-3">* parcial: há ingredientes sem preço.</p>}
              {isPast && selected.planned > selected.completed && (
                <p className="mt-3 text-xs text-ink-3">Dias passados ficam como estão. O que importa é a semana como um todo.</p>
              )}
            </div>

            {plan.notes.length > 0 && (
              <details className="rounded-3xl border border-amber/30 bg-amber-soft p-4 text-sm">
                <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-amber-text">
                  <TriangleAlert className="h-4 w-4" aria-hidden /> Avisos do plano ({plan.notes.length})
                </summary>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink">
                  {plan.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </details>
            )}

            <nav aria-label="Mais opções de alimentação" className="grid grid-cols-2 gap-2">
              {[
                { href: `/alimentacao/semana?dia=${day}`, label: "Visão da semana", icon: CalendarRange },
                { href: "/alimentacao/historico", label: "Histórico", icon: History },
                { href: "/alimentacao/alimentos", label: "Alimentos", icon: Search },
                { href: "/alimentacao/despensa", label: "Despensa", icon: Package },
                { href: "/alimentacao/receitas", label: "Receitas", icon: ChefHat },
                { href: "/compras", label: "Compras", icon: ShoppingBasket },
              ].map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="flex min-h-12 items-center gap-2 rounded-2xl border border-line px-3 text-sm font-semibold hover:bg-surface-2">
                  <Icon className="h-4 w-4 text-ink-2" aria-hidden /> {label}
                </Link>
              ))}
            </nav>

            <Dialog
              title="Gerar nova sugestão?"
              description="Criamos uma nova versão do plano desta semana. A versão atual fica guardada e pode ser restaurada."
              trigger={
                <>
                  <RefreshCw className="h-4 w-4" aria-hidden /> Nova sugestão semanal
                </>
              }
              triggerVariant="outline"
              triggerClassName="w-full"
            >
              <FormMessage className="mb-4">
                Refeições marcadas como concluídas continuam na versão anterior. Personalizações feitas nesta versão também ficam
                guardadas nela.
              </FormMessage>
              <ActionForm action={generatePlanAction} closeDialogOnSuccess>
                <input type="hidden" name="weekStart" value={weekStart} />
                <SubmitButton block pendingLabel="Montando…">
                  <Sparkles className="h-4 w-4" aria-hidden /> Gerar nova sugestão
                </SubmitButton>
              </ActionForm>
              <p className="mt-4 text-center text-sm">
                <Link href={`/alimentacao/semana?dia=${day}#versoes`} className="font-semibold text-lime-text hover:underline">
                  Ver versões anteriores
                </Link>
              </p>
            </Dialog>
            <SourceNote />
          </aside>
        </div>
      )}
    </>
  );
}
