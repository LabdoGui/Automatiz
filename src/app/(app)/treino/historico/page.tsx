import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, History } from "lucide-react";
import { formatDateLong, formatInt } from "@/domain/format";
import { localDate } from "@/domain/dates";
import { sessionDurationSeconds, setVolume } from "@/domain/training/training";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { clockFor, requireOnboardedUser } from "@/server/session";
import { sessionHistory } from "@/server/services/training";

export const metadata: Metadata = { title: "Histórico de treinos" };

const MONTH = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function TrainingHistoryPage() {
  const { user, settings } = await requireOnboardedUser();
  const { tz } = clockFor(settings);
  const sessions = await sessionHistory(user.id, 120);
  const byMonth = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = localDate(s.startedAt, tz).slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), s]);
  }
  return (
    <>
      <PageHeader backHref="/treino" eyebrow="Treino" title="Histórico" description="Treinos concluídos, com duração, séries e volume (repetições × carga)." />
      {sessions.length === 0 ? (
        <EmptyState icon={<History className="h-6 w-6" aria-hidden />} title="Nenhum treino registrado" action={<LinkButton href="/treino">Ir para os treinos</LinkButton>}>
          Comece um treino da sua rotina ou um treino livre.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          {[...byMonth.entries()].map(([month, list]) => (
            <section key={month} aria-labelledby={`m-${month}`}>
              <h2 id={`m-${month}`} className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-ink-3">
                {MONTH.format(new Date(`${month}-01T00:00:00Z`))} · {list.length} {list.length === 1 ? "treino" : "treinos"}
              </h2>
              <ul className="divide-y divide-line rounded-3xl border border-line">
                {list.map((s) => {
                  const sets = s.exercises.flatMap((e) => e.sets);
                  return (
                    <li key={s.id}>
                      <Link href={`/treino/historico/${s.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{s.title}</p>
                          <p className="text-sm text-ink-2">
                            {formatDateLong(localDate(s.startedAt, tz))} · {Math.round(sessionDurationSeconds(s) / 60)} min · {sets.filter((x) => x.completed).length} séries
                            {s.discomfort ? " · desconforto relatado" : ""}
                          </p>
                        </div>
                        <span className="text-sm text-ink-2 tabular">{formatInt(setVolume(sets))} kg</span>
                        <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
