export const MEAL_TYPES = [
  "BREAKFAST",
  "MORNING_SNACK",
  "LUNCH",
  "AFTERNOON_SNACK",
  "DINNER",
  "SUPPER",
] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  BREAKFAST: "Café da manhã",
  MORNING_SNACK: "Lanche da manhã",
  LUNCH: "Almoço",
  AFTERNOON_SNACK: "Lanche da tarde",
  DINNER: "Jantar",
  SUPPER: "Ceia",
};

export const DEFAULT_MEAL_TIME: Record<MealType, string> = {
  BREAKFAST: "07:30",
  MORNING_SNACK: "10:00",
  LUNCH: "12:30",
  AFTERNOON_SNACK: "16:00",
  DINNER: "19:30",
  SUPPER: "21:30",
};

export const DEFAULT_SLOTS_BY_COUNT: Record<number, MealType[]> = {
  1: ["LUNCH"],
  2: ["LUNCH", "DINNER"],
  3: ["BREAKFAST", "LUNCH", "DINNER"],
  4: ["BREAKFAST", "LUNCH", "AFTERNOON_SNACK", "DINNER"],
  5: ["BREAKFAST", "MORNING_SNACK", "LUNCH", "AFTERNOON_SNACK", "DINNER"],
  6: ["BREAKFAST", "MORNING_SNACK", "LUNCH", "AFTERNOON_SNACK", "DINNER", "SUPPER"],
};

/** Distribuição de referência da energia diária entre refeições (normalizada pelas refeições escolhidas). */
export const SLOT_ENERGY_SHARE: Record<MealType, number> = {
  BREAKFAST: 0.22,
  MORNING_SNACK: 0.08,
  LUNCH: 0.32,
  AFTERNOON_SNACK: 0.1,
  DINNER: 0.25,
  SUPPER: 0.06,
};

export function sortSlots(slots: readonly MealType[]): MealType[] {
  return [...new Set(slots)].sort((a, b) => MEAL_TYPES.indexOf(a) - MEAL_TYPES.indexOf(b));
}
