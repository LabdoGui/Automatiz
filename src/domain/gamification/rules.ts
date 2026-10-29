/**
 * Gamificação do VIVA — recompensa consistência e organização, nunca restrição.
 *
 * - XP vem de ações concluídas (refeição registrada, treino, lista de compras…).
 * - Não há XP por perda de peso, por comer menos ou por treinar além do planejado.
 * - Não existe penalidade: descansar não remove XP nem "quebra" nada.
 * - A sequência é medida em semanas com pelo menos 3 dias ativos, permitindo
 *   pausas sem culpa.
 */

export const XP_REWARDS = {
  ONBOARDING_DONE: 50,
  PLAN_CREATED: 40,
  MEAL_COMPLETED: 10,
  MEAL_LOGGED: 5,
  WORKOUT_COMPLETED: 50,
  SHOPPING_DONE: 30,
  WATER_GOAL: 10,
  HABIT_CHECK: 5,
  PRICE_ADDED: 2,
} as const;

export type XpKind = keyof typeof XP_REWARDS | "ACHIEVEMENT" | "CHALLENGE";

/** XP total necessário para atingir o nível n (n ≥ 1): 50·n·(n−1). */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export interface LevelInfo {
  level: number;
  xp: number;
  levelStartXp: number;
  nextLevelXp: number;
  progress: number;
}

export function levelFromXp(xpRaw: number): LevelInfo {
  const xp = Math.max(0, Math.floor(xpRaw));
  // Resolve 50n(n−1) ≤ xp
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2));
  while (xpForLevel(level + 1) <= xp) level += 1;
  while (level > 1 && xpForLevel(level) > xp) level -= 1;
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, xp, levelStartXp: start, nextLevelXp: next, progress: (xp - start) / (next - start) };
}

export const MASCOT_STAGES = [
  { minLevel: 1, key: "semente", name: "Semente", line: "Tudo começa pequeno." },
  { minLevel: 2, key: "broto", name: "Broto", line: "Já tem raiz. Segue no seu ritmo." },
  { minLevel: 4, key: "muda", name: "Muda", line: "Folhas novas a cada semana." },
  { minLevel: 7, key: "planta", name: "Planta", line: "Constância virou parte da rotina." },
  { minLevel: 10, key: "arvore", name: "Árvore", line: "Raízes fortes, sombra boa." },
] as const;

export type MascotStage = (typeof MASCOT_STAGES)[number];

export function mascotForLevel(level: number): MascotStage {
  let stage: MascotStage = MASCOT_STAGES[0];
  for (const s of MASCOT_STAGES) if (level >= s.minLevel) stage = s;
  return stage;
}

export interface UserStats {
  plansCreated: number;
  organizedWeeks: number;
  mealsCompleted: number;
  mealsLogged: number;
  workoutsCompleted: number;
  shoppingListsDone: number;
  waterGoalDays: number;
  habitChecks: number;
  pricesRegistered: number;
  pantryItems: number;
  /** Dias distintos com qualquer registro (não precisam ser consecutivos) */
  activeDays: number;
}

export interface AchievementDef {
  code: string;
  title: string;
  description: string;
  icon: string;
  xp: number;
  test: (s: UserStats) => boolean;
  progress: (s: UserStats) => { current: number; target: number };
}

const count = (key: keyof UserStats, target: number) => ({
  test: (s: UserStats) => s[key] >= target,
  progress: (s: UserStats) => ({ current: Math.min(s[key], target), target }),
});

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { code: "first-plan", title: "Primeiro planejamento", description: "Criou seu primeiro plano semanal.", icon: "calendar-check", xp: 30, ...count("plansCreated", 1) },
  { code: "first-meal", title: "Primeira refeição", description: "Marcou uma refeição como concluída.", icon: "utensils", xp: 10, ...count("mealsCompleted", 1) },
  { code: "organized-week", title: "Semana organizada", description: "Planejou a semana e gerou a lista de compras dela.", icon: "layout-list", xp: 40, ...count("organizedWeeks", 1) },
  { code: "first-workout", title: "Primeiro treino", description: "Registrou seu primeiro treino.", icon: "dumbbell", xp: 30, ...count("workoutsCompleted", 1) },
  { code: "five-workouts", title: "Cinco treinos", description: "Concluiu cinco treinos, no seu ritmo.", icon: "flame", xp: 60, ...count("workoutsCompleted", 5) },
  { code: "twenty-workouts", title: "Vinte treinos", description: "Vinte treinos registrados.", icon: "medal", xp: 120, ...count("workoutsCompleted", 20) },
  { code: "first-shopping", title: "Lista finalizada", description: "Finalizou sua primeira lista de compras.", icon: "shopping-basket", xp: 30, ...count("shoppingListsDone", 1) },
  { code: "seven-days", title: "Sete dias de acompanhamento", description: "Registrou algo em 7 dias diferentes — não precisam ser seguidos.", icon: "sprout", xp: 70, ...count("activeDays", 7) },
  { code: "thirty-days", title: "Trinta dias de acompanhamento", description: "30 dias diferentes com registros.", icon: "trees", xp: 150, ...count("activeDays", 30) },
  { code: "hydrated", title: "Hidratação em dia", description: "Alcançou sua meta de água em 3 dias.", icon: "droplets", xp: 30, ...count("waterGoalDays", 3) },
  { code: "price-hunter", title: "Olho no preço", description: "Cadastrou 10 preços de produtos.", icon: "receipt", xp: 40, ...count("pricesRegistered", 10) },
  { code: "pantry", title: "Despensa em ordem", description: "Registrou 5 itens que já tem em casa.", icon: "package-check", xp: 20, ...count("pantryItems", 5) },
  { code: "habit-builder", title: "Hábito em construção", description: "Marcou hábitos 10 vezes.", icon: "repeat", xp: 40, ...count("habitChecks", 10) },
];

export function newlyUnlocked(stats: UserStats, unlocked: ReadonlySet<string>): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.code) && a.test(stats));
}

// ─────────────────────────────────────────────────────────────
// Desafios semanais (opcionais e pausáveis)
// ─────────────────────────────────────────────────────────────

export interface WeekActivity {
  workouts: number;
  waterGoalDays: number;
  mealsCompleted: number;
  veggieDays: number;
  habitChecks: number;
  budgetLists: number;
}

export type ChallengeMetric = keyof WeekActivity;

export const CHALLENGES: readonly {
  code: string;
  title: string;
  description: string;
  metric: ChallengeMetric;
  target: number;
  xp: number;
  icon: string;
}[] = [
  { code: "three-workouts", title: "Três treinos", description: "Treinar 3 vezes nesta semana, com descanso entre os dias.", metric: "workouts", target: 3, xp: 60, icon: "dumbbell" },
  { code: "water-four", title: "Água em dia", description: "Atingir a meta de água em 4 dias da semana.", metric: "waterGoalDays", target: 4, xp: 40, icon: "droplets" },
  { code: "follow-plan", title: "Mãos na massa", description: "Concluir 10 refeições do plano nesta semana.", metric: "mealsCompleted", target: 10, xp: 50, icon: "chef-hat" },
  { code: "veggies", title: "Verde no prato", description: "Ter legumes ou verduras em refeições de 5 dias.", metric: "veggieDays", target: 5, xp: 50, icon: "leaf" },
  { code: "habits", title: "Pequenos passos", description: "Marcar seus hábitos 5 vezes na semana.", metric: "habitChecks", target: 5, xp: 30, icon: "repeat" },
  { code: "budget", title: "Compra consciente", description: "Finalizar uma lista de compras dentro do orçamento.", metric: "budgetLists", target: 1, xp: 40, icon: "piggy-bank" },
];

/** Semanas consecutivas (até a atual) com pelo menos 3 dias ativos. Semana atual em andamento não zera. */
export function consistentWeeks(activeDaysPerWeek: readonly number[]): number {
  // activeDaysPerWeek[0] = semana atual, [1] = anterior, ...
  let streak = 0;
  for (let i = 0; i < activeDaysPerWeek.length; i++) {
    const days = activeDaysPerWeek[i];
    if (days >= 3) streak += 1;
    else if (i === 0) continue; // semana atual ainda pode atingir a meta
    else break;
  }
  return streak;
}

/** Rótulos do histórico de XP (transparência: o usuário vê de onde veio cada ponto). */
export const XP_KIND_LABEL: Record<XpKind, string> = {
  ONBOARDING_DONE: "Perfil configurado",
  PLAN_CREATED: "Plano semanal criado",
  MEAL_COMPLETED: "Refeição do plano concluída",
  MEAL_LOGGED: "Refeição registrada",
  WORKOUT_COMPLETED: "Treino concluído",
  SHOPPING_DONE: "Lista de compras finalizada",
  WATER_GOAL: "Meta de água do dia",
  HABIT_CHECK: "Hábito marcado",
  PRICE_ADDED: "Preço cadastrado",
  ACHIEVEMENT: "Conquista",
  CHALLENGE: "Desafio concluído",
};
