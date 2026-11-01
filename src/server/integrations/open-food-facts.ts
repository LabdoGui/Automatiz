import "server-only";
import { z } from "zod";
import { isValidBarcode, prefillFromOff, type FoodPrefill } from "@/domain/integrations/open-food-facts";
import { UserFacingError } from "../action-utils";

/**
 * Consulta de produtos por código de barras no Open Food Facts (API pública e
 * gratuita, dados sob licença ODbL). Só o código de barras é enviado.
 */
const productSchema = z
  .object({
    code: z.string().optional(),
    product_name: z.string().nullish(),
    product_name_pt: z.string().nullish(),
    brands: z.string().nullish(),
    nutrition_data_per: z.string().nullish(),
    nutriments: z.record(z.string(), z.unknown()).nullish(),
    allergens_tags: z.array(z.unknown()).nullish(),
    traces_tags: z.array(z.unknown()).nullish(),
  })
  .passthrough();

const responseSchema = z.object({ status: z.union([z.literal(0), z.literal(1)]).optional(), product: productSchema.optional() }).passthrough();

const FIELDS = "code,product_name,product_name_pt,brands,nutrition_data_per,nutriments,allergens_tags,traces_tags";

export function openFoodFactsEnabled(): boolean {
  return process.env.VIVA_OPEN_FOOD_FACTS !== "off";
}

export async function lookupBarcode(barcode: string): Promise<FoodPrefill | null> {
  if (!openFoodFactsEnabled()) throw new UserFacingError("A busca por código de barras está desativada nesta instalação.");
  if (!isValidBarcode(barcode)) throw new UserFacingError("Informe um código de barras com 8 a 14 números.");
  const base = (process.env.OFF_API_BASE_URL ?? "https://world.openfoodfacts.org").replace(/\/+$/, "");
  const contact = process.env.VIVA_PRIVACY_CONTACT?.trim();
  let res: Response;
  try {
    res = await fetch(`${base}/api/v2/product/${barcode}?fields=${FIELDS}`, {
      headers: { "User-Agent": `VIVA/0.1 (planejamento alimentar${contact ? `; ${contact}` : ""})`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch {
    console.error("[viva:off] falha de conexão");
    throw new UserFacingError("Não foi possível consultar o Open Food Facts agora. Preencha pelo rótulo ou tente mais tarde.");
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`[viva:off] status ${res.status}`);
    throw new UserFacingError("O Open Food Facts não respondeu como esperado. Preencha pelo rótulo ou tente mais tarde.");
  }
  const parsed = responseSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    console.error("[viva:off] resposta em formato inesperado");
    throw new UserFacingError("O Open Food Facts respondeu em um formato inesperado. Preencha pelo rótulo.");
  }
  if (parsed.data.status === 0 || !parsed.data.product) return null;
  return prefillFromOff(barcode, parsed.data.product);
}
