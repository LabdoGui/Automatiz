import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { lookupBarcode } from "@/server/integrations/open-food-facts";

// Servidor que imita GET /api/v2/product/{code} do Open Food Facts.
let server: Server;
const seen: { url: string; ua: string | undefined }[] = [];
beforeAll(async () => {
  server = createServer((req, res) => {
    seen.push({ url: req.url ?? "", ua: req.headers["user-agent"] });
    const code = (req.url ?? "").match(/\/api\/v2\/product\/(\d+)/)?.[1];
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (code === "7891000100103")
      return json(200, {
        code,
        status: 1,
        status_verbose: "product found",
        product: { product_name: "Achocolatado em pó", brands: "Marca X", nutriments: { "energy-kcal_100g": 380, proteins_100g: 4, carbohydrates_100g: 88, fat_100g: 1.5 }, allergens_tags: ["en:milk"] },
      });
    if (code === "7890000000000") return json(404, { code, status: 0, status_verbose: "product not found" });
    if (code === "7891111111111") return json(200, { code, status: 0, status_verbose: "product not found" });
    if (code === "7892222222222") return json(200, { status: "estranho", product: 42 });
    return json(500, {});
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  process.env.OFF_API_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  delete process.env.OFF_API_BASE_URL;
  return new Promise<void>((r) => server.close(() => r()));
});

describe("consulta ao Open Food Facts", () => {
  it("encontra o produto, pede só os campos necessários e se identifica", async () => {
    const p = await lookupBarcode("7891000100103");
    expect(p).toMatchObject({ name: "Achocolatado em pó", brand: "Marca X", kcal: 380, carbsG: 88, allergens: ["leite"], missing: ["fibras"] });
    const req = seen.at(-1)!;
    expect(req.url).toContain("fields=code,product_name");
    expect(req.ua).toMatch(/^VIVA\//);
  });

  it("produto inexistente (404 ou status 0) retorna nulo", async () => {
    expect(await lookupBarcode("7890000000000")).toBeNull();
    expect(await lookupBarcode("7891111111111")).toBeNull();
  });

  it("resposta inesperada, erro do servidor e código inválido viram mensagens claras", async () => {
    await expect(lookupBarcode("7892222222222")).rejects.toThrow(/formato inesperado/);
    await expect(lookupBarcode("7893333333333")).rejects.toThrow(/não respondeu como esperado/);
    await expect(lookupBarcode("123")).rejects.toThrow(/8 a 14 números/);
  });

  it("sem conexão, orienta preencher pelo rótulo", async () => {
    const saved = process.env.OFF_API_BASE_URL;
    process.env.OFF_API_BASE_URL = "http://127.0.0.1:9";
    try {
      await expect(lookupBarcode("7891000100103")).rejects.toThrow(/Preencha pelo rótulo/);
    } finally {
      process.env.OFF_API_BASE_URL = saved;
    }
  });
});
