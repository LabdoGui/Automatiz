import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { openPricesProvider } from "@/server/integrations/open-prices";
import { configuredPriceProviders, importProviderQuotes } from "@/server/integrations/price-providers";
import { cleanupTestUsers, createTestUser } from "../support/factories";

// Imita GET /api/v1/prices do Open Prices (formato PaginatedPriceFullList).
let server: Server;
const queries: URLSearchParams[] = [];
const today = new Date().toISOString().slice(0, 10);
beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    queries.push(url.searchParams);
    const items =
      url.searchParams.get("category_tag") === "en:bananas"
        ? [{ id: 42, price: 6.89, currency: "BRL", price_per: "KILOGRAM", price_is_discounted: false, date: today, location: { osm_name: "Sacolão Central", osm_address_city: "Belo Horizonte", osm_address_country_code: "BR", type: "OSM" } }]
        : [];
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ items, page: 1, pages: 1, size: 50, total: items.length }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  process.env.OPEN_PRICES_API_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  delete process.env.OPEN_PRICES_API_BASE_URL;
  delete process.env.VIVA_OPEN_PRICES;
  await new Promise<void>((r) => server.close(() => r()));
  await cleanupTestUsers();
});

describe("integração Open Prices", () => {
  it("fica desligada até ser ativada", () => {
    delete process.env.VIVA_OPEN_PRICES;
    expect(configuredPriceProviders()).toEqual([]);
    process.env.VIVA_OPEN_PRICES = "on";
    expect(configuredPriceProviders().map((p) => p.id)).toEqual(["open-prices"]);
  });

  it("consulta por categoria em BRL e grava o preço com origem, loja e referência", async () => {
    const user = await createTestUser();
    const quotes = await openPricesProvider.fetchQuotes({ productKeys: ["banana-kg", "tomate-kg", "arroz-branco-5kg"] });
    expect(queries.map((q) => q.get("category_tag"))).toEqual(["en:bananas", "en:tomatoes"]); // arroz embalado não é consultado
    expect(queries[0].get("currency")).toBe("BRL");
    expect(quotes).toHaveLength(1);

    const report = await importProviderQuotes(user.id, openPricesProvider, quotes, today);
    expect(report).toEqual({ imported: 1, rejected: [] });
    const rec = await db.priceRecord.findFirstOrThrow({ where: { userId: user.id }, include: { product: true } });
    expect(rec).toMatchObject({ priceCents: 689, source: "INTEGRATION", storeName: "Sacolão Central, Belo Horizonte (Open Prices)" });
    expect(rec.product.catalogKey).toBe("banana-kg");
    expect(rec.notes).toBe("Fonte: Open Prices (Open Food Facts) · https://prices.openfoodfacts.org/prices/42");
  });
});
