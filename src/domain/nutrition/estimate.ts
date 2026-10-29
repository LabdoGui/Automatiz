/**
 * Estimativa EDUCATIVA de gasto energético diário (não é prescrição).
 *
 * Usa a equação de Mifflin-St Jeor (Mifflin et al., Am J Clin Nutr, 1990)
 * multiplicada por fatores de atividade usuais. Só é oferecida para adultos
 * (18+) com peso, altura e idade informados. O resultado é apresentado como
 * faixa (±10%) e nunca vira meta automaticamente.
 */

export type BiologicalSex = "MALE" | "FEMALE";
export type ActivityLevel = "SEDENTARY" | "LIGHT" | "MODERATE" | "HIGH";

export const ACTIVITY_FACTORS: Record<ActivityLevel, { factor: number; label: string }> = {
  SEDENTARY: { factor: 1.2, label: "Pouco ativo (sem exercício regular)" },
  LIGHT: { factor: 1.375, label: "Levemente ativo (1–3 treinos/semana)" },
  MODERATE: { factor: 1.55, label: "Moderadamente ativo (3–5 treinos/semana)" },
  HIGH: { factor: 1.725, label: "Muito ativo (6–7 treinos/semana)" },
};

export interface EstimateInput {
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  sex: BiologicalSex | null;
  activity: ActivityLevel;
}

export type EstimateResult =
  | { available: true; bmr: number; maintenance: number; low: number; high: number }
  | { available: false; reason: string };

export function estimateEnergy(input: EstimateInput): EstimateResult {
  const { age, heightCm, weightKg, sex, activity } = input;
  if (age === null || heightCm === null || weightKg === null || sex === null) {
    return {
      available: false,
      reason: "Precisamos de idade, altura, peso e sexo para a fórmula. Esses dados são opcionais.",
    };
  }
  if (age < 18) {
    return {
      available: false,
      reason: "Para menores de 18 anos, a necessidade energética deve ser avaliada por um profissional.",
    };
  }
  if (age > 100 || heightCm < 120 || heightCm > 230 || weightKg < 30 || weightKg > 300) {
    return { available: false, reason: "Os dados informados estão fora da faixa em que a fórmula é aplicável." };
  }
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "MALE" ? 5 : -161);
  const maintenance = base * ACTIVITY_FACTORS[activity].factor;
  const round10 = (v: number) => Math.round(v / 10) * 10;
  return {
    available: true,
    bmr: round10(base),
    maintenance: round10(maintenance),
    low: round10(maintenance * 0.9),
    high: round10(maintenance * 1.1),
  };
}
