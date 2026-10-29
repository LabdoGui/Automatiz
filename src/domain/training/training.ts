/**
 * Regras de treino. Sugestões são educativas: o VIVA nunca aumenta cargas
 * automaticamente; apenas indica quando o registro sugere que há margem.
 */

export type MuscleGroup =
  | "CHEST"
  | "BACK"
  | "SHOULDERS"
  | "BICEPS"
  | "TRICEPS"
  | "LEGS"
  | "GLUTES"
  | "ABS"
  | "FULL_BODY";

export const MUSCLE_GROUP_LABEL: Record<MuscleGroup, string> = {
  CHEST: "Peito",
  BACK: "Costas",
  SHOULDERS: "Ombros",
  BICEPS: "Bíceps",
  TRICEPS: "Tríceps",
  LEGS: "Pernas",
  GLUTES: "Glúteos",
  ABS: "Abdômen",
  FULL_BODY: "Corpo inteiro",
};

export const MUSCLE_GROUPS = Object.keys(MUSCLE_GROUP_LABEL) as MuscleGroup[];

export interface SetEntry {
  reps: number | null;
  weightKg: number | null;
  completed: boolean;
}

/** Volume = Σ repetições × carga das séries concluídas. */
export function setVolume(sets: readonly SetEntry[]): number {
  return sets.reduce((acc, s) => (s.completed && s.reps && s.weightKg ? acc + s.reps * s.weightKg : acc), 0);
}

export function maxWeight(sets: readonly SetEntry[]): number | null {
  const ws = sets.filter((s) => s.completed && s.weightKg !== null).map((s) => s.weightKg!);
  return ws.length ? Math.max(...ws) : null;
}

export function sessionDurationSeconds(params: {
  startedAt: Date;
  endedAt: Date | null;
  pausedAt: Date | null;
  pausedSeconds: number;
  now?: Date;
}): number {
  const end = params.endedAt ?? params.pausedAt ?? params.now ?? new Date();
  const raw = Math.floor((end.getTime() - params.startedAt.getTime()) / 1000);
  return Math.max(0, raw - params.pausedSeconds);
}

export type ProgressionAdvice =
  | { kind: "no-data" }
  | { kind: "keep"; message: string }
  | { kind: "consider-increase"; message: string }
  | { kind: "caution"; message: string };

/**
 * Sugestão baseada no último registro do exercício:
 *  - desconforto relatado → manter/reduzir e procurar orientação;
 *  - todas as séries concluídas no topo da faixa de repetições, com a mesma
 *    carga, em duas sessões seguidas → pode considerar um aumento pequeno;
 *  - caso contrário → manter a carga e buscar completar a faixa.
 */
export function progressionAdvice(params: {
  lastSessions: readonly { sets: readonly SetEntry[]; discomfort: boolean }[];
  repsMax: number;
}): ProgressionAdvice {
  const { lastSessions, repsMax } = params;
  const latest = lastSessions[0];
  if (!latest || latest.sets.length === 0) return { kind: "no-data" };
  if (latest.discomfort) {
    return {
      kind: "caution",
      message:
        "Você relatou desconforto no último treino. Mantenha ou reduza a carga e procure orientação profissional se a dor persistir.",
    };
  }
  const topped = (s: { sets: readonly SetEntry[] }) =>
    s.sets.length > 0 && s.sets.every((x) => x.completed && (x.reps ?? 0) >= repsMax);
  const sameLoad = (a: { sets: readonly SetEntry[] }, b: { sets: readonly SetEntry[] }) =>
    maxWeight(a.sets) !== null && maxWeight(a.sets) === maxWeight(b.sets);
  const previous = lastSessions[1];
  if (topped(latest) && previous && topped(previous) && sameLoad(latest, previous)) {
    return {
      kind: "consider-increase",
      message:
        "Você completou o topo da faixa em todas as séries nas duas últimas sessões. Se a execução estiver firme e sem dor, considere um aumento pequeno (por exemplo, 1 a 2,5 kg).",
    };
  }
  return { kind: "keep", message: "Mantenha a carga e foque em completar a faixa de repetições com boa técnica." };
}

export interface SuggestedWorkout {
  label: string;
  name: string;
  groups: MuscleGroup[];
}

/** Divisões educativas conforme frequência e experiência. */
export function suggestSplit(daysPerWeek: number, level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"): SuggestedWorkout[] {
  if (daysPerWeek <= 3 || level === "BEGINNER") {
    return [
      { label: "A", name: "Corpo inteiro A", groups: ["LEGS", "CHEST", "BACK", "ABS"] },
      { label: "B", name: "Corpo inteiro B", groups: ["GLUTES", "SHOULDERS", "BACK", "ABS"] },
    ];
  }
  if (daysPerWeek === 4) {
    return [
      { label: "A", name: "Superiores", groups: ["CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS"] },
      { label: "B", name: "Inferiores", groups: ["LEGS", "GLUTES", "ABS"] },
    ];
  }
  return [
    { label: "A", name: "Peito e tríceps", groups: ["CHEST", "TRICEPS", "ABS"] },
    { label: "B", name: "Costas e bíceps", groups: ["BACK", "BICEPS"] },
    { label: "C", name: "Pernas e ombros", groups: ["LEGS", "GLUTES", "SHOULDERS"] },
  ];
}

/** Distribui os treinos da divisão pelos dias escolhidos (0 = segunda). */
export function assignWeekdays(workouts: number, weekdays: readonly number[]): number[][] {
  const days = [...new Set(weekdays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  const result: number[][] = Array.from({ length: workouts }, () => []);
  days.forEach((d, i) => result[i % workouts].push(d));
  return result;
}
