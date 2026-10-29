/** Ordem das etapas do onboarding (compartilhada entre cliente e servidor). */
export const STEP_KEYS = [
  "perfil",
  "objetivo",
  "rotina",
  "refeicoes",
  "gostos",
  "restricoes",
  "orcamento",
  "meta",
  "despensa",
] as const;
export type StepKey = (typeof STEP_KEYS)[number];
