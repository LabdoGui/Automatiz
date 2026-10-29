import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRightLeft, Clock, Copy, Pencil, Plus, Replace, ShieldAlert, Trash2, Zap } from "lucide-react";
import { addDays, fromDbDate, weekDates, weekdayIndex, WEEKDAY_LONG, WEEKDAY_SHORT } from "@/domain/dates";
import { formatBRL, formatDateLong, formatDec, formatInt } from "@/domain/format";
import { MEAL_TYPE_LABEL } from "@/domain/planner/meal-types";
import { foodConflicts } from "@/domain/restrictions/engine";
import { nutrientsForPortion, roundTotals } from "@/domain/nutrition/calc";
import { SUBSTITUTION_GROUPS } from "@/domain/nutrition/substitution";
import { KITCHEN_EQUIPMENT } from "@/domain/restrictions/vocabulary";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionForm, FormMessage } from "@/components/forms/action-form";
import { NumberField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { ChipCheckbox } from "@/components/forms/choices";
import { FoodPicker } from "@/components/food/food-picker";
import { MealCheck } from "@/components/planner/meal-check";
import { IncompleteNote, MacroBar, MacroGrid, SourceNote } from "@/components/nutrition/nutrients";
import { clockFor, requireOnboardedUser } from "@/server/session";
import { NotFoundError } from "@/server/action-utils";
import {
  compatibleRecipes,
  getMeal,
  mealCost,
  mealNutrition,
  mealSubstitutions,
  plannerContext,
} from "@/server/services/planner";
import { factsOf, foodLabel, STATE_LABEL } from "@/server/services/foods";
import { priceIndexByFood } from "@/server/services/prices";
import {
  addItemAction,
  deleteMealAction,
  duplicateMealAction,
  removeItemAction,
  replaceRecipeAction,
  substituteItemAction,
  updateItemAction,
  updateMealDetailsAction,
} from "@/server/actions/planner";

export const metadata: Metadata = { title: "Refeição" };

const equipmentLabel = (req: string) =>
  req
    .split("|")
    .map((t) => KITCHEN_EQUIPMENT.find((e) => e.tag === t)?.label ?? t)
    .join(" ou ");

export default async function MealPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, settings } = await requireOnboardedUser();
  const { today } = clockFor(settings);
  const { id } = await params;
  let meal;
  try {
    meal = await getMeal(user.id, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const date = fromDbDate(meal.date);
  const [ctx, prices, subs, alternatives] = await Promise.all([
    plannerContext(user.id),
    priceIndexByFood(user.id),
    mealSubstitutions(user.id, meal.items),
    compatibleRecipes(user.id, meal.mealType),
  ]);
  const totals = roundTotals(mealNutrition(meal));
  const cost = mealCost(meal.items, prices);
  const goal = ctx.dailyGoal;
  const weekStart = fromDbDate(meal.plan.weekStart);
  const otherDays = weekDates(weekStart).filter((d) => d !== date);

  return (
    <>
      <PageHeader
        backHref={`/alimentacao?dia=${date}`}
        backLabel="Voltar ao dia"
        eyebrow={`${MEAL_TYPE_LABEL[meal.mealType]} · ${WEEKDAY_LONG[weekdayIndex(date)]}, ${formatDateLong(date)}`}
        title={meal.title}
        description={
          meal.time ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden /> {meal.time}
              {meal.recipe && ` · preparo de ${meal.recipe.prepMinutes} min`}
            </span>
          ) : undefined
        }
        actions={<MealCheck mealId={meal.id} completed={Boolean(meal.completedAt)} title={meal.title} size="lg" />}
      />

      {meal.isFlexible && meal.items.length === 0 && (
        <FormMessage className="mb-6">
          Refeição flexível: um momento livre, sem metas e sem compensações depois. Se quiser, adicione o que comeu para
          acompanhar — é opcional.
        </FormMessage>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_19rem]">
        <div className="min-w-0">
          <section aria-labelledby="ingredientes">
            <SectionTitle id="ingredientes">Ingredientes</SectionTitle>
            {meal.items.length === 0 ? (
              <EmptyState title="Nenhum ingrediente" className="mb-4">
                Busque alimentos abaixo para montar esta refeição.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line">
                {meal.items.map((item) => {
                  const t = roundTotals(nutrientsForPortion(factsOf(item.food), item.grams));
                  const conflicts = foodConflicts(item.food, ctx.rules).filter((c) => c.level === "critical");
                  const options = subs.get(item.id) ?? [];
                  return (
                    <li key={item.id} className="bg-surface px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {foodLabel(item.food)}
                            <span className="ml-2 align-middle">
                              <Badge tone="outline">{STATE_LABEL[item.food.state]}</Badge>
                            </span>
                          </p>
                          <p className="mt-0.5 text-sm text-ink-2 tabular">
                            {formatInt(item.grams)} g{item.householdMeasure ? ` · ${item.householdMeasure}` : ""} · ≈ {formatInt(t.values.kcal)}
                            {t.incomplete.includes("kcal") ? "*" : ""} kcal · P {formatDec(t.values.proteinG)} g
                          </p>
                          {conflicts.length > 0 && (
                            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger-text">
                              <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Conflita com {conflicts.map((c) => c.label).join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Dialog
                            title={`Ajustar ${foodLabel(item.food)}`}
                            trigger={<Pencil className="h-4 w-4" aria-hidden />}
                            triggerLabel={`Ajustar quantidade de ${foodLabel(item.food)}`}
                            triggerVariant="ghost"
                            triggerSize="icon-sm"
                          >
                            <ActionForm action={updateItemAction} closeDialogOnSuccess className="flex flex-col gap-4">
                              <input type="hidden" name="itemId" value={item.id} />
                              <NumberField name="grams" label="Quantidade" decimal defaultValue={String(item.grams)} suffix="g" hint={`Peso ${STATE_LABEL[item.food.state]}.`} />
                              <SubmitButton block>Salvar quantidade</SubmitButton>
                            </ActionForm>
                          </Dialog>
                          <Dialog
                            title={`Substituir ${foodLabel(item.food)}`}
                            description={
                              item.food.substitutionGroup
                                ? `Opções do grupo ${SUBSTITUTION_GROUPS[item.food.substitutionGroup]?.label.toLowerCase() ?? ""}, com quantidade equivalente e compatíveis com seu perfil.`
                                : "Busque outro alimento para colocar no lugar."
                            }
                            trigger={<ArrowRightLeft className="h-4 w-4" aria-hidden />}
                            triggerLabel={`Substituir ${foodLabel(item.food)}`}
                            triggerVariant="ghost"
                            triggerSize="icon-sm"
                          >
                            {options.length > 0 && (
                              <ul className="mb-5 divide-y divide-line rounded-2xl border border-line">
                                {options.map((o) => (
                                  <li key={o.food.id} className="flex items-center gap-3 px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold">{o.food.shortName ?? o.food.name}</p>
                                      <p className="text-xs text-ink-2">
                                        {formatInt(o.grams)} g equivalentes
                                        {o.basis !== "grams" && ` (mesma quantidade de ${{ kcal: "energia", proteinG: "proteína", carbsG: "carboidrato", fatG: "gordura", fiberG: "fibra" }[o.basis]})`}
                                        {o.costCents !== null && ` · ${formatBRL(o.costCents)}`}
                                        {o.unusual && " · quantidade bem diferente"}
                                      </p>
                                    </div>
                                    <ActionForm action={substituteItemAction} closeDialogOnSuccess>
                                      <input type="hidden" name="itemId" value={item.id} />
                                      <input type="hidden" name="foodId" value={o.food.id} />
                                      <SubmitButton size="sm" variant="secondary" pendingLabel="…">
                                        Trocar
                                      </SubmitButton>
                                    </ActionForm>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <ActionForm action={substituteItemAction} closeDialogOnSuccess className="flex flex-col gap-3">
                              <input type="hidden" name="itemId" value={item.id} />
                              <FoodPicker label="Ou escolha qualquer alimento" />
                              <p className="text-xs text-ink-3">A quantidade é ajustada automaticamente quando os alimentos são do mesmo grupo; caso contrário, mantemos os mesmos gramas.</p>
                              <SubmitButton variant="secondary" block>
                                Substituir
                              </SubmitButton>
                            </ActionForm>
                          </Dialog>
                          <ActionForm action={removeItemAction}>
                            <input type="hidden" name="itemId" value={item.id} />
                            <SubmitButton variant="ghost" size="icon-sm" pendingLabel="">
                              <Trash2 className="h-4 w-4" aria-hidden />
                              <span className="sr-only">Remover {foodLabel(item.food)}</span>
                            </SubmitButton>
                          </ActionForm>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <details className="group mt-3 rounded-3xl border border-dashed border-line-strong p-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
                <Plus className="h-4 w-4" aria-hidden /> Adicionar ingrediente
              </summary>
              <ActionForm action={addItemAction} resetOnSuccess className="mt-4 flex flex-col gap-4">
                <input type="hidden" name="mealId" value={meal.id} />
                <FoodPicker />
                <NumberField name="grams" label="Quantidade" decimal suffix="g" placeholder="100" />
                <SubmitButton>Adicionar</SubmitButton>
              </ActionForm>
            </details>
          </section>

          {meal.recipe && meal.recipe.steps.length > 0 && (
            <section aria-labelledby="preparo" className="mt-8">
              <SectionTitle id="preparo">Modo de preparo</SectionTitle>
              {meal.customized && (
                <p className="mb-3 text-sm text-amber-text">Você alterou os ingredientes; os passos são os da receita original.</p>
              )}
              <ol className="flex flex-col gap-3">
                {meal.recipe.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 font-display text-sm font-bold">{i + 1}</span>
                    <p className="pt-0.5">{step}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>
                  <Clock className="h-3 w-3" aria-hidden /> {meal.recipe.prepMinutes} min
                </Badge>
                {meal.recipe.equipment.map((e) => (
                  <Badge key={e} tone="outline">
                    {equipmentLabel(e)}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {meal.notes && (
            <section className="mt-8">
              <SectionTitle>Observações</SectionTitle>
              <p className="whitespace-pre-line text-ink-2">{meal.notes}</p>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start" aria-label="Nutrição e ações">
          <div className="rounded-[2rem] border border-line bg-surface p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">Estimativa da porção</p>
            <p className="mt-2 font-display text-5xl leading-none font-extrabold tabular">
              {formatInt(totals.values.kcal)}
              <span className="ml-1 text-base font-semibold text-ink-3">kcal</span>
            </p>
            {goal?.kcal && totals.values.kcal > 0 && (
              <p className="mt-1 text-sm text-ink-2">≈ {Math.round((totals.values.kcal / goal.kcal) * 100)}% da meta diária</p>
            )}
            <MacroBar totals={totals} className="mt-4" />
            <div className="mt-4">
              <MacroGrid totals={totals} />
            </div>
            <IncompleteNote totals={totals} className="mt-3" />
            <div className="mt-4 border-t border-line pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-2">Custo da porção</span>
                <span className="font-semibold tabular">{cost.priced ? `${formatBRL(cost.cents)}${cost.complete ? "" : "*"}` : "sem preços"}</span>
              </div>
              <p className="mt-1 text-xs text-ink-3">
                {cost.priced
                  ? cost.complete
                    ? "Proporcional à quantidade usada, com seus preços mais recentes."
                    : "* Parcial: alguns ingredientes ainda não têm preço."
                  : "Cadastre preços na lista de compras para ver o custo."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Dialog
              title="Duplicar em outros dias"
              description="Copie esta refeição, com os mesmos ingredientes, para outros dias desta semana."
              trigger={
                <>
                  <Copy className="h-4 w-4" aria-hidden /> Duplicar
                </>
              }
              triggerSize="sm"
            >
              <ActionForm action={duplicateMealAction} closeDialogOnSuccess className="flex flex-col gap-5">
                <input type="hidden" name="mealId" value={meal.id} />
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Dias</legend>
                  <div className="flex flex-wrap gap-2">
                    {otherDays.map((d) => (
                      <ChipCheckbox key={d} name="dates" value={d} label={`${WEEKDAY_SHORT[weekdayIndex(d)]} ${Number(d.slice(8))}`} />
                    ))}
                  </div>
                </fieldset>
                <SubmitButton block>Duplicar refeição</SubmitButton>
              </ActionForm>
            </Dialog>
            <Dialog
              title="Trocar a refeição"
              description="Receitas compatíveis com seu perfil para este horário, das mais rápidas às mais demoradas."
              trigger={
                <>
                  <Replace className="h-4 w-4" aria-hidden /> Trocar
                </>
              }
              triggerSize="sm"
            >
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {alternatives
                  .filter((r) => r.id !== meal.recipeId)
                  .map((r, i) => (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{r.name}</p>
                        <p className="text-xs text-ink-2">
                          {r.prepMinutes} min · ≈ {formatInt(r.totals.values.kcal)} kcal
                          {i === 0 && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-lime-text">
                              <Zap className="h-3 w-3" aria-hidden /> mais rápida
                            </span>
                          )}
                        </p>
                      </div>
                      <ActionForm action={replaceRecipeAction} closeDialogOnSuccess>
                        <input type="hidden" name="mealId" value={meal.id} />
                        <input type="hidden" name="recipeId" value={r.id} />
                        <SubmitButton size="sm" variant="secondary" pendingLabel="…">
                          Usar
                        </SubmitButton>
                      </ActionForm>
                    </li>
                  ))}
              </ul>
            </Dialog>
            <Dialog
              title="Editar refeição"
              trigger={
                <>
                  <Pencil className="h-4 w-4" aria-hidden /> Editar
                </>
              }
              triggerSize="sm"
            >
              <ActionForm action={updateMealDetailsAction} closeDialogOnSuccess className="flex flex-col gap-4">
                <input type="hidden" name="mealId" value={meal.id} />
                <TextField name="title" label="Nome" defaultValue={meal.title} maxLength={80} />
                <TextField name="time" label="Horário" type="time" defaultValue={meal.time ?? ""} />
                <TextAreaField name="notes" label="Observações" defaultValue={meal.notes ?? ""} maxLength={400} />
                <SubmitButton block>Salvar</SubmitButton>
              </ActionForm>
            </Dialog>
            <Dialog
              title="Remover esta refeição?"
              description="Ela sai do plano desta semana. Esta ação não pode ser desfeita."
              trigger={
                <>
                  <Trash2 className="h-4 w-4" aria-hidden /> Remover
                </>
              }
              triggerVariant="danger"
              triggerSize="sm"
            >
              <ActionForm action={deleteMealAction} redirectTo={`/alimentacao?dia=${date}`}>
                <input type="hidden" name="mealId" value={meal.id} />
                <SubmitButton variant="danger" block>
                  Sim, remover refeição
                </SubmitButton>
              </ActionForm>
            </Dialog>
          </div>
          {date < today && !meal.completedAt && (
            <p className="text-xs text-ink-3">Este dia já passou. Marque como concluída se fez esta refeição — ou deixe como está.</p>
          )}
          <p className="text-xs text-ink-3">Semana de {formatDateLong(weekStart)} a {formatDateLong(addDays(weekStart, 6))}.</p>
          <SourceNote />
        </aside>
      </div>
    </>
  );
}
