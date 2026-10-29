import { TRAINING_EQUIPMENT } from "@/domain/restrictions/vocabulary";

/** "halteres|kettlebell" + "banco" → "Halteres ou Kettlebell + Banco" */
export const equipmentText = (eq: string[]) =>
  eq.map((req) => req.split("|").map((t) => TRAINING_EQUIPMENT.find((e) => e.tag === t)?.label ?? t).join(" ou ")).join(" + ");
