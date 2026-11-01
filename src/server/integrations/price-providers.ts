import "server-only";
import { toDbDate, type ISODate } from "@/domain/dates";
import { quoteProblem, type ExternalPriceQuote } from "@/domain/pricing/quotes";
import { db } from "../db";
import { openPricesProvider } from "./open-prices";

/**
 * Contrato para integrações de preço.
 *
 * Nenhum provedor vem configurado: o VIVA não inventa preços nem coleta dados
 * de sites sem autorização. Para conectar uma fonte real (API oficial de um
 * mercado, parceiro de dados), implemente `PriceProvider`, leia credenciais de
 * variáveis de ambiente e registre o provedor em `PRICE_PROVIDERS`. As cotações
 * passam por `quoteProblem` e são gravadas com origem INTEGRATION, loja, data
 * e referência — o usuário sempre vê de onde veio cada preço.
 */
export interface PriceProvider {
  id: string;
  name: string;
  isConfigured(): boolean;
  fetchQuotes(params: { productKeys: readonly string[]; postalCode?: string; signal?: AbortSignal }): Promise<ExternalPriceQuote[]>;
}

export const PRICE_PROVIDERS: readonly PriceProvider[] = [openPricesProvider];

export function configuredPriceProviders(): PriceProvider[] {
  return PRICE_PROVIDERS.filter((p) => p.isConfigured());
}

export interface QuoteImportReport {
  imported: number;
  rejected: { productKey: string; reason: string }[];
}

/** Valida e grava cotações de um provedor para o usuário (origem INTEGRATION). */
export async function importProviderQuotes(
  userId: string,
  provider: Pick<PriceProvider, "name">,
  quotes: readonly ExternalPriceQuote[],
  today: ISODate,
): Promise<QuoteImportReport> {
  const keys = [...new Set(quotes.map((q) => q.productKey))];
  const products = await db.product.findMany({
    where: { catalogKey: { in: keys }, OR: [{ ownerId: null }, { ownerId: userId }] },
    select: { id: true, catalogKey: true },
  });
  const byKey = new Map(products.map((p) => [p.catalogKey!, p.id]));
  const report: QuoteImportReport = { imported: 0, rejected: [] };
  const data = [];
  for (const quote of quotes) {
    const problem = quoteProblem(quote, today) ?? (byKey.has(quote.productKey) ? null : "produto não encontrado no catálogo");
    if (problem) {
      report.rejected.push({ productKey: quote.productKey, reason: problem });
      continue;
    }
    data.push({
      userId,
      productId: byKey.get(quote.productKey)!,
      priceCents: quote.priceCents,
      storeName: quote.storeName.trim(),
      observedAt: toDbDate(quote.observedAt),
      source: "INTEGRATION" as const,
      notes: `Fonte: ${provider.name}${quote.reference ? ` · ${quote.reference.slice(0, 200)}` : ""}`,
    });
  }
  if (data.length) report.imported = (await db.priceRecord.createMany({ data })).count;
  return report;
}
