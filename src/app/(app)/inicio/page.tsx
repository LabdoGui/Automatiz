import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Bell,
  Droplets,
  CalendarPlus,
  Dumbbell,
  Flag,
  NotebookPen,
  PlayCircle,
  ShoppingBasket,
  Sparkles,
  Trophy,
  Utensils,
} from "lucide-react";
import { localDate, localTime, startOfWeek, timeToMinutes, toDbDate, weekdayIndex, WEEKDAY_LONG } from "@/domain/dates";
import { formatBRL, formatDateLong, formatDec, formatInt } from "@/domain/format";
import { goalProgress, mealTotals, roundTotals, sumTotals } from "@/domain/nutrition/calc";
import { MEAL_TYPE_LABEL } from "@/domain/planner/meal-types";
import { ACHIEVEMENTS, levelFromXp, mascotForLevel } from "@/domain/gamification/rules";
import { buildReminders, type Reminder } from "@/domain/gamification/reminders";
import { Mascot } from "@/components/brand/mascot";
import { LinkButton } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { ProgressRing } from "@/components/ui/progress-ring";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { MacroLine } from "@/components/nutrition/nutrients";
import { MealCheck } from "@/components/planner/meal-check";
import { WaterWidget } from "@/components/progress/water-widget";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/fields";
import { clockFor, requireOnboardedUser } from "@/server/session";
import { db } from "@/server/db";
import { dayLogs, getActivePlan, mealNutrition, plannerContext } from "@/server/services/planner";
import { factsOf } from "@/server/services/foods";
import { getActiveRoutine, openSession } from "@/server/services/training";
import { waterTotal } from "@/server/services/progress";
import { getOpenList, listSummary } from "@/server/services/shopping";
import { computeStats, consistencyStreak } from "@/server/services/gamification";
import { generatePlanAction } from "@/server/actions/planner";
import { startWorkoutAction } from "@/server/actions/training";

export const metadata: Metadata = { title: "Início" };

function greeting(hhmm: string) {
  const h = Number(hhmm.slice(0, 2));
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ bemvindo?: string }> }) {
  const { user, profile, settings } = await requireOnboardedUser();
  const { tz, today } = clockFor(settings);
  const now = localTime(new Date(), tz);
  const weekStart = startOfWeek(today);
  const { bemvindo } = await searchParams;

  const [plan, ctx, logs, routine, session, water, list, challenges, unlocked, stats, streak, lastWorkout] = await Promise.all([
    getActivePlan(user.id, weekStart),
    plannerContext(user.id),
    dayLogs(user.id, today),
    getActiveRoutine(user.id),
    openSession(user.id),
    profile.trackWater ? waterTotal(user.id, today) : Promise.resolve(0),
    getOpenList(user.id),
    db.userChallenge.findMany({ where: { userId: user.id, weekStart: toDbDate(weekStart) }, include: { challenge: true }, orderBy: { startedAt: "asc" } }),
    db.userAchievement.findMany({ where: { userId: user.id }, include: { achievement: true }, orderBy: { unlockedAt: "desc" } }),
    computeStats(user.id, tz),
    consistencyStreak(user.id, tz, today),
    db.workoutSession.findFirst({ where: { userId: user.id, status: "COMPLETED" }, orderBy: { startedAt: "desc" }, select: { startedAt: true } }),
  ]);

  const todayMeals = plan?.meals.filter((m) => m.date.toISOString().slice(0, 10) === today) ?? [];
  const pending = todayMeals.filter((m) => !m.completedAt);
  const nextMeal =
    pending.find((m) => m.time && timeToMinutes(m.time) >= timeToMinutes(now) - 60) ?? pending[0] ?? null;
  const consumed = roundTotals(
    sumTotals([
      ...todayMeals.filter((m) => m.completedAt).map(mealNutrition),
      ...logs.map((l) => mealTotals(l.items.map((i) => ({ facts: factsOf(i.food), grams: i.grams })))),
    ]),
  );
  const goal = ctx.dailyGoal;
  const kcalProgress = goalProgress(consumed.values.kcal, goal?.kcal ?? null);

  const weekday = weekdayIndex(today);
  const todaysWorkout = routine?.workouts.find((w) => w.weekdays.includes(weekday)) ?? null;
  const level = levelFromXp(profile.xpTotal);
  const mascot = mascotForLevel(level.level);
  const listInfo = list ? listSummary(list) : null;
  const unlockedCodes = new Set(unlocked.map((u) => u.achievement.code));
  const nextAchievement = ACHIEVEMENTS.filter((a) => !unlockedCodes.has(a.code))
    .map((a) => ({ a, p: a.progress(stats) }))
    .sort((x, y) => y.p.current / y.p.target - x.p.current / x.p.target)[0];
  const activeChallenges = challenges.filter((c) => c.status !== "COMPLETED" || c.completedAt);
  const reminders = settings
    ? buildReminders({
        now,
        prefs: settings,
        pendingMeals: pending.map((m) => ({ id: m.id, label: MEAL_TYPE_LABEL[m.mealType], time: m.time })),
        water: profile.trackWater && profile.waterGoalMl ? { totalMl: water, goalMl: profile.waterGoalMl } : null,
        workout: todaysWorkout
          ? {
              label: todaysWorkout.label,
              name: todaysWorkout.name,
              doneToday: lastWorkout ? localDate(lastWorkout.startedAt, tz) === today : false,
              inProgress: Boolean(session),
            }
          : null,
        challenges: challenges.map((c) => ({ id: c.id, title: c.challenge.title, progress: c.progress, target: c.challenge.target, status: c.status })),
        daysLeftInWeek: 7 - weekday,
      })
    : [];

  return (
    <div className="flex flex-col gap-8">
      {bemvindo && (
        <div className="grain relative flex animate-pop items-center gap-4 overflow-hidden rounded-[2rem] bg-lime p-5 text-lime-ink">
          <Mascot stage="broto" size={72} animated={false} />
          <div>
            <p className="font-display text-xl font-extrabold">Sua semana está pronta.</p>
            <p className="text-sm">Planejamos as refeições a partir do seu perfil. Ajuste o que quiser — o plano é seu.</p>
          </div>
        </div>
      )}

      <header className="flex items-end justify-between gap-4 animate-rise">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-2">
            {WEEKDAY_LONG[weekday]}, {formatDateLong(today)}
          </p>
          <h1 className="mt-1 text-[2.4rem] leading-[0.95] font-extrabold tracking-[-0.035em] sm:text-5xl">
            {greeting(now)},
            <br />
            <span className="text-lime-text">{profile.displayName}.</span>
          </h1>
          <p className="mt-3 text-ink-2">
            {todayMeals.length > 0 ? `${todayMeals.length - pending.length} de ${todayMeals.length} refeições feitas` : "Nenhuma refeição planejada hoje"}
            {" · "}
            {todaysWorkout ? `Treino ${todaysWorkout.label} hoje` : "dia de descanso"}
            {streak > 0 && ` · ${streak} ${streak === 1 ? "semana" : "semanas"} de constância`}
          </p>
        </div>
        <Link href="/conquistas" className="hidden shrink-0 flex-col items-center sm:flex" aria-label={`Seu Broto: ${mascot.name}, nível ${level.level}`}>
          <Mascot stage={mascot.key} size={110} />
          <span className="text-xs font-bold text-ink-2">
            {mascot.name} · nível {level.level}
          </span>
        </Link>
      </header>

      {reminders.length > 0 && <Reminders items={reminders} />}

      {/* Próxima refeição */}
      <section aria-labelledby="proxima">
        {!plan ? (
          <div className="flex flex-col gap-4 rounded-[2rem] border border-dashed border-line-strong p-6 sm:flex-row sm:items-center">
            <div className="flex-1">
              <h2 id="proxima" className="text-xl font-extrabold">
                Vamos planejar esta semana?
              </h2>
              <p className="mt-1 text-sm text-ink-2">O VIVA monta refeições compatíveis com seu perfil. Você ajusta como quiser.</p>
            </div>
            <ActionForm action={generatePlanAction}>
              <input type="hidden" name="weekStart" value={weekStart} />
              <SubmitButton pendingLabel="Montando…">
                <CalendarPlus className="h-4 w-4" aria-hidden /> Gerar plano
              </SubmitButton>
            </ActionForm>
          </div>
        ) : nextMeal ? (
          <div className="relative overflow-hidden rounded-[2rem] bg-lime p-5 text-lime-ink sm:p-6">
            <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
            <p id="proxima" className="text-xs font-bold uppercase tracking-[0.16em] text-lime-ink/70">
              Próxima refeição · {nextMeal.time ?? MEAL_TYPE_LABEL[nextMeal.mealType]}
            </p>
            <div className="mt-2 flex items-start gap-4">
              <Link href={`/alimentacao/refeicao/${nextMeal.id}`} className="min-w-0 flex-1">
                <h2 className="text-2xl leading-tight font-extrabold sm:text-3xl">{nextMeal.title}</h2>
                {nextMeal.isFlexible ? (
                  <p className="mt-1 text-sm">Refeição flexível — aproveite com tranquilidade.</p>
                ) : (
                  <MacroLine totals={roundTotals(mealNutrition(nextMeal))} className="mt-1 text-lime-ink/80 [&_span]:text-lime-ink" />
                )}
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold underline-offset-4 hover:underline">
                  Ver ingredientes e preparo <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </Link>
              <MealCheck mealId={nextMeal.id} completed={false} title={nextMeal.title} size="lg" onLime />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 rounded-[2rem] border border-line bg-surface p-5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-lime-soft text-lime-text">
              <Utensils className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h2 id="proxima" className="font-bold">
                {todayMeals.length ? "Refeições de hoje marcadas" : "Sem refeições planejadas hoje"}
              </h2>
              <p className="text-sm text-ink-2">
                {todayMeals.length ? "Ótimo dia de cuidado. Amanhã tem mais." : "Adicione uma refeição ou registre o que comer."}
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2 [&>*]:min-w-0">
        {/* Alimentação de hoje */}
        <section aria-labelledby="hoje-alimentacao" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 id="hoje-alimentacao" className="text-lg font-bold">
              Hoje no prato
            </h2>
            <Link href="/alimentacao" className="text-sm font-semibold text-lime-text hover:underline">
              Ver semana
            </Link>
          </div>
          <div className="flex items-center gap-5">
            <ProgressRing value={kcalProgress} size={116} stroke={10} label={goal?.kcal ? "Energia registrada em relação à meta" : "Energia registrada hoje"}>
              <span className="font-display text-2xl leading-none font-extrabold tabular">
                {formatInt(consumed.values.kcal)}
                <span className="block text-[0.65rem] font-semibold text-ink-3">kcal registradas</span>
              </span>
            </ProgressRing>
            <div className="text-sm text-ink-2">
              {goal?.kcal ? (
                <p>
                  Meta diária: <strong className="text-ink">{formatInt(goal.kcal)} kcal</strong>
                  <span className="block text-xs">{ctx.goalSource === "PROFESSIONAL" ? "do(a) nutricionista" : "registrada por você"}</span>
                </p>
              ) : (
                <p>Sem meta definida — acompanhe só o que ajuda você.</p>
              )}
              <p className="mt-2 tabular">
                P {formatDec(consumed.values.proteinG)} g · C {formatDec(consumed.values.carbsG)} g · G {formatDec(consumed.values.fatG)} g
              </p>
              {consumed.incomplete.length > 0 && <p className="mt-1 text-xs text-amber-text">Alguns valores estão incompletos na fonte.</p>}
            </div>
          </div>
          {todayMeals.length > 0 && (
            <ol className="relative flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {todayMeals.map((m) => (
                <li key={m.id} className="shrink-0">
                  <Link
                    href={`/alimentacao/refeicao/${m.id}`}
                    className={`flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold ${m.completedAt ? "border-lime/40 bg-lime-soft text-lime-text" : "border-line text-ink-2"}`}
                  >
                    <span className="tabular">{m.time}</span> {MEAL_TYPE_LABEL[m.mealType]}
                  </Link>
                </li>
              ))}
            </ol>
          )}
          <div className="flex gap-2">
            <LinkButton href={`/alimentacao/registrar?dia=${today}`} variant="secondary" size="sm">
              <NotebookPen className="h-4 w-4" aria-hidden /> Registrar fora do plano
            </LinkButton>
          </div>
        </section>

        {/* Treino */}
        <section aria-labelledby="treino-hoje" className="grain relative flex flex-col justify-between gap-5 overflow-hidden rounded-[2rem] border border-line bg-surface-2 p-5 sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-3">Treino de hoje</p>
            {session ? (
              <>
                <h2 id="treino-hoje" className="mt-1 text-2xl font-extrabold">
                  {session.title}
                </h2>
                <p className="mt-1 text-sm text-ink-2">{session.status === "PAUSED" ? "Pausado — continue quando quiser." : "Em andamento."}</p>
              </>
            ) : todaysWorkout ? (
              <>
                <h2 id="treino-hoje" className="mt-1 text-2xl font-extrabold">
                  Treino {todaysWorkout.label} · {todaysWorkout.name}
                </h2>
                <p className="mt-1 text-sm text-ink-2">
                  {todaysWorkout.exercises.length} exercícios · {todaysWorkout.exercises.slice(0, 3).map((e) => e.exercise.name).join(", ")}
                  {todaysWorkout.exercises.length > 3 ? "…" : ""}
                </p>
              </>
            ) : (
              <>
                <h2 id="treino-hoje" className="mt-1 flex items-center gap-2 text-2xl font-extrabold">
                  <BedDouble className="h-6 w-6 text-ink-2" aria-hidden /> Dia de descanso
                </h2>
                <p className="mt-1 text-sm text-ink-2">
                  {routine ? "Recuperação também faz parte do treino." : "Você ainda não tem uma rotina de treinos."}
                </p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {session ? (
              <LinkButton href={`/treino/sessao/${session.id}`}>
                <PlayCircle className="h-4 w-4" aria-hidden /> Continuar treino
              </LinkButton>
            ) : todaysWorkout ? (
              <ActionForm action={startWorkoutAction}>
                <input type="hidden" name="workoutId" value={todaysWorkout.id} />
                <SubmitButton pendingLabel="Preparando…">
                  <Dumbbell className="h-4 w-4" aria-hidden /> Começar treino
                </SubmitButton>
              </ActionForm>
            ) : (
              <LinkButton href="/treino" variant="secondary">
                {routine ? "Ver rotina" : "Montar rotina"}
              </LinkButton>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2 [&>*]:min-w-0">
        {profile.trackWater && profile.waterGoalMl ? (
          <section aria-labelledby="agua">
            <h2 id="agua" className="mb-4 text-lg font-bold">
              Água
            </h2>
            <WaterWidget totalMl={water} goalMl={profile.waterGoalMl} />
          </section>
        ) : null}

        {/* Compras */}
        <section aria-labelledby="compras-resumo">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="compras-resumo" className="text-lg font-bold">
              Compras e orçamento
            </h2>
            <Link href="/compras" className="text-sm font-semibold text-lime-text hover:underline">
              Abrir lista
            </Link>
          </div>
          {listInfo && list ? (
            <div className="rounded-3xl border border-line bg-surface p-5">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm text-ink-2">
                  <strong className="font-display text-2xl text-ink tabular">{listInfo.pending}</strong> itens a comprar
                </p>
                <p className="text-sm text-ink-2 tabular">
                  ≈ {formatBRL(listInfo.budget.estimatedCents)}
                  {listInfo.budget.missingPrices > 0 && "*"}
                </p>
              </div>
              {listInfo.budget.budgetCents !== null ? (
                <>
                  <Meter
                    className="mt-4"
                    value={listInfo.budget.usage ?? 0}
                    tone={listInfo.budget.overBudget ? "danger" : "lime"}
                    label="Uso do orçamento semanal"
                  />
                  <p className={`mt-2 text-sm ${listInfo.budget.overBudget ? "text-danger-text" : "text-ink-2"}`}>
                    {listInfo.budget.overBudget
                      ? `Acima do orçamento em ${formatBRL(-(listInfo.budget.remainingCents ?? 0))}`
                      : `Saldo estimado: ${formatBRL(listInfo.budget.remainingCents ?? 0)}`}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-ink-2">Defina um orçamento no perfil para acompanhar o saldo.</p>
              )}
              {listInfo.budget.missingPrices > 0 && (
                <p className="mt-2 text-xs text-ink-3">* {listInfo.budget.missingPrices} itens ainda sem preço.</p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4 rounded-3xl border border-dashed border-line-strong p-5">
              <ShoppingBasket className="h-8 w-8 shrink-0 text-ink-3" aria-hidden />
              <div className="flex-1 text-sm text-ink-2">Transforme o plano da semana em uma lista consolidada, com embalagens e orçamento.</div>
              <LinkButton href="/compras" size="sm" variant="secondary">
                Gerar
              </LinkButton>
            </div>
          )}
        </section>
      </div>

      {/* Desafios e conquistas */}
      <div className="grid gap-8 lg:grid-cols-2 [&>*]:min-w-0">
        <section aria-labelledby="desafios">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="desafios" className="text-lg font-bold">
              Desafios da semana
            </h2>
            <Link href="/conquistas#desafios" className="text-sm font-semibold text-lime-text hover:underline">
              {activeChallenges.length ? "Gerenciar" : "Escolher"}
            </Link>
          </div>
          {activeChallenges.length === 0 ? (
            <p className="flex items-center gap-3 text-sm text-ink-2">
              <Flag className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
              Desafios são opcionais e podem ser pausados. Escolha um se tiver vontade.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {activeChallenges.map((uc) => (
                <li key={uc.id} className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lime-text">
                    <DynamicIcon name={uc.challenge.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-semibold">{uc.challenge.title}</span>
                      <span className="text-ink-2 tabular">
                        {uc.status === "PAUSED" ? "pausado" : `${uc.progress}/${uc.challenge.target}`}
                      </span>
                    </div>
                    <Meter className="mt-1.5" height="h-2" value={uc.progress / uc.challenge.target} tone={uc.status === "COMPLETED" ? "lime" : "sky"} label={uc.challenge.title} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="conquistas">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="conquistas" className="text-lg font-bold">
              Conquistas
            </h2>
            <Link href="/conquistas" className="text-sm font-semibold text-lime-text hover:underline">
              {unlocked.length}/{ACHIEVEMENTS.length}
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {unlocked[0] && (
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime text-lime-ink">
                  <DynamicIcon name={unlocked[0].achievement.icon} className="h-5 w-5" />
                </span>
                <div className="text-sm">
                  <p className="font-semibold">{unlocked[0].achievement.title}</p>
                  <p className="text-ink-2">Desbloqueada recentemente</p>
                </div>
              </div>
            )}
            {nextAchievement && (
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-dashed border-line-strong text-ink-3">
                  <Trophy className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">Próxima: {nextAchievement.a.title}</p>
                  <Meter
                    className="mt-1.5"
                    height="h-2"
                    value={nextAchievement.p.current / nextAchievement.p.target}
                    label={`Progresso de ${nextAchievement.a.title}`}
                  />
                </div>
                <span className="text-xs text-ink-2 tabular">
                  {nextAchievement.p.current}/{nextAchievement.p.target}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      <section aria-labelledby="atalhos">
        <h2 id="atalhos" className="sr-only">
          Atalhos
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { href: "/alimentacao", label: "Planejamento", icon: CalendarPlus },
            { href: "/compras", label: "Lista de compras", icon: ShoppingBasket },
            { href: "/treino", label: "Treinos", icon: Dumbbell },
            { href: "/assistente", label: "Assistente", icon: Sparkles },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex min-h-14 items-center gap-2.5 rounded-2xl border border-line px-4 text-sm font-semibold hover:bg-surface-2">
              <Icon className="h-5 w-5 text-lime-text" aria-hidden /> {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

const REMINDER_ICON: Record<Reminder["kind"], typeof Bell> = {
  meal: Utensils,
  water: Droplets,
  workout: Dumbbell,
  challenge: Flag,
};

function Reminders({ items }: { items: Reminder[] }) {
  return (
    <section aria-labelledby="lembretes" className="-mt-2">
      <h2 id="lembretes" className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-[0.14em] text-ink-3 uppercase">
        <Bell className="h-3.5 w-3.5" aria-hidden /> Lembretes
      </h2>
      <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
        {items.map((r) => {
          const Icon = REMINDER_ICON[r.kind];
          return (
            <li key={r.key}>
              <Link href={r.href} className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2">
                <Icon className="h-4 w-4 shrink-0 text-lime-text" aria-hidden />
                <span className="min-w-0 flex-1">{r.text}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-xs text-ink-3">
        Ajuste em <Link href="/perfil#configuracoes" className="underline">Perfil → Aparência e avisos</Link>.
      </p>
    </section>
  );
}
