import { normalizeText } from "./engine";
import { ALLERGENS, INTOLERANCES } from "./vocabulary";

/**
 * Sugestões de alergênicos a partir do nome/categoria de um alimento da TACO,
 * para acelerar a revisão por um(a) nutricionista. São apenas sugestões:
 * nada é marcado como revisado sem a confirmação de uma pessoa.
 */
const RULES: { tags: string[]; words: string[] }[] = [
  { tags: ["leite", "lactose"], words: ["leite", "queijo", "iogurte", "requeijao", "manteiga", "creme de leite", "nata", "ricota", "coalhada", "doce de leite", "chantilly", "sorvete", "pudim", "achocolatado"] },
  { tags: ["ovo"], words: ["ovo", "gema", "clara", "omelete", "maionese", "suspiro", "quindim", "a cavalo"] },
  { tags: ["trigo", "gluten"], words: ["trigo", "pao", "macarrao", "biscoito", "bolacha", "bolo", "torrada", "pizza", "lasanha", "nhoque", "empada", "pastel", "coxinha", "esfiha", "croissant", "panqueca", "farinha de rosca", "cuscuz paulista", "quibe", "kibe"] },
  { tags: ["gluten"], words: ["aveia", "cevada", "centeio", "malte", "cerveja"] },
  { tags: ["soja"], words: ["soja", "tofu", "missô", "misso", "shoyu"] },
  { tags: ["amendoim"], words: ["amendoim", "pacoca", "pe de moleque"] },
  { tags: ["castanhas"], words: ["castanha", "noz", "nozes", "amendoa", "avela", "pistache", "macadamia", "pecã", "peca", "baru"] },
  { tags: ["peixe"], words: ["peixe", "atum", "sardinha", "bacalhau", "salmao", "pescada", "merluza", "tilapia", "corvina", "cacao", "pintado", "tucunare", "surubim", "manjuba", "pescadinha", "robalo", "anchova"] },
  { tags: ["crustaceo"], words: ["acaraje", "vatapa", "caruru", "camarao", "caranguejo", "lagosta", "siri", "marisco", "lula", "polvo", "ostra", "mexilhao", "sururu", "vieira"] },
  { tags: ["gergelim"], words: ["gergelim", "tahine", "tahini"] },
];

const ALLOWED = new Set([...ALLERGENS.map((a) => a.tag), ...INTOLERANCES.map((a) => a.tag)]);

export function suggestAllergens(name: string, category: string): string[] {
  const text = ` ${normalizeText(`${name} ${category}`)} `;
  const out = new Set<string>();
  for (const rule of RULES) {
    if (rule.words.some((w) => text.includes(` ${normalizeText(w)}`))) rule.tags.forEach((t) => out.add(t));
  }
  return [...out];
}

/** Tags de alergênico/intolerância aceitas na revisão (inclui "traco:<alergênico>"). */
export function isReviewTag(tag: string): boolean {
  return ALLOWED.has(tag) || (tag.startsWith("traco:") && ALLERGENS.some((a) => a.tag === tag.slice(6)));
}

/** Substitui só as tags de alergênico/intolerância, preservando as demais (dieta, família). */
export function mergeReviewedTags(current: readonly string[], reviewed: readonly string[]): string[] {
  return [...new Set([...current.filter((t) => !isReviewTag(t)), ...reviewed])];
}
