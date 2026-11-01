import type { Metadata } from "next";
import { Database, Plus, Search, ShieldAlert } from "lucide-react";
import { formatDec, formatInt } from "@/domain/format";
import { foodConflicts } from "@/domain/restrictions/engine";
import { labelForTag } from "@/domain/restrictions/vocabulary";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOnboardedUser } from "@/server/session";
import { db } from "@/server/db";
import { foodLabel, searchFoods, STATE_LABEL, FOOD_SELECT } from "@/server/services/foods";
import { plannerContext } from "@/server/services/planner";
import { CustomFoodForm } from "@/components/food/custom-food-form";
import { openFoodFactsEnabled } from "@/server/integrations/open-food-facts";

export const metadata: Metadata = { title: "Base de alimentos" };

const FIELD_LABEL: Record<string, string> = { kcal: "energia", proteinG: "proteínas", carbsG: "carboidratos", fatG: "gorduras", fiberG: "fibras" };

export default async function FoodsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { user } = await requireOnboardedUser();
  const { q = "" } = await searchParams;
  const query = q.slice(0, 60);
  const [results, mine, ctx, total] = await Promise.all([
    query.trim().length >= 2 ? searchFoods(user.id, query, 30) : Promise.resolve([]),
    db.food.findMany({ where: { ownerId: user.id }, select: FOOD_SELECT, orderBy: { createdAt: "desc" }, take: 20 }),
    plannerContext(user.id),
    db.food.count({ where: { ownerId: null } }),
  ]);
  const list = query ? results : mine;

  return (
    <>
      <PageHeader
        backHref="/alimentacao"
        eyebrow="Base nutricional"
        title="Alimentos"
        description={`${formatInt(total)} alimentos da TACO com valores por 100 g. Cru e cozido aparecem como itens diferentes, porque têm composição diferente.`}
        actions={
          <Dialog
            title="Cadastrar alimento"
            description="Use os valores por 100 g do rótulo nutricional. Eles ficam visíveis só para você."
            trigger={
              <>
                <Plus className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Cadastrar</span>
              </>
            }
            triggerLabel="Cadastrar alimento"
            triggerSize="sm"
          >
            <CustomFoodForm barcodeEnabled={openFoodFactsEnabled()} />
          </Dialog>
        }
      />

      <form role="search" className="mb-6 flex gap-2" action="/alimentacao/alimentos">
        <label htmlFor="busca-alimento" className="sr-only">
          Buscar alimento
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            id="busca-alimento"
            name="q"
            defaultValue={query}
            placeholder="Ex.: feijão cozido, banana, iogurte"
            className="h-12 w-full rounded-2xl border border-line bg-surface-2 pr-4 pl-11 focus:border-lime focus:outline-none"
          />
        </div>
        <button type="submit" className="h-12 rounded-full bg-lime px-5 font-semibold text-lime-ink">
          Buscar
        </button>
      </form>

      {!query && <h2 className="mb-3 text-lg font-bold">Seus alimentos</h2>}
      {list.length === 0 ? (
        <EmptyState icon={<Database className="h-6 w-6" aria-hidden />} title={query ? "Nenhum alimento encontrado" : "Nenhum alimento cadastrado por você"}>
          {query ? "Tente outra palavra (ex.: “frango” em vez de “peito de frango grelhado”)." : "Busque na base TACO acima ou cadastre um produto a partir do rótulo."}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((f) => {
            const conflicts = foodConflicts(f, ctx.rules);
            const critical = conflicts.filter((c) => c.level === "critical");
            return (
              <li key={f.id}>
                <details className="group rounded-3xl border border-line bg-surface open:bg-surface-2">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{foodLabel(f)}</p>
                      <p className="text-xs text-ink-2">
                        {f.kcal !== null ? `${formatInt(f.kcal)} kcal/100 g` : "energia não informada na fonte"} · {STATE_LABEL[f.state]} · {f.category}
                      </p>
                    </div>
                    {critical.length > 0 && <ShieldAlert className="h-5 w-5 text-danger-text" aria-label="Conflita com suas restrições" />}
                    {f.missingFields.length > 0 && <Badge tone="amber">incompleto</Badge>}
                  </summary>
                  <div className="border-t border-line px-4 py-4 text-sm">
                    <p className="mb-3 text-ink-2">{f.name}</p>
                    <dl className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                      {(["kcal", "proteinG", "carbsG", "fatG", "fiberG"] as const).map((k) => (
                        <div key={k}>
                          <dt className="text-xs text-ink-3">{k === "kcal" ? "Energia" : FIELD_LABEL[k][0].toUpperCase() + FIELD_LABEL[k].slice(1)}</dt>
                          <dd className="font-semibold tabular">
                            {f[k] === null ? "—" : k === "kcal" ? `${formatInt(f[k]!)} kcal` : `${formatDec(f[k]!)} g`}
                            {f.notApplicable.includes(k) && <span className="ml-1 text-xs text-ink-3">(NA)</span>}
                          </dd>
                        </div>
                      ))}
                      <div>
                        <dt className="text-xs text-ink-3">Sódio</dt>
                        <dd className="font-semibold tabular">{f.sodiumMg === null ? "—" : `${formatInt(f.sodiumMg)} mg`}</dd>
                      </div>
                    </dl>
                    {f.missingFields.length > 0 && (
                      <p className="mt-3 text-xs text-amber-text">
                        Sem dado na fonte para: {f.missingFields.map((m) => FIELD_LABEL[m]).join(", ")}. Não estimamos esses valores.
                      </p>
                    )}
                    {f.notApplicable.length > 0 && (
                      <p className="mt-1 text-xs text-ink-3">NA = não aplicável a este alimento (ex.: fibra em carnes); considerado zero nos cálculos.</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {f.tags
                        .filter((t) => !t.startsWith("origem") && t !== "carne" && t !== "laticinio")
                        .map((t) => (
                          <Badge key={t} tone={t.startsWith("traco:") ? "amber" : "outline"}>
                            {t.startsWith("traco:") ? `pode conter ${labelForTag(t.slice(6)).toLowerCase()}` : labelForTag(t)}
                          </Badge>
                        ))}
                    </div>
                    {critical.length > 0 && (
                      <p className="mt-3 rounded-2xl bg-danger-soft px-3 py-2 text-xs text-danger-text">
                        Conflita com: {critical.map((c) => c.label).join(", ")}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-ink-3">
                      {f.ownerId
                        ? "Cadastrado por você a partir de rótulo."
                        : `Fonte: ${f.source?.name ?? "TACO"} (${f.source?.edition ?? ""}, ${f.source?.year ?? ""}) · item ${f.sourceRef}.`}
                      {!f.allergenReviewed && !f.ownerId && " Alergênicos não revisados pelo VIVA — confira o rótulo."}
                    </p>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
