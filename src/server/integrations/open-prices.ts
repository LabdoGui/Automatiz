import "server-only";
import { z } from "zod";
import { addDays, isISODate, type ISODate } from "@/domain/dates";
import type { ExternalPriceQuote } from "@/domain/pricing/quotes";
import type { PriceProvider } from "./price-providers";

/**
 * Provedor de preços Open Prices (Open Food Facts): preços enviados pela
 * comunidade com comprovante, dados abertos sob licença ODbL. Usado apenas
 * para hortifrúti a granel (preço por kg), em reais, dos últimos 30 dias.
 * Ative com VIVA_OPEN_PRICES=on.
 */

/** Produto do catálogo do VIVA → categoria da taxonomia do Open Food Facts. */
export const OPEN_PRICES_CATEGORIES: Readonly<Record<string, string>> = {
  "tomate-kg": "en:tomatoes",
  "pepino-kg": "en:cucumbers",
  "cenoura-kg": "en:carrots",
  "brocolis-kg": "en:broccoli",
  "abobrinha-kg": "en:zucchini",
  "beterraba-kg": "en:beetroots",
  "couve-flor-kg": "en:cauliflowers",
  "cebola-kg": "en:onions",
  "alho-kg": "en:garlic",
  "batata-kg": "en:potatoes",
  "batata-doce-kg": "en:sweet-potatoes",
  "banana-kg": "en:bananas",
  "maca-kg": "en:apples",
  "mamao-kg": "en:papayas",
  "laranja-kg": "en:oranges",
  "melancia-kg": "en:watermelons",
  "abacaxi-kg": "en:pineapples",
  "manga-kg": "en:mangoes",
  "morango-kg": "en:strawberries",
  "uva-kg": "en:grapes",
  "kiwi-kg": "en:kiwis",
  "pera-kg": "en:pears",
  "melao-kg": "en:melons",
};

const MAX_AGE_DAYS = 30;

const priceSchema = z
  .object({
    id: z.number(),
    price: z.number().nullish(),
    currency: z.string().nullish(),
    price_per: z.string().nullish(),
    price_is_discounted: z.boolean().optional(),
    date: z.string().nullish(),
    location: z
      .object({
        osm_name: z.string().nullish(),
        osm_address_city: z.string().nullish(),
        osm_address_country_code: z.string().nullish(),
        type: z.string().nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

const pageSchema = z.object({ items: z.array(z.unknown()) }).passthrough();

function baseUrl() {
  return (process.env.OPEN_PRICES_API_BASE_URL ?? "https://prices.openfoodfacts.org").replace(/\/+$/, "");
}

/** Converte uma página de resultados na cotação mais recente que serve ao VIVA. */
export function pickQuote(productKey: string, items: unknown[], today: ISODate): ExternalPriceQuote | null {
  const since = addDays(today, -MAX_AGE_DAYS);
  const valid = items
    .flat()
    .map((i) => priceSchema.safeParse(i))
    .filter((r) => r.success)
    .map((r) => r.data)
    .filter(
      (p) =>
        typeof p.price === "number" &&
        p.price > 0 &&
        p.currency === "BRL" &&
        p.price_per === "KILOGRAM" &&
        !p.price_is_discounted &&
        typeof p.date === "string" &&
        isISODate(p.date) &&
        p.date >= since &&
        p.date <= today &&
        (!p.location?.osm_address_country_code || p.location.osm_address_country_code.toUpperCase() === "BR"),
    )
    .sort((a, b) => (b.date! > a.date! ? 1 : b.date! < a.date! ? -1 : b.id - a.id));
  const best = valid[0];
  if (!best) return null;
  const place = [best.location?.osm_name, best.location?.osm_address_city].filter(Boolean).join(", ") || "Loja não identificada";
  return {
    productKey,
    priceCents: Math.round(best.price! * 100),
    storeName: `${place} (Open Prices)`.slice(0, 80),
    observedAt: best.date!,
    reference: `https://prices.openfoodfacts.org/prices/${best.id}`,
  };
}

export const openPricesProvider: PriceProvider = {
  id: "open-prices",
  name: "Open Prices (Open Food Facts)",
  isConfigured: () => process.env.VIVA_OPEN_PRICES === "on",
  async fetchQuotes({ productKeys, signal }) {
    const today = new Date().toISOString().slice(0, 10);
    const quotes: ExternalPriceQuote[] = [];
    for (const key of productKeys) {
      const category = OPEN_PRICES_CATEGORIES[key];
      if (!category) continue;
      const params = new URLSearchParams({
        category_tag: category,
        currency: "BRL",
        date__gte: addDays(today, -MAX_AGE_DAYS),
        order_by: "-date",
        size: "50",
      });
      try {
        const res = await fetch(`${baseUrl()}/api/v1/prices?${params}`, {
          headers: { "User-Agent": "VIVA/0.1 (planejamento alimentar)", Accept: "application/json" },
          signal: signal ?? AbortSignal.timeout(10_000),
          cache: "no-store",
        });
        if (!res.ok) {
          console.error(`[viva:open-prices] status ${res.status}`);
          continue;
        }
        const page = pageSchema.safeParse(await res.json().catch(() => null));
        if (!page.success) {
          console.error("[viva:open-prices] resposta em formato inesperado");
          continue;
        }
        const quote = pickQuote(key, page.data.items, today);
        if (quote) quotes.push(quote);
      } catch {
        console.error("[viva:open-prices] falha de conexão");
      }
    }
    return quotes;
  },
};
