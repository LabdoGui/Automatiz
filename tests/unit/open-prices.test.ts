import { describe, expect, it } from "vitest";
import { pickQuote } from "@/server/integrations/open-prices";

const item = (over: Record<string, unknown>) => ({
  id: 1,
  price: 7.99,
  currency: "BRL",
  price_per: "KILOGRAM",
  price_is_discounted: false,
  date: "2026-10-28",
  location: { osm_name: "Mercado Bom", osm_address_city: "Campinas", osm_address_country_code: "BR", type: "OSM" },
  ...over,
});

describe("Open Prices: escolha da cotação", () => {
  it("usa o preço por kg mais recente, em reais, do Brasil e sem promoção", () => {
    const q = pickQuote(
      "banana-kg",
      [
        item({ id: 1, date: "2026-10-20", price: 6.5 }),
        item({ id: 2, date: "2026-10-28", price: 7.99 }),
        item({ id: 3, date: "2026-10-30", price: 5, price_is_discounted: true }),
        item({ id: 4, date: "2026-10-30", price: 1.2, price_per: "UNIT" }),
        item({ id: 5, date: "2026-10-30", price: 3, currency: "EUR" }),
        item({ id: 6, date: "2026-10-31", price: 4, location: { osm_name: "Lisboa", osm_address_country_code: "PT" } }),
        item({ id: 7, date: "2026-11-05", price: 9 }),
      ],
      "2026-11-01",
    );
    expect(q).toEqual({
      productKey: "banana-kg",
      priceCents: 799,
      storeName: "Mercado Bom, Campinas (Open Prices)",
      observedAt: "2026-10-28",
      reference: "https://prices.openfoodfacts.org/prices/2",
    });
  });

  it("ignora preços com mais de 30 dias e itens fora do formato", () => {
    expect(pickQuote("banana-kg", [item({ date: "2026-09-01" }), { foo: "bar" }, null], "2026-11-01")).toBeNull();
  });
});
