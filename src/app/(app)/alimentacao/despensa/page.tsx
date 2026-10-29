import type { Metadata } from "next";
import { Package, Trash2 } from "lucide-react";
import { formatGrams } from "@/domain/format";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionForm, FormMessage } from "@/components/forms/action-form";
import { NumberField, SubmitButton } from "@/components/forms/fields";
import { FoodPicker } from "@/components/food/food-picker";
import { requireOnboardedUser } from "@/server/session";
import { db } from "@/server/db";
import { FOOD_SELECT, foodLabel } from "@/server/services/foods";
import { removePantryAction, setPantryAction } from "@/server/actions/planner";

export const metadata: Metadata = { title: "Despensa" };

export default async function PantryPage() {
  const { user } = await requireOnboardedUser();
  const items = await db.pantryItem.findMany({
    where: { userId: user.id },
    include: { food: { select: FOOD_SELECT } },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        backHref="/alimentacao"
        eyebrow="Alimentação"
        title="Despensa"
        description="O que você já tem em casa. Esses itens são descontados da lista de compras e priorizados nas sugestões."
      />
      <section aria-labelledby="adicionar" className="mb-8 rounded-3xl border border-line bg-surface p-5">
        <h2 id="adicionar" className="mb-4 text-lg font-bold">
          Adicionar ou atualizar
        </h2>
        <ActionForm action={setPantryAction} resetOnSuccess className="flex flex-col gap-4">
          <FoodPicker label="Alimento" placeholder="Ex.: arroz, feijão, ovos" />
          <NumberField name="grams" label="Quantidade em casa" decimal suffix="g" hint="Ovos: 1 unidade ≈ 50 g. Use 0 para remover." />
          <SubmitButton>Salvar na despensa</SubmitButton>
        </ActionForm>
        <FormMessage className="mt-4">
          Alimentos preparados são guardados como o item comprado (ex.: “arroz cozido” vira “arroz cru”), porque é assim que a
          lista de compras compara.
        </FormMessage>
      </section>
      <SectionTitle>Em casa agora</SectionTitle>
      {items.length === 0 ? (
        <EmptyState icon={<Package className="h-6 w-6" aria-hidden />} title="Despensa vazia">
          Adicione o que já tem para economizar na próxima lista.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-3xl border border-line">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{foodLabel(it.food)}</p>
                <p className="text-sm text-ink-2 tabular">{formatGrams(it.quantityG)}</p>
              </div>
              <ActionForm action={removePantryAction}>
                <input type="hidden" name="itemId" value={it.id} />
                <SubmitButton variant="ghost" size="icon-sm" pendingLabel="">
                  <Trash2 className="h-4 w-4" aria-hidden />
                  <span className="sr-only">Remover {foodLabel(it.food)}</span>
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
