import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  consistentWeeks,
  levelFromXp,
  mascotForLevel,
  newlyUnlocked,
  xpForLevel,
  type UserStats,
} from "@/domain/gamification/rules";
import {
  assignWeekdays,
  maxWeight,
  progressionAdvice,
  sessionDurationSeconds,
  setVolume,
  suggestSplit,
} from "@/domain/training/training";
import { addDays, isISODate, localDate, startOfWeek, weekdayIndex } from "@/domain/dates";

const emptyStats: UserStats = {
  plansCreated: 0,
  organizedWeeks: 0,
  mealsCompleted: 0,
  mealsLogged: 0,
  workoutsCompleted: 0,
  shoppingListsDone: 0,
  waterGoalDays: 0,
  habitChecks: 0,
  pricesRegistered: 0,
  pantryItems: 0,
  activeDays: 0,
};

describe("níveis", () => {
  it("limiares crescentes", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(xpForLevel(4)).toBe(600);
  });

  it.each([
    [0, 1],
    [99, 1],
    [100, 2],
    [299, 2],
    [300, 3],
    [10_000, 14],
    [10_500, 15],
  ])("%d XP → nível %d", (xp, level) => {
    expect(levelFromXp(xp).level).toBe(level);
  });

  it("progresso entre 0 e 1", () => {
    const info = levelFromXp(200);
    expect(info.progress).toBeCloseTo(0.5, 5);
  });

  it("mascote evolui por nível", () => {
    expect(mascotForLevel(1).key).toBe("semente");
    expect(mascotForLevel(3).key).toBe("broto");
    expect(mascotForLevel(12).key).toBe("arvore");
  });
});

describe("conquistas", () => {
  it("desbloqueia apenas as que atingiram o critério e ainda não foram obtidas", () => {
    const stats = { ...emptyStats, workoutsCompleted: 5, plansCreated: 1 };
    const unlocked = newlyUnlocked(stats, new Set(["first-plan"]));
    expect(unlocked.map((a) => a.code).sort()).toEqual(["first-workout", "five-workouts"]);
  });

  it("nenhuma conquista recompensa peso ou restrição alimentar", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.description.toLowerCase()).not.toMatch(/peso|emagre|kg|calori|jejum/);
    }
  });

  it("sete dias não exigem dias consecutivos", () => {
    const def = ACHIEVEMENTS.find((a) => a.code === "seven-days")!;
    expect(def.test({ ...emptyStats, activeDays: 7 })).toBe(true);
  });
});

describe("consistência semanal sem culpa", () => {
  it("semana atual incompleta não zera a sequência", () => {
    expect(consistentWeeks([1, 3, 4, 5])).toBe(3);
  });
  it("conta semanas consecutivas com 3+ dias ativos", () => {
    expect(consistentWeeks([3, 4, 2, 5])).toBe(2);
  });
  it("zero quando não há histórico", () => {
    expect(consistentWeeks([])).toBe(0);
  });
});

describe("treino", () => {
  const sets = (reps: number[], weight: number) =>
    reps.map((r) => ({ reps: r, weightKg: weight, completed: true }));

  it("volume e carga máxima", () => {
    expect(setVolume(sets([10, 10, 8], 20))).toBe(560);
    expect(setVolume([{ reps: 10, weightKg: 20, completed: false }])).toBe(0);
    expect(maxWeight(sets([10], 22.5))).toBe(22.5);
    expect(maxWeight([])).toBeNull();
  });

  it("não sugere aumento sem duas sessões no topo da faixa", () => {
    const advice = progressionAdvice({ lastSessions: [{ sets: sets([12, 12, 12], 20), discomfort: false }], repsMax: 12 });
    expect(advice.kind).toBe("keep");
  });

  it("sugere considerar aumento após duas sessões no topo com mesma carga", () => {
    const advice = progressionAdvice({
      lastSessions: [
        { sets: sets([12, 12, 12], 20), discomfort: false },
        { sets: sets([12, 12, 12], 20), discomfort: false },
      ],
      repsMax: 12,
    });
    expect(advice.kind).toBe("consider-increase");
  });

  it("prioriza cautela quando houve desconforto", () => {
    const advice = progressionAdvice({
      lastSessions: [
        { sets: sets([12, 12, 12], 20), discomfort: true },
        { sets: sets([12, 12, 12], 20), discomfort: false },
      ],
      repsMax: 12,
    });
    expect(advice.kind).toBe("caution");
  });

  it("duração desconta pausas", () => {
    const startedAt = new Date("2026-10-29T10:00:00Z");
    const endedAt = new Date("2026-10-29T11:00:00Z");
    expect(sessionDurationSeconds({ startedAt, endedAt, pausedAt: null, pausedSeconds: 600 })).toBe(3000);
  });

  it("divisões sugeridas e distribuição nos dias", () => {
    expect(suggestSplit(3, "BEGINNER").map((w) => w.label)).toEqual(["A", "B"]);
    expect(suggestSplit(5, "INTERMEDIATE")).toHaveLength(3);
    expect(assignWeekdays(2, [0, 2, 4])).toEqual([[0, 4], [2]]);
  });
});

describe("datas", () => {
  it("semana começa na segunda", () => {
    expect(startOfWeek("2026-10-29")).toBe("2026-10-26"); // quinta → segunda
    expect(startOfWeek("2026-11-01")).toBe("2026-10-26"); // domingo → segunda anterior
    expect(weekdayIndex("2026-10-26")).toBe(0);
  });

  it("dia local respeita o fuso", () => {
    const instant = new Date("2026-10-30T02:30:00Z");
    expect(localDate(instant, "America/Sao_Paulo")).toBe("2026-10-29");
    expect(localDate(instant, "UTC")).toBe("2026-10-30");
  });

  it("valida datas", () => {
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2026-02-28")).toBe(true);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
