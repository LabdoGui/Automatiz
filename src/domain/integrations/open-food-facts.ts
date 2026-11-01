/**
 * Conversão de um produto do Open Food Facts (API v2) para o cadastro de
 * alimento personalizado do VIVA. Nada é estimado: campos ausentes no
 * rótulo ficam em branco para a pessoa preencher conferindo a embalagem.
 */
export interface OffProduct {
  code?: string;
  product_name?: string | null;
  product_name_pt?: string | null;
  brands?: string | null;
  nutrition_data_per?: string | null;
  nutriments?: Record<string, unknown> | null;
  allergens_tags?: unknown[] | null;
  traces_tags?: unknown[] | null;
}

export interface FoodPrefill {
  barcode: string;
  name: string | null;
  brand: string | null;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  /** Tags do vocabulário do VIVA (inclui "traco:<x>" para "pode conter") */
  allergens: string[];
  missing: string[];
}

/** Alérgenos do Open Food Facts (taxonomia "en:") → vocabulário do VIVA (RDC 26/2015). */
const ALLERGEN_MAP: Record<string, string[]> = {
  "en:milk": ["leite"],
  "en:eggs": ["ovo"],
  "en:gluten": ["gluten", "trigo"],
  "en:soybeans": ["soja"],
  "en:peanuts": ["amendoim"],
  "en:nuts": ["castanhas"],
  "en:fish": ["peixe"],
  "en:crustaceans": ["crustaceo"],
  "en:molluscs": ["crustaceo"],
  "en:sesame-seeds": ["gergelim"],
};

export function isValidBarcode(code: string): boolean {
  return /^\d{8,14}$/.test(code);
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function nutrient(n: Record<string, unknown>, key: string): number | null {
  const v = n[`${key}_100g`];
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? round1(v) : null;
}

function mapTags(tags: unknown[] | null | undefined, prefix = ""): string[] {
  const out: string[] = [];
  for (const t of tags ?? []) {
    if (typeof t !== "string") continue;
    for (const v of ALLERGEN_MAP[t] ?? []) out.push(prefix + v);
  }
  return out;
}

export function prefillFromOff(barcode: string, product: OffProduct): FoodPrefill {
  const n = (product.nutriments ?? {}) as Record<string, unknown>;
  const kj = nutrient(n, "energy-kj");
  const kcal = nutrient(n, "energy-kcal") ?? (kj !== null ? round1(kj / 4.184) : null); // conversão de unidade, não estimativa
  const contains = mapTags(product.allergens_tags);
  const traces = mapTags(product.traces_tags, "traco:").filter((t) => !contains.includes(t.slice(6)));
  const prefill: FoodPrefill = {
    barcode,
    name: (product.product_name_pt || product.product_name || "").trim().slice(0, 80) || null,
    brand: (product.brands ?? "").split(",")[0]?.trim().slice(0, 60) || null,
    kcal,
    proteinG: nutrient(n, "proteins"),
    carbsG: nutrient(n, "carbohydrates"),
    fatG: nutrient(n, "fat"),
    fiberG: nutrient(n, "fiber"),
    allergens: [...new Set([...contains, ...traces])],
    missing: [],
  };
  const labels: [keyof FoodPrefill, string][] = [["name", "nome"], ["kcal", "energia"], ["proteinG", "proteínas"], ["carbsG", "carboidratos"], ["fatG", "gorduras"], ["fiberG", "fibras"]];
  prefill.missing = labels.filter(([k]) => prefill[k] === null).map(([, l]) => l);
  return prefill;
}
