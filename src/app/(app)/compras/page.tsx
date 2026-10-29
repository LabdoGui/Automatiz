import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeDollarSign,
  CalendarRange,
  CircleCheckBig,
  Lightbulb,
  MoreHorizontal,
  PackageCheck,
  Plus,
  ReceiptText,
  RefreshCw,
  Tags,
  Trash2,
} from "lucide-react";
import { addDays, fromDbDate, startOfWeek, toDbDate } from "@/domain/dates";
import { formatBRL, formatDateBR, formatDateLong, formatGrams, formatInt } from "@/domain/format";
import type { LineResult } from "@/domain/pricing/pricing";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import { ActionForm, FormMessage } from "@/components/forms/action-form";
import { NumberField, SubmitButton, TextField } from "@/components/forms/fields";
import { PurchaseToggle } from "@/components/shopping/purchase-toggle";
import { cn } from "@/components/ui/cn";
import { clockFor, requireOnboardedUser } from "@/server/session";
import { db } from "@/server/db";
import { getOpenList, listSummary, savingTips, type ShoppingItem } from "@/server/services/shopping";
import { PRICE_SOURCE_LABEL } from "@/server/services/prices";
import { plannerContext } from "@/server/services/planner";
import { foodLabel } from "@/server/services/foods";
import {
  addManualItemAction,
  completeListAction,
  generateListAction,
  removeListItemAction,
  setItemPriceAction,
  setPackagesAction,
  setPaidAction,
} from "@/server/actions/shopping";
import { applySavingTipAction } from "@/server/actions/planner";

export const metadata: Metadata = { title: "Lista de compras" };

function quantityText(item: ShoppingItem, line: LineResult): string {
  if (item.isManual) return item.requiredG ? formatGrams(item.requiredG) : "quantidade livre";
  if (line.toBuyG === 0) return "já tem em casa";
  if (item.soldByWeight) return `comprar ≈ ${formatGrams(line.purchasedG ?? line.toBuyG)} (a granel)`;
  if (line.packages !== null && item.packageSize && item.packageUnit) {
    const pkg = item.packageUnit === "UNIT" ? `${formatInt(item.packageSize)} un.` : item.packageUnit === "ML" ? `${formatInt(item.packageSize)} ml` : formatGrams(item.packageSize);
    return `${line.packages} × embalagem de ${pkg}${item.manualPackages !== null ? " (ajustado)" : ""}`;
  }
  return `comprar ≈ ${formatGrams(line.toBuyG)}`;
}

export default async function ShoppingPage() {
  const { user, settings, profile } = await requireOnboardedUser();
  const { today } = clockFor(settings);
  const weekStart = startOfWeek(today);
  const [list, plan, ctx, pastLists] = await Promise.all([
    getOpenList(user.id),
    db.mealPlan.findFirst({ where: { userId: user.id, weekStart: toDbDate(weekStart), status: "ACTIVE" }, select: { id: true } }),
    plannerContext(user.id),
    db.shoppingList.count({ where: { userId: user.id, status: "DONE" } }),
  ]);
  const tips = list?.planId ? await savingTips(user.id, list.planId, today) : [];
  const summary = list ? listSummary(list) : null;

  const generate = (label: string, variant: "primary" | "secondary" = "primary") => (
    <ActionForm action={generateListAction}>
      <SubmitButton variant={variant} size={variant === "primary" ? "md" : "sm"} pendingLabel="Calculando…">
        <RefreshCw className="h-4 w-4" aria-hidden /> {label}
      </SubmitButton>
    </ActionForm>
  );

  const groups = new Map<string, NonNullable<typeof summary>["lines"]>();
  for (const l of summary?.lines ?? []) {
    if (!l.item.isManual && l.line.toBuyG === 0) continue;
    const key = l.item.category;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  const covered = summary?.lines.filter((l) => !l.item.isManual && l.line.toBuyG === 0) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Compras"
        title="Lista de compras"
        description={
          list
            ? `Para as refeições de ${formatDateLong(fromDbDate(list.periodStart))} a ${formatDateLong(fromDbDate(list.periodEnd))}.`
            : "Gerada a partir do seu planejamento, com embalagens, despensa e orçamento."
        }
        actions={
          <LinkButton href="/compras/precos" variant="secondary" size="sm">
            <Tags className="h-4 w-4" aria-hidden /> Preços
          </LinkButton>
        }
      />

      {!list || !summary ? (
        plan ? (
          <EmptyState icon={<ReceiptText className="h-6 w-6" aria-hidden />} title="Nenhuma lista aberta" action={generate("Gerar lista da semana")}>
            Consolidamos os ingredientes das refeições pendentes, convertemos preparados em itens de mercado e descontamos sua
            despensa.
          </EmptyState>
        ) : (
          <EmptyState
            icon={<CalendarRange className="h-6 w-6" aria-hidden />}
            title="Primeiro, o planejamento"
            action={<LinkButton href="/alimentacao">Ir para a alimentação</LinkButton>}
          >
            A lista de compras nasce do plano da semana. Gere o plano e volte aqui.
          </EmptyState>
        )
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink-2">
                <strong className="text-ink">{summary.pending}</strong> a comprar · {summary.lines.filter((l) => l.item.purchased).length} comprados
              </p>
              <div className="flex gap-2">
                <Dialog
                  title="Adicionar item"
                  description="Algo fora do plano, como produtos de limpeza."
                  trigger={
                    <>
                      <Plus className="h-4 w-4" aria-hidden /> Item
                    </>
                  }
                  triggerSize="sm"
                >
                  <ActionForm action={addManualItemAction} closeDialogOnSuccess className="flex flex-col gap-4">
                    <input type="hidden" name="listId" value={list.id} />
                    <TextField name="name" label="Item" maxLength={60} />
                    <div className="grid grid-cols-2 gap-3">
                      <NumberField name="quantityG" label="Quantidade (opcional)" decimal suffix="g" />
                      <TextField name="price" label="Preço (opcional)" inputMode="decimal" suffix="R$" />
                    </div>
                    <SubmitButton block>Adicionar à lista</SubmitButton>
                  </ActionForm>
                </Dialog>
                {generate("Atualizar", "secondary")}
              </div>
            </div>

            {/* Cupom */}
            <div className="receipt-edge rounded-t-[1.75rem] bg-surface px-4 pt-5 sm:px-6">
              {[...groups.entries()].map(([category, lines]) => (
                <section key={category} aria-labelledby={`cat-${category}`} className="mb-5">
                  <h2 id={`cat-${category}`} className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-ink-3">
                    {category}
                  </h2>
                  <ul className="divide-y divide-dashed divide-line-strong">
                    {lines.map(({ item, line }) => (
                      <li key={item.id} className={cn("flex items-start gap-3 py-3", item.purchased && "opacity-60")}>
                        <PurchaseToggle itemId={item.id} purchased={item.purchased} name={item.name} />
                        <div className="min-w-0 flex-1">
                          <p className={cn("font-semibold", item.purchased && "line-through decoration-2")}>{item.name}</p>
                          <p className="text-sm text-ink-2">{quantityText(item, line)}</p>
                          {!item.isManual && (
                            <p className="text-xs text-ink-3 tabular">
                              plano usa {formatGrams(item.requiredG)}
                              {item.pantryG > 0 && ` · em casa ${formatGrams(item.pantryG)}`}
                              {line.leftoverG !== null && line.leftoverG > 0 && ` · sobra ≈ ${formatGrams(line.leftoverG)}`}
                            </p>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {item.unitPriceCents !== null && item.priceSource ? (
                              <Badge wrap tone={item.priceSource === "DEMO" ? "amber" : item.priceSource === "INTEGRATION" ? "lime" : "neutral"}>
                                {formatBRL(item.unitPriceCents)}
                                {item.soldByWeight ? "/kg" : ""} · {PRICE_SOURCE_LABEL[item.priceSource].toLowerCase()}
                                {item.priceDate ? ` em ${formatDateBR(fromDbDate(item.priceDate))}` : ""}
                                {item.priceStore ? ` · ${item.priceStore}` : ""}
                              </Badge>
                            ) : (
                              <Badge tone="amber">sem preço</Badge>
                            )}
                            {item.purchased && item.paidCents !== null && <Badge tone="lime">pago {formatBRL(item.paidCents)}</Badge>}
                            {item.notes && <span className="text-xs text-ink-3">{item.notes}</span>}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="font-display font-bold tabular">{line.purchaseCents !== null ? formatBRL(line.purchaseCents) : "—"}</span>
                          <Dialog
                            title={item.name}
                            description="Preço, quantidade e valor pago"
                            trigger={<MoreHorizontal className="h-4 w-4" aria-hidden />}
                            triggerLabel={`Opções de ${item.name}`}
                            triggerVariant="ghost"
                            triggerSize="icon-sm"
                          >
                            <div className="flex flex-col gap-6">
                              {item.productId && (
                                <ActionForm action={setItemPriceAction} closeDialogOnSuccess className="flex flex-col gap-3">
                                  <h3 className="font-bold">Informar preço {item.soldByWeight ? "por kg" : "da embalagem"}</h3>
                                  <input type="hidden" name="itemId" value={item.id} />
                                  <div className="grid grid-cols-2 gap-3">
                                    <TextField name="price" label="Preço" inputMode="decimal" suffix="R$" placeholder="0,00" />
                                    <TextField name="store" label="Loja (opcional)" maxLength={80} defaultValue={item.priceStore ?? ""} />
                                  </div>
                                  <SubmitButton variant="secondary">Salvar preço</SubmitButton>
                                </ActionForm>
                              )}
                              <ActionForm action={setPaidAction} closeDialogOnSuccess className="flex flex-col gap-3">
                                <h3 className="font-bold">Valor pago no caixa</h3>
                                <input type="hidden" name="itemId" value={item.id} />
                                <TextField name="paid" label="Total pago por este item" inputMode="decimal" suffix="R$" placeholder="0,00" defaultValue={item.paidCents ? (item.paidCents / 100).toFixed(2).replace(".", ",") : ""} />
                                <SubmitButton variant="secondary">Marcar como comprado</SubmitButton>
                              </ActionForm>
                              {!item.soldByWeight && line.packages !== null && (
                                <ActionForm action={setPackagesAction} closeDialogOnSuccess className="flex flex-col gap-3">
                                  <h3 className="font-bold">Quantidade de embalagens</h3>
                                  <input type="hidden" name="itemId" value={item.id} />
                                  <NumberField name="packages" label="Embalagens" defaultValue={item.manualPackages !== null ? String(item.manualPackages) : ""} hint="Deixe em branco para voltar ao cálculo automático." />
                                  <SubmitButton variant="secondary">Ajustar</SubmitButton>
                                </ActionForm>
                              )}
                              <ActionForm action={removeListItemAction} closeDialogOnSuccess>
                                <input type="hidden" name="itemId" value={item.id} />
                                <SubmitButton variant="danger" block>
                                  <Trash2 className="h-4 w-4" aria-hidden /> Remover da lista
                                </SubmitButton>
                              </ActionForm>
                            </div>
                          </Dialog>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {groups.size === 0 && <p className="py-6 text-center text-sm text-ink-2">Tudo o que o plano precisa já está em casa.</p>}

              <dl className="mt-2 border-t-2 border-dashed border-line-strong pt-4 text-sm tabular">
                <div className="flex items-baseline gap-2 py-1">
                  <dt className="text-ink-2">Consumo previsto do plano</dt>
                  <span className="dotted-leader" aria-hidden />
                  <dd>{formatBRL(summary.consumedCents)}</dd>
                </div>
                <div className="flex items-baseline gap-2 py-1">
                  <dt className="text-ink-2">Carrinho (embalagens completas)</dt>
                  <span className="dotted-leader" aria-hidden />
                  <dd className="font-display text-lg font-extrabold">{formatBRL(summary.budget.estimatedCents)}</dd>
                </div>
                <div className="flex items-baseline gap-2 py-1">
                  <dt className="text-ink-2">Pago até agora</dt>
                  <span className="dotted-leader" aria-hidden />
                  <dd>{formatBRL(summary.budget.paidCents)}</dd>
                </div>
              </dl>
              {summary.budget.missingPrices > 0 && (
                <p className="mt-2 text-xs text-amber-text">
                  {summary.budget.missingPrices} {summary.budget.missingPrices === 1 ? "item sem preço não entra" : "itens sem preço não entram"} nos totais. Informe o preço pelo menu “…” de cada item.
                </p>
              )}
            </div>

            {covered.length > 0 && (
              <details className="mt-6 rounded-3xl border border-line p-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
                  <PackageCheck className="h-4 w-4 text-lime-text" aria-hidden /> Já tem em casa ({covered.length})
                </summary>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {covered.map(({ item }) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span>{item.name}</span>
                      <span className="text-ink-2 tabular">
                        precisa {formatGrams(item.requiredG)} · tem {formatGrams(item.pantryG)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start" aria-label="Orçamento">
            <div className={cn("rounded-[2rem] border p-5", summary.budget.overBudget ? "border-danger/40 bg-danger-soft" : "border-line bg-surface")}>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                <BadgeDollarSign className="h-4 w-4" aria-hidden /> Orçamento da semana
              </p>
              {summary.budget.budgetCents !== null ? (
                <>
                  <p className="mt-2 font-display text-4xl font-extrabold tabular">{formatBRL(summary.budget.budgetCents)}</p>
                  {profile.budgetPeriod && profile.budgetPeriod !== "WEEK" && (
                    <p className="text-xs text-ink-3">
                      equivalente semanal de {formatBRL(profile.budgetCents!)} por {profile.budgetPeriod === "DAY" ? "dia" : "mês"}
                    </p>
                  )}
                  <Meter className="mt-4" value={summary.budget.usage ?? 0} tone={summary.budget.overBudget ? "danger" : summary.budget.usage && summary.budget.usage > 0.85 ? "amber" : "lime"} label="Uso do orçamento" />
                  <dl className="mt-4 space-y-1.5 text-sm tabular">
                    <div className="flex justify-between">
                      <dt className="text-ink-2">Estimado do carrinho</dt>
                      <dd>{formatBRL(summary.budget.estimatedCents)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-2">Pago</dt>
                      <dd>{formatBRL(summary.budget.paidCents)}</dd>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <dt>{summary.budget.overBudget ? "Acima do orçamento" : "Saldo estimado"}</dt>
                      <dd className={summary.budget.overBudget ? "text-danger-text" : "text-lime-text"}>{formatBRL(Math.abs(summary.budget.remainingCents ?? 0))}</dd>
                    </div>
                  </dl>
                  {summary.budget.missingPrices > 0 && <p className="mt-2 text-xs text-ink-3">O saldo é parcial enquanto houver itens sem preço.</p>}
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-2">
                  Sem orçamento definido.{" "}
                  <Link href="/perfil#orcamento" className="font-semibold text-lime-text hover:underline">
                    Definir no perfil
                  </Link>
                </p>
              )}
            </div>

            {tips.length > 0 && (
              <section aria-labelledby="economia" className="rounded-[2rem] border border-line p-5">
                <h2 id="economia" className="flex items-center gap-2 font-bold">
                  <Lightbulb className="h-4 w-4 text-amber-text" aria-hidden /> Sugestões de economia
                </h2>
                <p className="mt-1 text-xs text-ink-3">Trocas no mesmo grupo nutricional, compatíveis com seu perfil, usando seus preços.</p>
                <ul className="mt-3 flex flex-col gap-3">
                  {tips.map((t) => (
                    <li key={`${t.fromFood.id}-${t.toFood.id}`} className="rounded-2xl bg-surface-2 p-3 text-sm">
                      <p>
                        Trocar <strong>{foodLabel(t.fromFood)}</strong> por <strong>{foodLabel(t.toFood)}</strong>
                      </p>
                      <p className="text-xs text-ink-2">
                        economia estimada de {formatBRL(t.savingsCents)} em {t.occurrences} {t.occurrences === 1 ? "porção" : "porções"}
                      </p>
                      <ActionForm action={applySavingTipAction} className="mt-2">
                        <input type="hidden" name="planId" value={list.planId!} />
                        <input type="hidden" name="fromFoodId" value={t.fromFood.id} />
                        <input type="hidden" name="toFoodId" value={t.toFood.id} />
                        <SubmitButton size="sm" variant="secondary" pendingLabel="Aplicando…">
                          Aplicar no plano
                        </SubmitButton>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {summary.budget.overBudget && tips.length === 0 && (
              <FormMessage tone="warning">
                Sem sugestões automáticas por enquanto: cadastre preços de mais produtos para comparar alternativas do mesmo grupo
                ({ctx.rules.hasAllergy ? "sempre respeitando suas alergias" : "respeitando suas restrições"}).
              </FormMessage>
            )}

            <Dialog
              title="Finalizar esta lista?"
              description="Ela vai para o histórico e libera espaço para a próxima."
              trigger={
                <>
                  <CircleCheckBig className="h-4 w-4" aria-hidden /> Finalizar lista
                </>
              }
              triggerVariant="primary"
              triggerClassName="w-full"
            >
              <ActionForm action={completeListAction} closeDialogOnSuccess className="flex flex-col gap-4">
                <input type="hidden" name="listId" value={list.id} />
                <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-sm">
                  <input type="checkbox" name="addLeftovers" defaultChecked className="mt-0.5 h-5 w-5 accent-[var(--lime)]" />
                  <span>
                    Somar à despensa as <strong>sobras estimadas</strong> dos itens comprados (ex.: ovos que sobram da bandeja).
                  </span>
                </label>
                <SubmitButton block>Finalizar</SubmitButton>
              </ActionForm>
            </Dialog>
            {pastLists > 0 && (
              <Link href="/progresso#gastos" className="text-center text-sm font-semibold text-lime-text hover:underline">
                Ver gastos das listas anteriores
              </Link>
            )}
            <p className="text-xs text-ink-3">
              O VIVA não consulta preços de lojas automaticamente. Valores vêm do que você informa, importa ou paga — sempre com
              origem e data. Semana de {formatDateLong(weekStart)} a {formatDateLong(addDays(weekStart, 6))}.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
