import { diffDays, isISODate, type ISODate } from "../dates";

/**
 * Cotação vinda de uma integração de preços (ex.: API oficial de um mercado
 * parceiro). Validada antes de virar PriceRecord com origem INTEGRATION.
 */
export interface ExternalPriceQuote {
  /** catalogKey do produto no VIVA */
  productKey: string;
  /** Preço de uma embalagem (ou de 1 kg para produtos a granel), em centavos */
  priceCents: number;
  storeName: string;
  observedAt: ISODate;
  /** Identificador ou URL da oferta, para auditoria */
  reference?: string;
}

export const MAX_QUOTE_AGE_DAYS = 30;
const MAX_PRICE_CENTS = 1_000_000;

/** Motivo de rejeição, ou null quando a cotação pode ser gravada. */
export function quoteProblem(quote: ExternalPriceQuote, today: ISODate): string | null {
  if (!quote.productKey?.trim()) return "produto não identificado";
  if (!Number.isInteger(quote.priceCents) || quote.priceCents <= 0) return "preço inválido";
  if (quote.priceCents > MAX_PRICE_CENTS) return "preço fora do intervalo esperado";
  if (!quote.storeName?.trim() || quote.storeName.length > 80) return "loja não informada";
  if (!isISODate(quote.observedAt)) return "data inválida";
  const age = diffDays(today, quote.observedAt);
  if (age < 0) return "data no futuro";
  if (age > MAX_QUOTE_AGE_DAYS) return `cotação com mais de ${MAX_QUOTE_AGE_DAYS} dias`;
  return null;
}
