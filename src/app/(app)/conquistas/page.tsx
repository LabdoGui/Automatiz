import type { Metadata } from "next";
import Link from "next/link";
import { Check, Pause, Play, Settings2, Sparkles, Trophy } from "lucide-react";
import { addDays, localDate, startOfWeek } from "@/domain/dates";
import { formatDateBR, formatDayMonth, formatInt, pluralize } from "@/domain/format";
import {
  ACHIEVEMENTS,
  CHALLENGES,
  MASCOT_STAGES,
  XP_KIND_LABEL,
  XP_REWARDS,
  levelFromXp,
  mascotForLevel,
  type XpKind,
} from "@/domain/gamification/rules";
import { Mascot } from "@/components/brand/mascot";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Meter } from "@/components/ui/meter";
import { Badge } from "@/components/ui/badge";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/components/ui/cn";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/fields";
import { clockFor, requireOnboardedUser } from "@/server/session";
import {
  completedChallengesCount,
  computeStats,
  consistencyStreak,
  unlockedAchievements,
  weekChallenges,
  xpHistory,
  xpSince,
} from "@/server/services/gamification";
import { joinChallengeAction, pauseChallengeAction } from "@/server/actions/progress";

export const metadata: Metadata = { title: "Conquistas" };

const HISTORY_PREVIEW = 15;
const HISTORY_MAX = 200;

const ACHIEVEMENT_TITLE = new Map(ACHIEVEMENTS.map((a) => [a.code, a.title]));
const CHALLENGE_TITLE = new Map(CHALLENGES.map((c) => [c.code, c.title]));

function describeXp(kind: string, refId: string): string {
  if (kind === "ACHIEVEMENT") return `Conquista: ${ACHIEVEMENT_TITLE.get(refId) ?? refId}`;
  if (kind === "CHALLENGE") {
    const code = refId.split(":")[0];
    return `Desafio: ${CHALLENGE_TITLE.get(code) ?? code}`;
  }
  return XP_KIND_LABEL[kind as XpKind] ?? kind;
}

export default async function AchievementsPage({ searchParams }: { searchParams: Promise<{ xp?: string }> }) {
  const { user, profile, settings } = await requireOnboardedUser();
  const { tz, today } = clockFor(settings);
  const weekStart = startOfWeek(today);
  const { xp } = await searchParams;
  const showAllXp = xp === "todos";

  const [stats, unlocked, challenges, history, weekXp, streak, challengesDone] = await Promise.all([
    computeStats(user.id, tz),
    unlockedAchievements(user.id),
    weekChallenges(user.id, weekStart),
    xpHistory(user.id, showAllXp ? HISTORY_MAX : HISTORY_PREVIEW),
    xpSince(user.id, weekStart, tz),
    consistencyStreak(user.id, tz, today),
    completedChallengesCount(user.id),
  ]);

  const level = levelFromXp(profile.xpTotal);
  const mascot = mascotForLevel(level.level);
  const nextStage = MASCOT_STAGES.find((s) => s.minLevel > level.level) ?? null;
  const unlockedAt = new Map(unlocked.map((u) => [u.achievement.code, u.unlockedAt]));
  const done = ACHIEVEMENTS.filter((a) => unlockedAt.has(a.code)).sort(
    (a, b) => unlockedAt.get(b.code)!.getTime() - unlockedAt.get(a.code)!.getTime(),
  );
  const pending = ACHIEVEMENTS.filter((a) => !unlockedAt.has(a.code))
    .map((a) => ({ a, p: a.progress(stats) }))
    .sort((x, y) => y.p.current / y.p.target - x.p.current / x.p.target);
  const joined = challenges.filter((c) => c.mine).length;

  return (
    <div>
      <PageHeader
        eyebrow="Conquistas"
        title="Constância que dá frutos"
        description="XP, conquistas e desafios celebram o que você fez — nunca o que deixou de fazer. Descanso não tira nada."
      />

      {/* Nível e mascote */}
      <section aria-labelledby="nivel" className="grain relative mb-10 overflow-hidden rounded-[2rem] border border-line bg-surface p-5 sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-lime-soft blur-3xl" aria-hidden />
        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <div className="grid h-40 w-40 shrink-0 place-items-center rounded-full bg-lime-soft">
            <Mascot stage={mascot.key} size={128} />
          </div>
          <div className="w-full min-w-0 flex-1">
            <p className="text-xs font-bold tracking-[0.16em] text-ink-3 uppercase">Seu Broto hoje</p>
            <h2 id="nivel" className="mt-1 flex flex-wrap items-baseline gap-x-2 font-display font-extrabold">
              <span className="text-2xl">Nível</span>
              <span className="text-6xl leading-none tracking-[-0.04em] tabular">{level.level}</span>
              <span className="text-2xl">
                · <span className="text-lime-text">{mascot.name}</span>
              </span>
            </h2>
            <p className="mt-1 text-ink-2">{mascot.line}</p>
            <Meter className="mt-5" value={level.progress} label={`Progresso até o nível ${level.level + 1}`} />
            <p className="mt-2 flex flex-wrap justify-between gap-x-4 text-sm text-ink-2 tabular">
              <span>
                <strong className="text-ink">{formatInt(level.xp)}</strong> XP no total
              </span>
              <span>
                faltam {formatInt(level.nextLevelXp - level.xp)} para o nível {level.level + 1}
              </span>
            </p>
            {nextStage && (
              <p className="mt-1 text-xs text-ink-3">
                Próximo estágio: {nextStage.name}, no nível {nextStage.minLevel}.
              </p>
            )}
          </div>
        </div>
        <dl className="relative mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
          <div>
            <dt className="text-xs text-ink-2">XP nesta semana</dt>
            <dd className="font-display text-2xl font-extrabold tabular">+{formatInt(weekXp)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-2">Semanas de constância</dt>
            <dd className="font-display text-2xl font-extrabold tabular">{streak}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-2">Desafios concluídos</dt>
            <dd className="font-display text-2xl font-extrabold tabular">{challengesDone}</dd>
          </div>
        </dl>
      </section>

      {/* Estágios do mascote */}
      <section aria-labelledby="estagios" className="mb-12">
        <SectionTitle id="estagios">Como o Broto cresce</SectionTitle>
        <p className="mb-5 text-sm text-ink-2">
          Ele cresce com o seu nível — ou seja, com constância e organização. Nunca com peso, medidas ou desempenho físico.
        </p>
        <ol className="relative grid grid-cols-5 gap-1">
          <span className="absolute top-8 right-[10%] left-[10%] h-px bg-line-strong sm:top-10" aria-hidden />
          {MASCOT_STAGES.map((s) => {
            const reached = level.level >= s.minLevel;
            const current = s.key === mascot.key;
            return (
              <li key={s.key} className="relative flex flex-col items-center text-center" aria-current={current ? "step" : undefined}>
                <div className="rounded-full bg-bg">
                  <div
                    className={cn(
                      "grid h-16 w-16 place-items-center rounded-full border sm:h-20 sm:w-20",
                      current ? "border-2 border-lime bg-lime-soft" : reached ? "border-line-strong" : "border-dashed border-line-strong",
                    )}
                  >
                    <Mascot stage={s.key} size={48} animated={false} className={reached ? undefined : "opacity-35 grayscale"} />
                  </div>
                </div>
                <span className={cn("mt-2 text-xs font-bold sm:text-sm", !reached && "text-ink-3")}>{s.name}</span>
                <span className="text-[0.7rem] text-ink-3 tabular">nível {s.minLevel}</span>
                <span className="sr-only">{current ? "(estágio atual)" : reached ? "(alcançado)" : "(ainda não alcançado)"}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Desafios */}
      <section id="desafios" aria-labelledby="desafios-titulo" className="mb-12 scroll-mt-24">
        <SectionTitle id="desafios-titulo">Desafios da semana</SectionTitle>
        <p className="mb-4 text-sm text-ink-2">
          De {formatDayMonth(weekStart)} a {formatDayMonth(addDays(weekStart, 6))}. Todos são opcionais: aceite os que fizerem sentido e pause quando
          quiser. Toda segunda recomeça, sem penalidade.
          {joined === 0 && " Nenhum aceito nesta semana — tudo bem também."}
        </p>
        <ul className="divide-y divide-line border-y border-line">
          {challenges.map(({ challenge: c, mine }) => {
            const status = mine?.status ?? null;
            const progress = mine ? Math.min(mine.progress, c.target) : 0;
            return (
              <li key={c.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                      status === "COMPLETED" ? "bg-lime text-lime-ink" : "bg-surface-2 text-lime-text",
                    )}
                  >
                    <DynamicIcon name={c.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                      {c.title}
                      <Badge tone="outline">+{c.xp} XP</Badge>
                      {status === "PAUSED" && <Badge tone="amber">Pausado</Badge>}
                      {status === "COMPLETED" && (
                        <Badge tone="lime">
                          <Check className="h-3 w-3" aria-hidden /> Concluído
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm text-ink-2">{c.description}</p>
                    {mine && (
                      <div className="mt-2 flex items-center gap-3">
                        <Meter
                          height="h-2"
                          value={progress / c.target}
                          tone={status === "COMPLETED" ? "lime" : "sky"}
                          label={`Progresso do desafio ${c.title}`}
                        />
                        <span className="shrink-0 text-xs text-ink-2 tabular">
                          {progress}/{c.target}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 justify-end">
                  {!mine ? (
                    <ActionForm action={joinChallengeAction}>
                      <input type="hidden" name="code" value={c.code} />
                      <SubmitButton variant="secondary" size="sm" pendingLabel="Aceitando…">
                        Aceitar desafio
                      </SubmitButton>
                    </ActionForm>
                  ) : status === "ACTIVE" ? (
                    <ActionForm action={pauseChallengeAction}>
                      <input type="hidden" name="id" value={mine.id} />
                      <input type="hidden" name="resume" value="0" />
                      <SubmitButton variant="ghost" size="sm" pendingLabel="Pausando…">
                        <Pause className="h-4 w-4" aria-hidden /> Pausar
                      </SubmitButton>
                    </ActionForm>
                  ) : status === "PAUSED" ? (
                    <ActionForm action={pauseChallengeAction}>
                      <input type="hidden" name="id" value={mine.id} />
                      <input type="hidden" name="resume" value="1" />
                      <SubmitButton variant="outline" size="sm" pendingLabel="Retomando…">
                        <Play className="h-4 w-4" aria-hidden /> Retomar
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {challenges.length === 0 && (
          <p className="mt-4 text-sm text-ink-2">Nenhum desafio cadastrado. Rode o seed do banco para carregar o catálogo.</p>
        )}
      </section>

      {/* Conquistas */}
      <section aria-labelledby="conquistas-titulo" className="mb-12">
        <SectionTitle id="conquistas-titulo">
          Conquistas{" "}
          <span className="text-base font-semibold text-ink-3 tabular">
            {done.length}/{ACHIEVEMENTS.length}
          </span>
        </SectionTitle>
        {done.length > 0 ? (
          <ul className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {done.map((a) => (
              <li key={a.code} className="flex flex-col gap-3 rounded-[1.5rem] border border-line bg-surface p-4">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-lime text-lime-ink shadow-[0_8px_24px_-12px_var(--lime)]">
                  <DynamicIcon name={a.icon} className="h-5 w-5" />
                </span>
                <div>
                  <p className="leading-tight font-bold">{a.title}</p>
                  <p className="mt-1 text-xs text-ink-2">{a.description}</p>
                </div>
                <p className="mt-auto text-xs text-ink-3 tabular">
                  {formatDateBR(localDate(unlockedAt.get(a.code)!, tz))} · +{a.xp} XP
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-6 flex items-center gap-3 text-sm text-ink-2">
            <Trophy className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
            A primeira chega rápido: conclua uma refeição do plano ou registre um treino.
          </p>
        )}
        {pending.length > 0 && (
          <>
            <h3 className="mb-3 text-sm font-bold text-ink-2">A caminho</h3>
            <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {pending.map(({ a, p }) => (
                <li key={a.code} className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-ink-3">
                    <DynamicIcon name={a.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex justify-between gap-2 text-sm">
                      <span className="font-semibold">{a.title}</span>
                      <span className="shrink-0 text-ink-2 tabular">
                        {p.current}/{p.target}
                      </span>
                    </p>
                    <p className="text-xs text-ink-2">{a.description}</p>
                    <Meter className="mt-2" height="h-1.5" value={p.current / p.target} label={`Progresso de ${a.title}`} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        {/* Histórico de XP */}
        <section aria-labelledby="historico-xp" id="historico" className="scroll-mt-24">
          <SectionTitle id="historico-xp">Histórico de XP</SectionTitle>
          {history.total === 0 ? (
            <EmptyState icon={<Sparkles className="h-6 w-6" aria-hidden />} title="Nenhum XP ainda">
              Cada ação concluída aparece aqui, com a origem dos pontos.
            </EmptyState>
          ) : (
            <div className="receipt-edge rounded-t-[1.75rem] bg-surface px-4 pt-5 pb-9 sm:px-6">
              <ol className="flex flex-col gap-2.5 text-sm">
                {history.events.map((e) => (
                  <li key={e.id} className="flex items-baseline gap-2">
                    <span className="w-11 shrink-0 text-xs text-ink-3 tabular">{formatDayMonth(localDate(e.createdAt, tz))}</span>
                    <span className="min-w-0 truncate">{describeXp(e.kind, e.refId)}</span>
                    <span className="dotted-leader" aria-hidden />
                    <span className="shrink-0 font-semibold text-lime-text tabular">+{e.amount}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-line-strong pt-3 text-xs text-ink-2">
                <span>
                  {showAllXp && history.total > history.events.length
                    ? `Mostrando os ${history.events.length} mais recentes de ${pluralize(history.total, "registro", "registros")}.`
                    : pluralize(history.total, "registro", "registros")}
                </span>
                {history.total > history.events.length && !showAllXp && (
                  <Link href="/conquistas?xp=todos#historico" className="font-semibold text-lime-text hover:underline">
                    Ver histórico completo
                  </Link>
                )}
                {showAllXp && (
                  <Link href="/conquistas#historico" className="font-semibold text-lime-text hover:underline">
                    Mostrar menos
                  </Link>
                )}
              </p>
            </div>
          )}
        </section>

        {/* Regras */}
        <section aria-labelledby="regras" className="rounded-[2rem] border border-line p-5 sm:p-6">
          <h2 id="regras" className="text-lg font-bold">
            Como o XP funciona
          </h2>
          <dl className="mt-4 flex flex-col gap-2 text-sm">
            {(Object.keys(XP_REWARDS) as (keyof typeof XP_REWARDS)[]).map((k) => (
              <div key={k} className="flex items-baseline gap-2">
                <dt className="text-ink-2">{XP_KIND_LABEL[k]}</dt>
                <span className="dotted-leader" aria-hidden />
                <dd className="font-semibold tabular">+{XP_REWARDS[k]}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-sm text-ink-2">
            <li>Cada ação conta uma única vez — desmarcar e marcar de novo não gera pontos extras.</li>
            <li>Não existe XP por perder peso, comer menos ou treinar além do planejado.</li>
            <li>Uma semana de constância tem 3 ou mais dias com algum registro. Dias de descanso não quebram nada.</li>
            <li>Níveis nunca diminuem.</li>
          </ul>
          <Link
            href="/perfil#configuracoes"
            className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-lime-text hover:underline"
          >
            <Settings2 className="h-4 w-4" aria-hidden /> Celebrações e lembretes
          </Link>
        </section>
      </div>
    </div>
  );
}
