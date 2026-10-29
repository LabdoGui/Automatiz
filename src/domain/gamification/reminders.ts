import { timeToMinutes } from "../dates";
import { formatInt } from "../format";

/**
 * Lembretes dentro do app (exibidos no início). Só aparecem para o que o
 * usuário ativou, sem tom de cobrança e sem consequência se ignorados.
 */
export interface ReminderPrefs {
  notifyMeals: boolean;
  notifyWater: boolean;
  notifyWorkouts: boolean;
  notifyChallenges: boolean;
}

export interface ReminderInput {
  /** Hora local "HH:MM" */
  now: string;
  prefs: ReminderPrefs;
  pendingMeals: { id: string; label: string; time: string | null }[];
  water: { totalMl: number; goalMl: number } | null;
  workout: { label: string; name: string; doneToday: boolean; inProgress: boolean } | null;
  challenges: { id: string; title: string; progress: number; target: number; status: string }[];
  /** Dias restantes na semana, contando hoje (segunda = 7, domingo = 1) */
  daysLeftInWeek: number;
}

export interface Reminder {
  key: string;
  kind: "meal" | "water" | "workout" | "challenge";
  text: string;
  href: string;
}

const MEAL_WINDOW_BEFORE = 30;
const MEAL_WINDOW_AFTER = 120;
const WATER_DAY_START = 8 * 60;
const WATER_DAY_END = 22 * 60;
const WATER_TOLERANCE_ML = 250;

/** Fração da meta de água esperada até agora, distribuída entre 8h e 22h. */
export function expectedWaterFraction(now: string): number {
  const m = timeToMinutes(now);
  return Math.max(0, Math.min(1, (m - WATER_DAY_START) / (WATER_DAY_END - WATER_DAY_START)));
}

export function buildReminders(input: ReminderInput, max = 4): Reminder[] {
  const out: Reminder[] = [];
  const now = timeToMinutes(input.now);

  if (input.prefs.notifyMeals) {
    const meal = input.pendingMeals.find((m) => {
      if (!m.time) return false;
      const t = timeToMinutes(m.time);
      return now >= t - MEAL_WINDOW_BEFORE && now <= t + MEAL_WINDOW_AFTER;
    });
    if (meal) {
      const passed = timeToMinutes(meal.time!) < now;
      out.push({
        key: `meal:${meal.id}`,
        kind: "meal",
        text: passed
          ? `${meal.label} (${meal.time}) ainda sem marcação. Comeu algo diferente? Registre do jeito que foi.`
          : `${meal.label} previsto para ${meal.time}.`,
        href: `/alimentacao/refeicao/${meal.id}`,
      });
    }
  }

  if (input.prefs.notifyWater && input.water && input.water.goalMl > 0) {
    const expected = input.water.goalMl * expectedWaterFraction(input.now);
    if (input.water.totalMl < input.water.goalMl && input.water.totalMl + WATER_TOLERANCE_ML < expected) {
      out.push({
        key: "water",
        kind: "water",
        text: `Água: ${formatInt(input.water.totalMl)} de ${formatInt(input.water.goalMl)} ml hoje. Um copo agora ajuda.`,
        href: "/inicio#agua",
      });
    }
  }

  if (input.prefs.notifyWorkouts && input.workout && !input.workout.doneToday && !input.workout.inProgress) {
    out.push({
      key: "workout",
      kind: "workout",
      text: `Treino ${input.workout.label} (${input.workout.name}) está previsto para hoje. Se precisar descansar, tudo bem.`,
      href: "/treino",
    });
  }

  if (input.prefs.notifyChallenges && input.daysLeftInWeek <= 3) {
    for (const c of input.challenges) {
      if (c.status !== "ACTIVE" || c.progress >= c.target) continue;
      const missing = c.target - c.progress;
      out.push({
        key: `challenge:${c.id}`,
        kind: "challenge",
        text: `Desafio “${c.title}”: faltam ${missing} até domingo. É opcional — pausar não tira nada.`,
        href: "/conquistas#desafios",
      });
    }
  }

  return out.slice(0, max);
}
