import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  Clock3,
  Dumbbell,
  Info,
  PiggyBank,
  Repeat2,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { startOfWeek, timeToMinutes, localTime } from "@/domain/dates";
import { formatBRL, formatDec, formatGrams, formatInt, pluralize } from "@/domain/format";
import { buildAssistantContext } from "@/domain/assistant/context";
import { MEAL_TYPE_LABEL } from "@/domain/planner/meal-types";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton, buttonClasses } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, SubmitButton, TextField } from "@/components/forms/fields";
import { AiChat } from "@/components/assistant/ai-chat";
import { clockFor, requireOnboardedUser } from "@/server/session";
import { db } from "@/server/db";
import { aiSettings } from "@/server/ai/claude";
import {
  aiHistory,
  assistantContextInput,
  missingShopping,
  nextPendingMeal,
  plannedFoodsForSwap,
  swapOptionsFor,
} from "@/server/services/assistant";
import { compatibleRecipes } from "@/server/services/planner";
import { savingTips } from "@/server/services/shopping";
import { foodLabel } from "@/server/services/foods";
import { normalizeText } from "@/domain/restrictions/engine";
import { clearAiHistoryAction } from "@/server/actions/assistant";
import { setAiOptInAction } from "@/server/actions/profile";
import { applySavingTipAction, replaceRecipeAction } from "@/server/actions/planner";

export const metadata: Metadata = { title: "Assistente" };

const TOOLS = [
  { key: "trocar", label: "Trocar um alimento", icon: Repeat2 },
  { key: "economizar", label: "Economizar na semana", icon: PiggyBank },
  { key: "rapida", label: "Refeição mais rápida", icon: Clock3 },
  { key: "exercicio", label: "Como fazer um exercício", icon: Dumbbell },
  { key: "faltando", label: "O que falta comprar", icon: ShoppingBasket },
] as const satisfies readonly { key: string; label: string; icon: LucideIcon }[];
type ToolKey = (typeof TOOLS)[number]["key"];

const BASIS_LABEL = { kcal: "energia", proteinG: "proteína", carbsG: "carboidrato", fatG: "gordura", fiberG: "fibra" } as const;
const MAX_PREP_OPTIONS = [10, 15, 20, 30] as const;

type SearchParams = { ferramenta?: string; alimento?: string; tipo?: string; minutos?: string; q?: string };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user, settings } = await requireOnboardedUser();
  const sp = await searchParams;
  const tool = (TOOLS.find((t) => t.key === sp.ferramenta)?.key ?? null) as ToolKey | null;
  const ai = aiSettings();
  const optedIn = Boolean(settings?.assistantAiOptIn);

  const [history, contextInput] = await Promise.all([
    ai.configured && optedIn ? aiHistory(user.id) : Promise.resolve([]),
    ai.configured && optedIn ? assistantContextInput(user.id) : Promise.resolve(null),
  ]);
  const contextLines = contextInput ? buildAssistantContext(contextInput) : [];

  return (
    <div>
      <PageHeader
        eyebrow="Assistente"
        title="Pergunte, troque, economize"
        description="As ferramentas do VIVA respondem com os seus dados, sem IA. A conversa com IA é opcional e sempre identificada."
      />

      {/* Ferramentas do VIVA */}
      <section aria-labelledby="ferramentas" className="mb-12">
        <SectionTitle id="ferramentas">
          <span className="inline-flex flex-wrap items-center gap-2">
            Ferramentas do VIVA
            <Badge tone="outline">
              <Calculator className="h-3 w-3" aria-hidden /> sem IA
            </Badge>
          </span>
        </SectionTitle>
        <nav aria-label="Ferramentas" className="relative -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
          {TOOLS.map(({ key, label, icon: Icon }) => (
            <Link
              key={key}
              href={`/assistente?ferramenta=${key}#ferramenta`}
              aria-current={tool === key ? "page" : undefined}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                tool === key ? "border-lime bg-lime text-lime-ink" : "border-line text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </Link>
          ))}
        </nav>
        <div id="ferramenta" className="scroll-mt-24">
          {tool === null ? (
            <p className="flex items-start gap-3 rounded-2xl border border-dashed border-line-strong p-4 text-sm text-ink-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Escolha uma ferramenta acima. As respostas usam seu plano, suas restrições, sua lista e os preços que você cadastrou — nada é inventado.
            </p>
          ) : (
            <div className="rounded-[2rem] border border-line bg-surface p-5 sm:p-6">
              {tool === "trocar" && <SwapTool userId={user.id} today={clockFor(settings).today} foodId={sp.alimento} />}
              {tool === "economizar" && <SaveTool userId={user.id} today={clockFor(settings).today} />}
              {tool === "rapida" && (
                <QuickMealTool userId={user.id} settings={settings} mealTypeParam={sp.tipo} minutesParam={sp.minutos} />
              )}
              {tool === "exercicio" && <ExerciseTool query={sp.q} />}
              {tool === "faltando" && <MissingTool userId={user.id} />}
              <p className="mt-5 flex items-center gap-1.5 border-t border-line pt-3 text-xs text-ink-3">
                <Calculator className="h-3.5 w-3.5" aria-hidden /> Calculado pelo VIVA com os seus dados. Não é uma resposta de IA.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Conversa com IA */}
      <section aria-labelledby="conversa-ia" id="ia" className="scroll-mt-24">
        <SectionTitle id="conversa-ia">
          <span className="inline-flex flex-wrap items-center gap-2">
            Conversa com IA
            <Badge tone="sky">
              <Sparkles className="h-3 w-3" aria-hidden /> opcional
            </Badge>
          </span>
        </SectionTitle>

        {!ai.configured ? (
          <EmptyState icon={<Sparkles className="h-6 w-6" aria-hidden />} title="IA não configurada nesta instalação">
            O VIVA não simula respostas de IA. Para ativar, quem administra o servidor precisa definir a chave do provedor nas variáveis de ambiente
            (veja o README). Enquanto isso, use as ferramentas acima.
          </EmptyState>
        ) : !optedIn ? (
          <div className="rounded-[2rem] border border-line p-5 sm:p-6">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-5 w-5 text-lime-text" aria-hidden /> Antes de ativar
            </p>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-2">
              <li>Suas perguntas são enviadas à Anthropic (Claude), provedora de IA, pelo servidor do VIVA.</li>
              <li>
                Junto com a pergunta vão, se você permitir, apenas: objetivo, nível e local de treino, preferência de cozinha, alergias, intolerâncias,
                restrições e o que você não come. Nunca nome, e-mail, idade, peso, medidas ou orçamento.
              </li>
              <li>Respostas de IA podem conter erros e não substituem nutricionista, médico ou profissional de educação física.</li>
              <li>
                Você pode desativar e apagar a conversa a qualquer momento. Detalhes na{" "}
                <Link href="/privacidade" className="text-lime-text underline">
                  política de privacidade
                </Link>
                .
              </li>
            </ul>
            <ActionForm action={setAiOptInAction} className="mt-5">
              <input type="hidden" name="enable" value="1" />
              <SubmitButton pendingLabel="Ativando…">
                <Sparkles className="h-4 w-4" aria-hidden /> Concordo e quero ativar
              </SubmitButton>
            </ActionForm>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <AiChat
              key={history.length}
              initialMessages={history.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
              contextLines={contextLines}
              maxPerHour={ai.maxPerHour}
            />

            <div className="flex flex-wrap items-center gap-3 text-sm">
              {history.length > 0 && (
                <Dialog
                  title="Apagar a conversa?"
                  trigger={
                    <>
                      <Trash2 className="h-4 w-4" aria-hidden /> Apagar conversa
                    </>
                  }
                  triggerVariant="ghost"
                  triggerSize="sm"
                >
                  <p className="mb-4 text-sm text-ink-2">As mensagens com a IA serão excluídas do VIVA. Isso não pode ser desfeito.</p>
                  <ActionForm action={clearAiHistoryAction} closeDialogOnSuccess>
                    <SubmitButton variant="danger" block pendingLabel="Apagando…">
                      Apagar conversa
                    </SubmitButton>
                  </ActionForm>
                </Dialog>
              )}
              <ActionForm action={setAiOptInAction}>
                <input type="hidden" name="enable" value="0" />
                <SubmitButton variant="ghost" size="sm" pendingLabel="Desativando…">
                  Desativar IA
                </SubmitButton>
              </ActionForm>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Ferramentas
// ─────────────────────────────────────────────────────────────

function ToolHeading({ children, description }: { children: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-bold">{children}</h3>
      {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
    </div>
  );
}

async function SwapTool({ userId, today, foodId }: { userId: string; today: string; foodId?: string }) {
  const { planId, foods } = await plannedFoodsForSwap(userId, startOfWeek(today));
  if (!planId || foods.length === 0) {
    return (
      <>
        <ToolHeading>Trocar um alimento</ToolHeading>
        <p className="text-sm text-ink-2">Gere o plano da semana para ver trocas equivalentes dos alimentos planejados.</p>
        <LinkButton href="/alimentacao" variant="secondary" size="sm" className="mt-3">
          Ir para o planejamento
        </LinkButton>
      </>
    );
  }
  const selected = foods.find((f) => f.food.id === foodId) ?? null;
  const options = selected ? await swapOptionsFor(userId, selected.food, selected.avgGrams) : [];
  return (
    <>
      <ToolHeading description="Equivalentes do mesmo grupo, compatíveis com suas restrições, na quantidade que mantém o nutriente principal.">
        Trocar um alimento
      </ToolHeading>
      <form method="get" action="/assistente#ferramenta" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="ferramenta" value="trocar" />
        <SelectField name="alimento" label="Alimento do seu plano" defaultValue={selected?.food.id ?? ""} className="flex-1">
          <option value="" disabled>
            Escolha…
          </option>
          {foods.map((f) => (
            <option key={f.food.id} value={f.food.id}>
              {foodLabel(f.food)} ({pluralize(f.count, "vez", "vezes")})
            </option>
          ))}
        </SelectField>
        <button type="submit" className={buttonClasses({ variant: "secondary" })}>
          Ver trocas
        </button>
      </form>
      {selected && (
        <div className="mt-5">
          <p className="mb-3 text-sm text-ink-2">
            Para a porção média de <strong className="text-ink">{formatGrams(selected.avgGrams)}</strong> de {foodLabel(selected.food)}:
          </p>
          {options.length === 0 ? (
            <p className="text-sm text-ink-2">Nenhuma troca compatível com suas restrições foi encontrada para este alimento.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {options.map((o) => (
                <li key={o.food.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {formatGrams(o.grams)} de {o.food.shortName ?? o.food.name}
                    </p>
                    <p className="text-xs text-ink-2">
                      {o.basis === "grams" ? "mesma quantidade em gramas" : `mesma quantidade de ${BASIS_LABEL[o.basis]}`}
                      {o.costCents !== null ? ` · ≈ ${formatBRL(o.costCents)} pelos seus preços` : " · sem preço cadastrado"}
                      {o.unusual && " · quantidade bem diferente da original"}
                    </p>
                  </div>
                  <ActionForm action={applySavingTipAction}>
                    <input type="hidden" name="planId" value={planId} />
                    <input type="hidden" name="fromFoodId" value={selected.food.id} />
                    <input type="hidden" name="toFoodId" value={o.food.id} />
                    <SubmitButton size="sm" variant="secondary" pendingLabel="Trocando…">
                      Trocar no plano
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-3">“Trocar no plano” altera as refeições ainda não concluídas desta semana. Valores nutricionais: TACO.</p>
        </div>
      )}
    </>
  );
}

async function SaveTool({ userId, today }: { userId: string; today: string }) {
  const [plan, priceCount] = await Promise.all([
    db.mealPlan.findFirst({
      where: { userId, status: "ACTIVE", weekStart: new Date(`${startOfWeek(today)}T00:00:00Z`) },
      select: { id: true },
    }),
    db.priceRecord.count({ where: { userId } }),
  ]);
  const tips = plan ? await savingTips(userId, plan.id, today) : [];
  return (
    <>
      <ToolHeading description="Trocas por equivalentes mais baratos, calculadas apenas com os preços que você cadastrou.">Economizar na semana</ToolHeading>
      {!plan ? (
        <p className="text-sm text-ink-2">Sem plano ativo nesta semana.</p>
      ) : priceCount === 0 ? (
        <p className="text-sm text-ink-2">
          Sem preços cadastrados, o VIVA não tem como comparar custos — e não inventa valores.{" "}
          <Link href="/compras/precos" className="font-semibold text-lime-text underline">
            Cadastrar preços
          </Link>
        </p>
      ) : tips.length === 0 ? (
        <p className="text-sm text-ink-2">
          Com os preços atuais, não há troca mais barata compatível com suas restrições. Cadastrar preços de mais produtos amplia as comparações.
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {tips.map((t) => (
            <li key={`${t.fromFood.id}-${t.toFood.id}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">
                  {foodLabel(t.fromFood)} → {foodLabel(t.toFood)}
                </p>
                <p className="text-xs text-ink-2">
                  economia estimada de {formatBRL(t.savingsCents)} em {pluralize(t.occurrences, "porção", "porções")}
                </p>
              </div>
              <ActionForm action={applySavingTipAction}>
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="fromFoodId" value={t.fromFood.id} />
                <input type="hidden" name="toFoodId" value={t.toFood.id} />
                <SubmitButton size="sm" variant="secondary" pendingLabel="Aplicando…">
                  Aplicar no plano
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function QuickMealTool({
  userId,
  settings,
  mealTypeParam,
  minutesParam,
}: {
  userId: string;
  settings: Parameters<typeof clockFor>[0];
  mealTypeParam?: string;
  minutesParam?: string;
}) {
  const { tz, today } = clockFor(settings);
  const weekStart = startOfWeek(today);
  const types = Object.keys(MEAL_TYPE_LABEL) as (keyof typeof MEAL_TYPE_LABEL)[];
  const now = timeToMinutes(localTime(new Date(), tz));
  const upcoming = await nextPendingMeal(userId, weekStart, today, { nowMinutes: now });
  const mealType =
    types.find((t) => t === mealTypeParam) ??
    upcoming?.mealType ??
    (now < 600 ? "BREAKFAST" : now < 840 ? "LUNCH" : now < 1080 ? "AFTERNOON_SNACK" : "DINNER");
  const minutes = MAX_PREP_OPTIONS.find((m) => String(m) === minutesParam) ?? 15;
  const [recipes, target] = await Promise.all([
    compatibleRecipes(userId, mealType, { maxPrep: minutes }),
    nextPendingMeal(userId, weekStart, today, { nowMinutes: now, mealType }),
  ]);
  return (
    <>
      <ToolHeading description="Receitas compatíveis com suas restrições, ordenadas pelo tempo de preparo.">Refeição mais rápida</ToolHeading>
      <form method="get" action="/assistente#ferramenta" className="grid grid-cols-[1fr_7rem] gap-3 sm:flex sm:items-end">
        <input type="hidden" name="ferramenta" value="rapida" />
        <SelectField name="tipo" label="Refeição" defaultValue={mealType} className="sm:flex-1">
          {types.map((t) => (
            <option key={t} value={t}>
              {MEAL_TYPE_LABEL[t]}
            </option>
          ))}
        </SelectField>
        <SelectField name="minutos" label="Até" defaultValue={String(minutes)} className="sm:w-36">
          {MAX_PREP_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </SelectField>
        <button type="submit" className={cn(buttonClasses({ variant: "secondary" }), "col-span-2")}>
          Buscar
        </button>
      </form>
      {recipes.length === 0 ? (
        <p className="mt-5 text-sm text-ink-2">Nenhuma receita compatível até {minutes} minutos para esta refeição. Tente um tempo maior.</p>
      ) : (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {recipes.slice(0, 8).map((r) => (
            <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold">{r.name}</p>
                <p className="text-xs text-ink-2 tabular">
                  {r.prepMinutes} min · ≈ {formatInt(r.totals.values.kcal)} kcal · P {formatDec(r.totals.values.proteinG)} g
                  {r.totals.incomplete.length > 0 && " · dados incompletos na fonte"}
                </p>
              </div>
              {target && (
                <ActionForm action={replaceRecipeAction}>
                  <input type="hidden" name="mealId" value={target.id} />
                  <input type="hidden" name="recipeId" value={r.id} />
                  <SubmitButton size="sm" variant="secondary" pendingLabel="Trocando…">
                    Usar {target.time ? `às ${target.time}` : "hoje"}
                  </SubmitButton>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      )}
      {!target && recipes.length > 0 && (
        <p className="mt-3 text-xs text-ink-3">Não há {MEAL_TYPE_LABEL[mealType].toLowerCase()} pendente hoje no plano; as receitas ficam como ideia.</p>
      )}
    </>
  );
}

async function ExerciseTool({ query }: { query?: string }) {
  const q = (query ?? "").trim().slice(0, 60);
  const tokens = normalizeText(q).split(" ").filter((t) => t.length >= 2);
  const results = tokens.length
    ? await db.exercise.findMany({
        where: { AND: tokens.map((t) => ({ OR: [{ name: { contains: t, mode: "insensitive" as const } }, { slug: { contains: t } }] })) },
        select: { slug: true, name: true, primaryGroup: true, difficulty: true },
        orderBy: { name: "asc" },
        take: 10,
      })
    : [];
  return (
    <>
      <ToolHeading description="Execução passo a passo, erros comuns e cuidados — do catálogo do VIVA.">Como fazer um exercício</ToolHeading>
      <form method="get" action="/assistente#ferramenta" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="ferramenta" value="exercicio" />
        <TextField name="q" label="Exercício" defaultValue={q} placeholder="Ex.: agachamento, remada" className="flex-1" />
        <button type="submit" className={buttonClasses({ variant: "secondary" })}>
          Buscar
        </button>
      </form>
      {tokens.length > 0 &&
        (results.length === 0 ? (
          <p className="mt-5 text-sm text-ink-2">
            Nada encontrado para “{q}”.{" "}
            <Link href="/treino/exercicios" className="font-semibold text-lime-text underline">
              Ver o catálogo completo
            </Link>
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {results.map((e) => (
              <li key={e.slug}>
                <Link href={`/treino/exercicios/${e.slug}`} className="flex min-h-12 items-center justify-between gap-3 py-2 hover:text-lime-text">
                  <span className="font-semibold">{e.name}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}

async function MissingTool({ userId }: { userId: string }) {
  const data = await missingShopping(userId);
  return (
    <>
      <ToolHeading description="Itens da lista aberta ainda não marcados como comprados.">O que falta comprar</ToolHeading>
      {!data ? (
        <p className="text-sm text-ink-2">
          Nenhuma lista aberta.{" "}
          <Link href="/compras" className="font-semibold text-lime-text underline">
            Gerar lista de compras
          </Link>
        </p>
      ) : data.missing.length === 0 ? (
        <p className="text-sm text-ink-2">Tudo comprado. Lembre de finalizar a lista para levar as sobras à despensa.</p>
      ) : (
        <>
          <p className="mb-3 text-sm">
            Faltam <strong>{pluralize(data.missing.length, "item", "itens")}</strong>
            {data.remainingCents > 0 && (
              <>
                {" "}
                · ≈ <strong className="tabular">{formatBRL(data.remainingCents)}</strong> pelos preços cadastrados
              </>
            )}
            {data.withoutPrice > 0 && <span className="text-ink-2"> ({pluralize(data.withoutPrice, "item sem preço", "itens sem preço")})</span>}
          </p>
          <ul className="flex flex-wrap gap-2">
            {data.missing.map(({ item }) => (
              <li key={item.id} className="rounded-full border border-line px-3 py-1 text-sm">
                {item.name}
              </li>
            ))}
          </ul>
          <LinkButton href="/compras" variant="secondary" size="sm" className="mt-4">
            Abrir lista <ArrowRight className="h-4 w-4" aria-hidden />
          </LinkButton>
        </>
      )}
    </>
  );
}
