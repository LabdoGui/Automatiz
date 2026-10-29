/**
 * Regras aplicadas a TODOS os alimentos da TACO durante a importação.
 * Nenhum valor nutricional é inventado:
 *  - campos nulos na fonte ficam nulos e são listados em `missingFields`;
 *  - exceção documentada: fibra alimentar em carnes, pescados e ovos e
 *    proteína/carboidrato/fibra em óleos puros (100 g de lipídeos) são "não
 *    aplicáveis" — tratados como zero e listados em `notApplicable`.
 * Tags de alergênicos aqui são heurísticas (allergenReviewed = false): servem
 * para filtrar buscas, mas o app sempre avisa que não foram revisadas.
 */

export type FoodState = "RAW" | "COOKED" | "READY";
export type NutrientField = "kcal" | "proteinG" | "carbsG" | "fatG" | "fiberG";

export interface TacoFood {
  tacoId: number;
  name: string;
  category: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  moisturePct: number | null;
}

const NUTRIENT_FIELDS: NutrientField[] = ["kcal", "proteinG", "carbsG", "fatG", "fiberG"];
const NO_FIBER_CATEGORIES = new Set(["Carnes e derivados", "Pescados e frutos do mar", "Ovos e derivados"]);

export function inferState(name: string): FoodState {
  const n = name.toLowerCase();
  if (/\bcru[as]?\b/.test(n)) return "RAW";
  if (/(cozid|grelhad|assad|frit|refogad|torrad|à milanesa|sauté)/.test(n)) return "COOKED";
  return "READY";
}

export function nutrientStatus(food: TacoFood): {
  values: Record<NutrientField, number | null>;
  missingFields: NutrientField[];
  notApplicable: NutrientField[];
} {
  const values: Record<NutrientField, number | null> = {
    kcal: food.kcal,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
    fiberG: food.fiberG,
  };
  const notApplicable: NutrientField[] = [];
  if (values.fiberG === null && NO_FIBER_CATEGORIES.has(food.category)) {
    values.fiberG = 0;
    notApplicable.push("fiberG");
  }
  const pureFat = food.fatG !== null && food.fatG >= 99.9;
  if (pureFat) {
    for (const f of ["proteinG", "carbsG", "fiberG"] as const) {
      if (values[f] === null) {
        values[f] = 0;
        notApplicable.push(f);
      }
    }
  }
  const missingFields = NUTRIENT_FIELDS.filter((f) => values[f] === null);
  return { values, missingFields, notApplicable };
}

const has = (n: string, re: RegExp) => re.test(n);

/** Tags heurísticas para alimentos não revisados. */
export function inferTags(food: TacoFood): string[] {
  const n = food.name.toLowerCase();
  const tags = new Set<string>();
  const animal = () => tags.add("origem-animal");

  switch (food.category) {
    case "Leite e derivados":
      if (!has(n, /soja/)) {
        tags.add("leite").add("lactose").add("laticinio");
        animal();
      }
      break;
    case "Ovos e derivados":
      tags.add("ovo");
      animal();
      if (has(n, /queijo/)) tags.add("leite").add("lactose");
      break;
    case "Pescados e frutos do mar":
      tags.add("carne");
      animal();
      if (has(n, /camar|caranguejo|siri|lagosta/)) tags.add("crustaceo").add("frutos-do-mar");
      else tags.add("peixe");
      break;
    case "Carnes e derivados":
      tags.add("carne");
      animal();
      if (has(n, /frango|peru|galinha/)) tags.add("aves");
      if (has(n, /porco|suín|lingüiça, porco|toucinho|presunto|salame|mortadela|apresuntado|bacon/)) tags.add("carne-suina");
      if (has(n, /bovin|boi|charque|carne, seca|hambúrguer|almôndega|quibe|croquete/)) tags.add("carne-vermelha");
      break;
  }
  if (has(n, /trigo|pão|macarrão|biscoito|bolo|torrada|pastel|lasanha|empada|coxinha|croquete|quibe|nhoque|farinha, de rosca|à milanesa|cuscuz, paulista|yakisoba/)) {
    tags.add("trigo").add("gluten");
  }
  if (has(n, /centeio|cevada|aveia/)) tags.add("gluten");
  if (has(n, /amendoim|paçoca|pé-de-moleque/)) tags.add("amendoim");
  if (has(n, /soja|tofu|shoyu/)) tags.add("soja");
  if (has(n, /castanha|amêndoa|noz\b|avelã|macadâmia|pistache/)) tags.add("castanhas");
  if (has(n, /gergelim/)) tags.add("gergelim");
  if (has(n, /\bmel\b|melado/)) {
    if (has(n, /mel, de abelha/)) {
      tags.add("mel");
      animal();
    }
  }
  if (has(n, /queijo|manteiga|creme de leite|requeijão|leite condensado|doce, de leite|chantilly|achocolatado|chocolate|capuccino|pão, de queijo|omelete/)) {
    tags.add("leite").add("lactose");
    if (!has(n, /chantilly, spray, com gordura vegetal/)) animal();
  }
  if (has(n, /maionese|omelete|quindim|macarrão, trigo, cru, com ovos|empada/)) {
    tags.add("ovo");
    animal();
  }
  if (has(n, /camarão|vatapá|acarajé|tacacá/)) tags.add("crustaceo").add("frutos-do-mar");
  if (has(n, /feijoada|virado à paulista|sarapatel|dobradinha|barreado|vaca atolada|carreteiro|tropeiro|maniçoba|estrogonofe|bife|salpicão|charuto/)) {
    tags.add("carne");
    animal();
  }
  return [...tags];
}

/** Gramas compradas por grama consumida, pelo balanço de matéria seca (umidade TACO). */
export function moistureFactor(consumedMoisture: number | null, purchasedMoisture: number | null): number | null {
  if (consumedMoisture === null || purchasedMoisture === null) return null;
  if (purchasedMoisture >= 100 || consumedMoisture >= 100) return null;
  const factor = (100 - consumedMoisture) / (100 - purchasedMoisture);
  return Math.round(factor * 1000) / 1000;
}
