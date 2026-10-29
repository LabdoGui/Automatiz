import type { Metadata } from "next";
import Link from "next/link";
import { Check, NotebookPen } from "lucide-react";
import { addDays, rangeDates, weekdayIndex, WEEKDAY_LONG } from "@/domain/dates";
import { formatDateLong, formatInt } from "@/domain/format";
import { mealTotals, roundTotals, sumTotals } from "@/domain/nutrition/calc";
import { MEAL_TYPE_LABEL } from "@/domain/planner/meal-types";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { clockFor, requireOnboardedUser } from "@/server/session";
import { history } from "@/server/services/planner";
import { factsOf } from "@/server/services/foods";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Histórico de refeições" };

const RANGES = { "7": 7, "30": 30, "60": 60 } as const;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { user, settings } = await requireOnboardedUser();
  const { today } = clockFor(settings);
  const { dias } = await searchParams;
  const span = RANGES[(dias ?? "7") as keyof typeof RANGES] ?? 7;
  const from = addDays(today, -(span - 1));
  const { meals, logs } = await history(user.id, from, today);
  const days = rangeDates(from, today)
    .reverse()
    .map((date) => {
      const dayMeals = meals.filter((m) => m.date.toISOString().slice(0, 10) === date);
      const done = dayMeals.filter((m) => m.completedAt);
      const dayLogs = logs.filter((l) => l.date.toISOString().slice(0, 10) === date);
      const totals = roundTotals(
        sumTotals([
          ...done.map((m) => mealTotals(m.items.map((i) => ({ facts: factsOf(i.food), grams: i.grams })))),
          ...dayLogs.map((l) => mealTotals(l.items.map((i) => ({ facts: factsOf(i.food), grams: i.grams })))),
        ]),
      );
      return { date, planned: dayMeals.length, done, logs: dayLogs, totals };
    });
  const empty = days.every((d) => d.done.length === 0 && d.logs.length === 0);

  return (
    <>
      <PageHeader backHref="/alimentacao" eyebrow="Alimentação" title="Histórico" description="O que você marcou como feito e o que registrou fora do plano." />
      <nav aria-label="Período" className="mb-6 flex gap-2">
        {Object.keys(RANGES).map((k) => (
          <Link
            key={k}
            href={`/alimentacao/historico?dias=${k}`}
            aria-current={String(span) === k ? "page" : undefined}
            className={cn("rounded-full border px-4 py-2 text-sm font-semibold", String(span) === k ? "border-ink bg-ink text-bg" : "border-line text-ink-2 hover:bg-surface-2")}
          >
            {k} dias
          </Link>
        ))}
      </nav>
      {empty ? (
        <EmptyState icon={<NotebookPen className="h-6 w-6" aria-hidden />} title="Nada registrado neste período">
          Marque refeições como concluídas ou registre o que comeu para ver seu histórico aqui.
        </EmptyState>
      ) : (
        <ol className="flex flex-col gap-6">
          {days
            .filter((d) => d.done.length || d.logs.length || d.planned)
            .map((d) => (
              <li key={d.date} className="grid gap-3 sm:grid-cols-[11rem_1fr]">
                <div>
                  <p className="font-display font-bold">{WEEKDAY_LONG[weekdayIndex(d.date)]}</p>
                  <p className="text-sm text-ink-2">{formatDateLong(d.date)}</p>
                  {(d.done.length > 0 || d.logs.length > 0) && (
                    <p className="mt-1 text-sm text-ink-2 tabular">
                      ≈ {formatInt(d.totals.values.kcal)}
                      {d.totals.incomplete.length ? "*" : ""} kcal registradas
                    </p>
                  )}
                </div>
                <ul className="flex flex-col gap-1.5">
                  {d.done.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-lime-text" aria-hidden />
                      <span className="font-medium">{m.title}</span>
                      <span className="text-ink-3">· {MEAL_TYPE_LABEL[m.mealType]}</span>
                    </li>
                  ))}
                  {d.logs.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 text-sm">
                      <NotebookPen className="h-4 w-4 text-sky-text" aria-hidden />
                      <span className="font-medium">{l.title}</span>
                      <span className="text-ink-3">· fora do plano</span>
                    </li>
                  ))}
                  {d.done.length === 0 && d.logs.length === 0 && <li className="text-sm text-ink-3">Nenhum registro — tudo bem.</li>}
                  {d.planned > 0 && (
                    <li className="text-xs text-ink-3">
                      {d.done.length} de {d.planned} refeições planejadas marcadas
                    </li>
                  )}
                </ul>
              </li>
            ))}
        </ol>
      )}
    </>
  );
}
