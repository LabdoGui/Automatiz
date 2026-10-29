import { z } from "zod";
import { MEAL_TYPES } from "@/domain/planner/meal-types";
import {
  ALLERGENS,
  DIET_RESTRICTIONS,
  FAMILY_LABEL,
  INTOLERANCES,
  KITCHEN_EQUIPMENT,
  TRAINING_EQUIPMENT,
} from "@/domain/restrictions/vocabulary";
import {
  zBool,
  zOptionalDecimal,
  zOptionalInt,
  zOptionalMoneyCents,
  zOptionalText,
  zRequiredText,
  zStringArray,
  zTime,
} from "@/lib/validation";

const oneOf = <T extends string>(values: readonly T[], message: string) =>
  z.string().refine((v): v is T => (values as readonly string[]).includes(v), message);

const tagsIn = (allowed: readonly string[], max = 30) =>
  zStringArray(max).refine((arr) => arr.every((t) => allowed.includes(t)), "Opção inválida.");

const optionalTime = z.preprocess((v) => (v === "" ? undefined : v), zTime.optional());

/** Lista separada por vírgulas → itens únicos e curtos. */
export const zFreeList = z.preprocess(
  (v) =>
    typeof v === "string"
      ? [...new Set(v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))]
      : [],
  z.array(z.string().max(40, "Cada item deve ter até 40 caracteres.")).max(20, "Use no máximo 20 itens."),
);

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

export const perfilSchema = z.object({
  displayName: zRequiredText("como prefere ser chamado(a)", 40),
  age: zOptionalInt(13, 110, "a idade"),
  heightCm: zOptionalInt(100, 250, "a altura"),
  weightKg: zOptionalDecimal(25, 400, "o peso"),
});

export const objetivoSchema = z.object({
  goal: oneOf(["LOSE_FAT", "GAIN_MUSCLE", "RECOMPOSITION", "HABITS"] as const, "Escolha um objetivo."),
});

export const rotinaSchema = z.object({
  experienceLevel: z.preprocess(
    (v) => (v === "" ? undefined : v),
    oneOf(["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const, "Opção inválida.").optional(),
  ),
  wakeTime: optionalTime,
  sleepTime: optionalTime,
  trainingWeekdays: zStringArray(7).refine((a) => a.every((d) => /^[0-6]$/.test(d)), "Dia inválido."),
  trainingTime: optionalTime,
  trainingMinutes: zOptionalInt(10, 240, "a duração do treino"),
  trainingLocation: z.preprocess(
    (v) => (v === "" ? undefined : v),
    oneOf(["GYM", "HOME", "OUTDOOR"] as const, "Opção inválida.").optional(),
  ),
  trainingEquipment: tagsIn(TRAINING_EQUIPMENT.map((e) => e.tag)),
  routineNotes: zOptionalText(300),
});

const mealTimeFields = Object.fromEntries(MEAL_TYPES.map((m) => [`time_${m}`, optionalTime])) as Record<
  `time_${(typeof MEAL_TYPES)[number]}`,
  typeof optionalTime
>;

export const refeicoesSchema = z
  .object({
    mealSlots: zStringArray(6)
      .refine((a) => a.length >= 1, "Escolha pelo menos uma refeição.")
      .refine((a) => a.every((m) => (MEAL_TYPES as readonly string[]).includes(m)), "Refeição inválida."),
    cookingStyle: z.preprocess(
      (v) => (v === "" ? undefined : v),
      oneOf(["QUICK", "BALANCED", "ELABORATE"] as const, "Opção inválida.").optional(),
    ),
    cookingMinutes: zOptionalInt(5, 240, "o tempo para cozinhar"),
    kitchenEquipment: tagsIn(KITCHEN_EQUIPMENT.map((e) => e.tag)),
    flexibleMealEnabled: zBool,
    flexibleMealWeekday: zOptionalInt(0, 6, "o dia"),
    flexibleMealType: z.preprocess(
      (v) => (v === "" ? undefined : v),
      oneOf(MEAL_TYPES, "Refeição inválida.").optional(),
    ),
    ...mealTimeFields,
  })
  .refine((d) => !d.flexibleMealEnabled || (d.flexibleMealWeekday !== undefined && d.flexibleMealType !== undefined), {
    message: "Escolha o dia e a refeição flexível.",
    path: ["flexibleMealType"],
  });

const familyTags = Object.keys(FAMILY_LABEL);

export const gostosSchema = z.object({
  favorites: tagsIn(familyTags, 60),
  favoritesText: zFreeList,
  dislikes: tagsIn(familyTags, 60),
  dislikesText: zFreeList,
  avoidText: zFreeList,
});

export const restricoesSchema = z.object({
  allergies: tagsIn(ALLERGENS.map((a) => a.tag)),
  allergiesText: zFreeList,
  intolerances: tagsIn(INTOLERANCES.map((a) => a.tag)),
  restrictions: tagsIn(DIET_RESTRICTIONS.map((a) => a.tag)),
});

export const orcamentoSchema = z
  .object({
    budget: zOptionalMoneyCents("o orçamento"),
    budgetPeriod: z.preprocess(
      (v) => (v === "" ? undefined : v),
      oneOf(["DAY", "WEEK", "MONTH"] as const, "Escolha a periodicidade.").optional(),
    ),
  })
  .refine((d) => d.budget === undefined || d.budgetPeriod !== undefined, {
    message: "Escolha se o valor é por dia, semana ou mês.",
    path: ["budgetPeriod"],
  });

export const goalFieldsSchema = z.object({
  kcal: zOptionalInt(500, 42_000, "a meta de energia"),
  period: oneOf(["DAY", "WEEK"] as const, "Escolha o período da meta."),
  proteinG: zOptionalInt(0, 3_000, "a meta de proteína"),
  carbsG: zOptionalInt(0, 7_000, "a meta de carboidratos"),
  fatG: zOptionalInt(0, 2_000, "a meta de gorduras"),
  mealsPerDay: zOptionalInt(1, 8, "o número de refeições"),
  professionalName: zOptionalText(80),
  notes: zOptionalText(600),
});

export const metaSchema = z
  .object({
    hasNutritionist: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["yes", "no"]).optional()),
    trackWater: zBool,
    waterGoalMl: zOptionalInt(500, 6000, "a meta de água"),
  })
  .and(goalFieldsSchema.partial({ period: true }));

export const PANTRY_STAPLES = [
  "arroz-branco-cru",
  "feijao-carioca-cru",
  "feijao-preto-cru",
  "macarrao-cru",
  "aveia",
  "ovo-cru",
  "azeite",
  "oleo-soja",
  "cafe-po",
  "cebola",
  "alho",
  "batata-crua",
  "banana-prata",
  "molho-tomate",
] as const;

export const despensaSchema = z.object(
  Object.fromEntries(PANTRY_STAPLES.map((k) => [`pantry_${k}`, zOptionalInt(0, 50_000, "a quantidade")])),
);

export const STEP_SCHEMAS: Record<StepKey, z.ZodType> = {
  perfil: perfilSchema,
  objetivo: objetivoSchema,
  rotina: rotinaSchema,
  refeicoes: refeicoesSchema,
  gostos: gostosSchema,
  restricoes: restricoesSchema,
  orcamento: orcamentoSchema,
  meta: metaSchema,
  despensa: despensaSchema,
};
