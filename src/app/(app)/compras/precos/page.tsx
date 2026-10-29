import type { Metadata } from "next";
import { Plus, Search, Trash2 } from "lucide-react";
import { fromDbDate } from "@/domain/dates";
import { formatBRL, formatDateBR, formatGrams, formatInt } from "@/domain/format";
import { normalizeText } from "@/domain/restrictions/engine";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { ActionForm, FormMessage } from "@/components/forms/action-form";
import { NumberField, SelectField, SubmitButton, TextField } from "@/components/forms/fields";
import { FoodPicker } from "@/components/food/food-picker";
import { ImportPricesForm } from "@/components/shopping/import-prices";
import { clockFor, requireOnboardedUser } from "@/server/session";
import { db } from "@/server/db";
import { comparablePricePerKg, latestPrices, PRICE_SOURCE_LABEL, PRODUCT_SELECT, visibleProductsWhere } from "@/server/services/prices";
import { addPriceAction, createProductAction, deletePriceAction } from "@/server/actions/shopping";
import { configuredPriceProviders } from "@/server/integrations/price-providers";

export const metadata: Metadata = { title: "Preços" };

function packageText(p: { packageSize: number; packageUnit: string; soldByWeight: boolean }) {
  if (p.soldByWeight) return "a granel (preço por kg)";
  if (p.packageUnit === "UNIT") return `${formatInt(p.packageSize)} unidades`;
  if (p.packageUnit === "ML") return `${formatInt(p.packageSize)} ml`;
  return formatGrams(p.packageSize);
}

export default async function PricesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { user, settings } = await requireOnboardedUser();
  const { today } = clockFor(settings);
  const { q = "" } = await searchParams;
  const providers = configuredPriceProviders();
  const [products, latest, history] = await Promise.all([
    db.product.findMany({ where: visibleProductsWhere(user.id), select: PRODUCT_SELECT, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    latestPrices(user.id),
    db.priceRecord.findMany({ where: { userId: user.id }, orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }], take: 400 }),
  ]);
  const needle = normalizeText(q);
  const filtered = needle ? products.filter((p) => normalizeText(p.name).includes(needle)) : products;
  const perKg = new Map(products.map((p) => [p.id, latest.has(p.id) ? comparablePricePerKg(p, latest.get(p.id)!.priceCents) : null]));
  // Produto mais barato por kg entre os que representam o mesmo alimento.
  const cheapest = new Map<string, string>();
  for (const p of products) {
    const v = perKg.get(p.id);
    if (v === null || v === undefined) continue;
    const current = cheapest.get(p.foodId);
    if (!current || (perKg.get(current) ?? Infinity) > v) cheapest.set(p.foodId, p.id);
  }
  const multiPriced = new Set(
    [...cheapest.keys()].filter((foodId) => products.filter((p) => p.foodId === foodId && perKg.get(p.id) !== null && perKg.get(p.id) !== undefined).length > 1),
  );
  const categories = [...new Set(filtered.map((p) => p.category))];

  return (
    <>
      <PageHeader
        backHref="/compras"
        eyebrow="Compras"
        title="Preços"
        description="Seus preços alimentam o custo das refeições e o orçamento. Nada aqui é cotação automática: cada valor mostra origem e data."
        actions={
          <Dialog
            title="Novo produto"
            description="Ex.: uma marca específica ou outro tamanho de embalagem."
            trigger={
              <>
                <Plus className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Produto</span>
              </>
            }
            triggerLabel="Criar produto"
            triggerSize="sm"
          >
            <ActionForm action={createProductAction} closeDialogOnSuccess className="flex flex-col gap-4">
              <TextField name="name" label="Nome do produto" maxLength={80} placeholder="Ex.: Arroz Marca X — 1 kg" />
              <TextField name="brand" label="Marca (opcional)" maxLength={60} />
              <FoodPicker label="Alimento correspondente (como é comprado)" placeholder="Ex.: arroz cru" />
              <div className="grid grid-cols-2 gap-3">
                <NumberField name="packageSize" label="Tamanho" decimal />
                <SelectField name="packageUnit" label="Unidade" defaultValue="G">
                  <option value="G">gramas</option>
                  <option value="ML">ml</option>
                  <option value="UNIT">unidades</option>
                </SelectField>
                <NumberField name="unitWeightG" label="Peso por unidade" decimal suffix="g" hint="Só para unidades." />
                <NumberField name="densityGPerMl" label="Densidade" decimal suffix="g/ml" hint="Só para ml." />
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="soldByWeight" className="h-5 w-5 accent-[var(--lime)]" /> Vendido a granel (preço por kg)
              </label>
              <SubmitButton block>Criar produto</SubmitButton>
            </ActionForm>
          </Dialog>
        }
      />

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="importar" className="rounded-3xl border border-line p-5">
          <h2 id="importar" className="mb-3 text-lg font-bold">
            Importar planilha
          </h2>
          <ImportPricesForm />
        </section>
        <FormMessage>
          {providers.length === 0
            ? "Nenhuma integração de preços está configurada nesta instalação, então nenhum preço é buscado na internet. Quando houver uma fonte autorizada, os valores aparecerão com origem “Confirmado pela integração”, loja e data."
            : `Integrações configuradas: ${providers.map((p) => p.name).join(", ")}. Preços vindos delas aparecem com origem “Confirmado pela integração”, loja e data.`}
        </FormMessage>
      </div>

      <form role="search" action="/compras/precos" className="mb-6">
        <label htmlFor="busca-preco" className="sr-only">
          Filtrar produtos
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input id="busca-preco" name="q" defaultValue={q} placeholder="Filtrar produtos" className="h-12 w-full rounded-2xl border border-line bg-surface-2 pr-4 pl-11" />
        </div>
      </form>

      {categories.map((cat) => (
        <section key={cat} aria-labelledby={`c-${cat}`} className="mb-8">
          <SectionTitle id={`c-${cat}`}>{cat}</SectionTitle>
          <ul className="divide-y divide-line rounded-3xl border border-line">
            {filtered
              .filter((p) => p.category === cat)
              .map((p) => {
                const last = latest.get(p.id);
                const kg = perKg.get(p.id);
                const records = history.filter((h) => h.productId === p.id);
                return (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {p.name} {p.ownerId && <Badge tone="outline">seu produto</Badge>}
                        </p>
                        <p className="text-xs text-ink-2">
                          {packageText(p)}
                          {p.unitWeightG && p.packageUnit === "UNIT" ? ` · ≈ ${formatInt(p.unitWeightG)} g por unidade (aproximado)` : ""}
                        </p>
                        {last ? (
                          <p className="mt-1 text-sm tabular">
                            <strong>{formatBRL(last.priceCents)}</strong>
                            {p.soldByWeight ? "/kg" : ""}
                            {kg !== null && kg !== undefined && !p.soldByWeight && <span className="text-ink-2"> · {formatBRL(kg)}/kg</span>}
                            <span className="text-xs text-ink-3">
                              {" "}
                              · {PRICE_SOURCE_LABEL[last.source].toLowerCase()} em {formatDateBR(fromDbDate(last.observedAt))}
                              {last.storeName ? ` · ${last.storeName}` : ""}
                            </span>
                            {cheapest.get(p.foodId) === p.id && multiPriced.has(p.foodId) && (
                              <span className="ml-2 align-middle">
                                <Badge tone="lime">mais barato por kg</Badge>
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-ink-3">Sem preço registrado</p>
                        )}
                      </div>
                      <Dialog title={`Preço — ${p.name}`} description={p.soldByWeight ? "Informe o preço por kg." : "Informe o preço da embalagem inteira."} trigger={<Plus className="h-4 w-4" aria-hidden />} triggerLabel={`Registrar preço de ${p.name}`} triggerSize="icon-sm">
                        <ActionForm action={addPriceAction} closeDialogOnSuccess className="flex flex-col gap-4">
                          <input type="hidden" name="productId" value={p.id} />
                          <div className="grid grid-cols-2 gap-3">
                            <TextField name="price" label="Preço" inputMode="decimal" suffix="R$" placeholder="0,00" />
                            <TextField name="date" label="Data" type="date" defaultValue={today} max={today} />
                          </div>
                          <TextField name="store" label="Loja (opcional)" maxLength={80} />
                          <SubmitButton block>Salvar preço</SubmitButton>
                        </ActionForm>
                      </Dialog>
                    </div>
                    {records.length > 0 && (
                      <details className="mt-2 text-sm">
                        <summary className="cursor-pointer text-xs font-semibold text-ink-2">Histórico ({records.length})</summary>
                        <ul className="mt-2 divide-y divide-line">
                          {records.map((r) => (
                            <li key={r.id} className="flex items-center gap-3 py-1.5 tabular">
                              <span className="w-24 shrink-0 text-ink-2">{formatDateBR(fromDbDate(r.observedAt))}</span>
                              <span className="flex-1">
                                {formatBRL(r.priceCents)} <span className="text-xs text-ink-3">· {PRICE_SOURCE_LABEL[r.source].toLowerCase()}{r.storeName ? ` · ${r.storeName}` : ""}</span>
                              </span>
                              <ActionForm action={deletePriceAction}>
                                <input type="hidden" name="priceId" value={r.id} />
                                <SubmitButton variant="ghost" size="icon-sm" pendingLabel="">
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                  <span className="sr-only">Excluir preço</span>
                                </SubmitButton>
                              </ActionForm>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </>
  );
}
