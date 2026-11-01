import { describe, expect, it } from "vitest";
import { buildReminders, expectedWaterFraction, type ReminderInput } from "@/domain/gamification/reminders";

const base: ReminderInput = {
  now: "12:10",
  prefs: { notifyMeals: true, notifyWater: true, notifyWorkouts: true, notifyChallenges: true },
  pendingMeals: [],
  water: null,
  workout: null,
  challenges: [],
  daysLeftInWeek: 7,
};

describe("lembretes no app", () => {
  it("não mostra nada quando as preferências estão desligadas", () => {
    const r = buildReminders({
      ...base,
      prefs: { notifyMeals: false, notifyWater: false, notifyWorkouts: false, notifyChallenges: false },
      pendingMeals: [{ id: "m1", label: "Almoço", time: "12:00" }],
      water: { totalMl: 0, goalMl: 2000 },
      workout: { label: "A", name: "Superiores", doneToday: false, inProgress: false },
      challenges: [{ id: "c1", title: "Três treinos", progress: 1, target: 3, status: "ACTIVE" }],
      daysLeftInWeek: 1,
    });
    expect(r).toEqual([]);
  });

  it("lembra refeição só dentro da janela de horário", () => {
    const meals = [{ id: "m1", label: "Almoço", time: "12:30" }];
    expect(buildReminders({ ...base, pendingMeals: meals, now: "12:05" })[0].text).toContain("previsto para 12:30");
    expect(buildReminders({ ...base, pendingMeals: meals, now: "13:30" })[0].text).toContain("ainda sem marcação");
    expect(buildReminders({ ...base, pendingMeals: meals, now: "09:00" })).toEqual([]);
    expect(buildReminders({ ...base, pendingMeals: meals, now: "15:00" })).toEqual([]);
  });

  it("água: compara com a fração esperada do dia e respeita a tolerância", () => {
    expect(expectedWaterFraction("08:00")).toBe(0);
    expect(expectedWaterFraction("15:00")).toBe(0.5);
    expect(expectedWaterFraction("23:00")).toBe(1);
    const at15 = { ...base, now: "15:00" };
    expect(buildReminders({ ...at15, water: { totalMl: 500, goalMl: 2000 } })).toHaveLength(1);
    expect(buildReminders({ ...at15, water: { totalMl: 800, goalMl: 2000 } })).toHaveLength(0);
    expect(buildReminders({ ...at15, now: "23:00", water: { totalMl: 2000, goalMl: 2000 } })).toHaveLength(0);
  });

  it("treino: não lembra se já foi feito ou está em andamento", () => {
    const w = { label: "B", name: "Inferiores", doneToday: false, inProgress: false };
    expect(buildReminders({ ...base, workout: w })[0].kind).toBe("workout");
    expect(buildReminders({ ...base, workout: { ...w, doneToday: true } })).toEqual([]);
    expect(buildReminders({ ...base, workout: { ...w, inProgress: true } })).toEqual([]);
  });

  it("desafios: só no fim da semana, só ativos e incompletos", () => {
    const challenges = [
      { id: "c1", title: "Três treinos", progress: 1, target: 3, status: "ACTIVE" },
      { id: "c2", title: "Água em dia", progress: 2, target: 4, status: "PAUSED" },
      { id: "c3", title: "Pequenos passos", progress: 5, target: 5, status: "COMPLETED" },
    ];
    expect(buildReminders({ ...base, challenges, daysLeftInWeek: 5 })).toEqual([]);
    const r = buildReminders({ ...base, challenges, daysLeftInWeek: 2 });
    expect(r).toHaveLength(1);
    expect(r[0].text).toContain("faltam 2");
  });

  it("limita a quantidade de lembretes", () => {
    const r = buildReminders({
      ...base,
      now: "16:00",
      pendingMeals: [{ id: "m1", label: "Lanche", time: "16:00" }],
      water: { totalMl: 0, goalMl: 2000 },
      workout: { label: "A", name: "Superiores", doneToday: false, inProgress: false },
      challenges: [
        { id: "c1", title: "X", progress: 0, target: 3, status: "ACTIVE" },
        { id: "c2", title: "Y", progress: 0, target: 3, status: "ACTIVE" },
      ],
      daysLeftInWeek: 1,
    });
    expect(r).toHaveLength(4);
  });
});

describe("notificações push: janela de horário e conteúdo", () => {
  it("respeita os horários de acordar e dormir", async () => {
    const { isWithinActiveHours } = await import("@/domain/gamification/reminders");
    expect(isWithinActiveHours("06:30", "07:00", "22:00")).toBe(false);
    expect(isWithinActiveHours("07:00", "07:00", "22:00")).toBe(true);
    expect(isWithinActiveHours("21:59", "07:00", "22:00")).toBe(true);
    expect(isWithinActiveHours("22:00", "07:00", "22:00")).toBe(false);
    expect(isWithinActiveHours("12:00", null, null)).toBe(true);
    // Turno da noite: acorda 14:00, dorme 06:00
    expect(isWithinActiveHours("02:00", "14:00", "06:00")).toBe(true);
    expect(isWithinActiveHours("10:00", "14:00", "06:00")).toBe(false);
  });

  it("monta título, texto, link e etiqueta a partir do lembrete", async () => {
    const { pushPayload } = await import("@/domain/gamification/reminders");
    expect(pushPayload({ key: "water", kind: "water", text: "Água: 500 de 2.000 ml hoje.", href: "/inicio#agua" })).toEqual({
      title: "Hora de beber água",
      body: "Água: 500 de 2.000 ml hoje.",
      url: "/inicio#agua",
      tag: "water",
    });
  });
});
