import type { Metadata } from "next";
import Link from "next/link";
import { ChefHat, Clock } from "lucide-react";
import { formatDec, formatInt } from "@/domain/format";
import { mealTotals, roundTotals } from "@/domain/nutrition/calc";
import { MEAL_TYPE_LABEL, MEAL_TYPES, type MealType } from "@/domain/planner/meal-types";
import { foodConflicts } from "@/domain/restrictions/engine";
import { KITCHEN_EQUIPMENT } from "@/domain/restrictions/vocabulary";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MacroBar } from "@/components/nutrition/nutrients";
import { cn } from "@/components/ui/cn";
import { requireOnboardedUser } from "@/server/session";
import { db } from "@/server/db";
import { FOOD_SELECT, factsOf, foodLabel } from "@/server/services/foods";
import { plannerContext } from "@/server/services/planner";

export const metadata: Metadata = { title: "Receitas" };

const TAG_LABEL: Record<string, string> = {
  rapido: "rápida",
  economico: "econômica",
  vegano: "vegana",
  vegetariano: "vegetariana",
  "sem-lactose": "sem lactose",
  "sem-gluten": "sem glúten",
  "sem-fogao": "sem fogão",
  marmita: "boa para marmita",
};

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ tipo?: string; rapidas?: string }> }) {
  const { user } = await requireOnboardedUser();
  const sp = await searchParams;
  const type = MEAL_TYPES.includes(sp.tipo as MealType) ? (sp.tipo as MealType) : null;
  const quick = sp.rapidas === "1";
  const [ctx, recipes] = await Promise.all([
    plannerContext(user.id),
    db.recipe.findMany({
      where: {
        OR: [{ ownerId: null }, { ownerId: user.id }],
        ...(type ? { mealTypes: { has: type } } : {}),
        ...(quick ? { prepMinutes: { lte: 15 } } : {}),
      },
      include: { ingredients: { include: { food: { select: FOOD_SELECT } }, orderBy: { position: "asc" } } },
      orderBy: [{ prepMinutes: "asc" }, { name: "asc" }],
    }),
  ]);
  const compatible = recipes.filter((r) => r.ingredients.every((i) => foodConflicts(i.food, ctx.rules).length === 0));
  const hidden = recipes.length - compatible.length;
  const qs = (t: string | null, q: boolean) => `/alimentacao/receitas?${new URLSearchParams({ ...(t ? { tipo: t } : {}), ...(q ? { rapidas: "1" } : {}) })}`;

  return (
    <>
      <PageHeader backHref="/alimentacao" eyebrow="Alimentação" title="Receitas" description="Receitas compatíveis com suas alergias, restrições e preferências." />
      <nav aria-label="Filtros" className="relative -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
        <Link href={qs(null, quick)} aria-current={!type ? "page" : undefined} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-semibold", !type ? "border-ink bg-ink text-bg" : "border-line text-ink-2")}>
          Todas
        </Link>
        {MEAL_TYPES.map((m) => (
          <Link key={m} href={qs(m, quick)} aria-current={type === m ? "page" : undefined} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-semibold", type === m ? "border-ink bg-ink text-bg" : "border-line text-ink-2")}>
            {MEAL_TYPE_LABEL[m]}
          </Link>
        ))}
        <Link href={qs(type, !quick)} aria-pressed={quick} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-semibold", quick ? "border-lime bg-lime text-lime-ink" : "border-line text-ink-2")}>
          Até 15 min
        </Link>
      </nav>
      {hidden > 0 && <p className="mb-4 text-sm text-ink-2">{hidden} receitas ocultadas por conflitarem com seu perfil.</p>}
      {compatible.length === 0 ? (
        <EmptyState icon={<ChefHat className="h-6 w-6" aria-hidden />} title="Nenhuma receita com esses filtros" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {compatible.map((r) => {
            const totals = roundTotals(mealTotals(r.ingredients.map((i) => ({ facts: factsOf(i.food), grams: i.grams }))));
            return (
              <li key={r.id}>
                <details className="group h-full rounded-3xl border border-line bg-surface open:bg-surface-2">
                  <summary className="cursor-pointer list-none p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base leading-snug font-bold">{r.name}</h2>
                      <Badge>
                        <Clock className="h-3 w-3" aria-hidden /> {r.prepMinutes} min
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-2">{r.description}</p>
                    <p className="mt-2 text-sm tabular">
                      ≈ <strong>{formatInt(totals.values.kcal)} kcal</strong> · P {formatDec(totals.values.proteinG)} g · C {formatDec(totals.values.carbsG)} g · G {formatDec(totals.values.fatG)} g
                    </p>
                    <MacroBar totals={totals} className="mt-2" />
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.tags.filter((t) => TAG_LABEL[t]).map((t) => (
                        <Badge key={t} tone="outline">
                          {TAG_LABEL[t]}
                        </Badge>
                      ))}
                    </div>
                  </summary>
                  <div className="border-t border-line p-4 text-sm">
                    <h3 className="mb-2 font-bold">Ingredientes (porção de referência)</h3>
                    <ul className="mb-4 space-y-1">
                      {r.ingredients.map((i) => (
                        <li key={i.id} className="flex justify-between gap-3">
                          <span>{foodLabel(i.food)}</span>
                          <span className="text-ink-2 tabular">
                            {formatInt(i.grams)} g{i.householdMeasure ? ` · ${i.householdMeasure}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <h3 className="mb-2 font-bold">Preparo</h3>
                    <ol className="list-decimal space-y-1 pl-5">
                      {r.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                    {r.equipment.length > 0 && (
                      <p className="mt-3 text-xs text-ink-3">
                        Utensílios: {r.equipment.map((e) => e.split("|").map((t) => KITCHEN_EQUIPMENT.find((k) => k.tag === t)?.label ?? t).join(" ou ")).join(", ")}
                      </p>
                    )}
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
