import { COOKING_LABEL, GOAL_LABEL, LEVEL_LABEL, LOCATION_LABEL } from "@/lib/labels";

/**
 * Contexto mínimo enviado ao provedor de IA (quando o usuário ativa a IA e
 * escolhe incluir o contexto). Só entram dados necessários para respostas
 * seguras sobre comida e treino. Nunca entram nome, e-mail, idade, altura,
 * peso, medidas, metas numéricas, orçamento ou histórico de registros.
 */
export interface AssistantContextInput {
  goal: keyof typeof GOAL_LABEL | null;
  experienceLevel: keyof typeof LEVEL_LABEL | null;
  trainingLocation: keyof typeof LOCATION_LABEL | null;
  cookingStyle: keyof typeof COOKING_LABEL | null;
  cookingMinutes: number | null;
  allergies: readonly string[];
  intolerances: readonly string[];
  restrictions: readonly string[];
  dislikes: readonly string[];
}

const MAX_ITEMS = 15;
const MAX_LABEL = 60;

function list(items: readonly string[]): string {
  const clean = [...new Set(items.map((i) => i.replace(/[\r\n\t]+/g, " ").trim().slice(0, MAX_LABEL)).filter(Boolean))];
  const shown = clean.slice(0, MAX_ITEMS);
  return shown.join(", ") + (clean.length > shown.length ? ` e mais ${clean.length - shown.length}` : "");
}

/** Linhas legíveis (as mesmas exibidas ao usuário antes do envio). */
export function buildAssistantContext(input: AssistantContextInput): string[] {
  const lines: string[] = [];
  if (input.goal) lines.push(`Objetivo: ${GOAL_LABEL[input.goal]}`);
  if (input.experienceLevel || input.trainingLocation) {
    const parts = [
      input.experienceLevel ? `nível ${LEVEL_LABEL[input.experienceLevel].toLowerCase()}` : null,
      input.trainingLocation ? LOCATION_LABEL[input.trainingLocation].toLowerCase() : null,
    ].filter(Boolean);
    lines.push(`Treino: ${parts.join(", ")}`);
  }
  if (input.cookingStyle || input.cookingMinutes) {
    const parts = [
      input.cookingStyle ? `prefere receitas ${COOKING_LABEL[input.cookingStyle].toLowerCase()}` : null,
      input.cookingMinutes ? `até ${input.cookingMinutes} min para cozinhar` : null,
    ].filter(Boolean);
    lines.push(`Cozinha: ${parts.join(", ")}`);
  }
  if (input.allergies.length) lines.push(`Alergias (evitar totalmente, inclusive traços): ${list(input.allergies)}`);
  if (input.intolerances.length) lines.push(`Intolerâncias: ${list(input.intolerances)}`);
  if (input.restrictions.length) lines.push(`Restrições alimentares: ${list(input.restrictions)}`);
  if (input.dislikes.length) lines.push(`Não come por preferência: ${list(input.dislikes)}`);
  return lines;
}
