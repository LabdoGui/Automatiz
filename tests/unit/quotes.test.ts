import { describe, expect, it } from "vitest";
import { quoteProblem, type ExternalPriceQuote } from "@/domain/pricing/quotes";

const ok: ExternalPriceQuote = { productKey: "arroz-branco-5kg", priceCents: 2899, storeName: "Mercado Exemplo", observedAt: "2026-10-28" };

describe("validação de cotações de integrações de preço", () => {
  it("aceita cotação recente e completa", () => {
    expect(quoteProblem(ok, "2026-10-29")).toBeNull();
  });
  it("rejeita preço inválido, loja ausente e datas fora do intervalo", () => {
    expect(quoteProblem({ ...ok, priceCents: 0 }, "2026-10-29")).toBe("preço inválido");
    expect(quoteProblem({ ...ok, priceCents: 10.5 }, "2026-10-29")).toBe("preço inválido");
    expect(quoteProblem({ ...ok, priceCents: 2_000_000 }, "2026-10-29")).toBe("preço fora do intervalo esperado");
    expect(quoteProblem({ ...ok, storeName: " " }, "2026-10-29")).toBe("loja não informada");
    expect(quoteProblem({ ...ok, observedAt: "2026-10-30" }, "2026-10-29")).toBe("data no futuro");
    expect(quoteProblem({ ...ok, observedAt: "2026-09-01" }, "2026-10-29")).toMatch(/mais de 30 dias/);
    expect(quoteProblem({ ...ok, observedAt: "29/10/2026" }, "2026-10-29")).toBe("data inválida");
    expect(quoteProblem({ ...ok, productKey: "" }, "2026-10-29")).toBe("produto não identificado");
  });
});
