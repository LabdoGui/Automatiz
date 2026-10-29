/** Rótulos em português para enums do domínio (compartilhados entre cliente e servidor). */

export const GOAL_LABEL = {
  LOSE_FAT: "Emagrecimento",
  GAIN_MUSCLE: "Ganho de massa",
  RECOMPOSITION: "Recomposição corporal",
  HABITS: "Melhorar hábitos",
} as const;

export const GOAL_DESCRIPTION = {
  LOSE_FAT: "Reduzir gordura com uma rotina sustentável, sem dietas extremas.",
  GAIN_MUSCLE: "Ganhar massa muscular com treino consistente e boa alimentação.",
  RECOMPOSITION: "Ganhar músculo e reduzir gordura aos poucos.",
  HABITS: "Organizar a rotina e comer melhor, sem foco em números.",
} as const;

export const LEVEL_LABEL = {
  BEGINNER: "Iniciante",
  INTERMEDIATE: "Intermediário",
  ADVANCED: "Avançado",
} as const;

export const LOCATION_LABEL = {
  GYM: "Academia",
  HOME: "Em casa",
  OUTDOOR: "Ao ar livre",
} as const;

export const COOKING_LABEL = {
  QUICK: "Rápidas",
  BALANCED: "Equilibradas",
  ELABORATE: "Elaboradas",
} as const;

export const BUDGET_PERIOD_LABEL = { DAY: "por dia", WEEK: "por semana", MONTH: "por mês" } as const;
export const GOAL_PERIOD_LABEL = { DAY: "por dia", WEEK: "por semana" } as const;

export const DIFFICULTY_LABEL = {
  BEGINNER: "Iniciante",
  INTERMEDIATE: "Intermediário",
  ADVANCED: "Avançado",
} as const;

export const PREFERENCE_KIND_LABEL = {
  FAVORITE: "Favoritos",
  DISLIKE: "Não come por preferência",
  AVOID: "Prefere evitar",
  ALLERGY: "Alergia",
  INTOLERANCE: "Intolerância",
  RESTRICTION: "Restrição alimentar",
} as const;
