/** Formatadores pt-BR (puros, usados no domínio e na interface). */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });

export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

export function formatInt(n: number): string {
  return int.format(n);
}

export function formatDec(n: number): string {
  return dec1.format(n);
}

export function formatGrams(g: number): string {
  if (g >= 1000) return `${dec1.format(g / 1000)} kg`;
  return `${int.format(Math.round(g))} g`;
}

export function formatQuantity(value: number, unit: "G" | "ML" | "UNIT"): string {
  if (unit === "G") return formatGrams(value);
  if (unit === "ML") return value >= 1000 ? `${dec1.format(value / 1000)} L` : `${int.format(value)} ml`;
  return `${int.format(value)} un.`;
}

/** Converte "12,50" ou "12.50" ou "R$ 12,50" em centavos. Retorna null se inválido. */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/R\$\s?/i, "").replace(/\s/g, "").trim();
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(",")) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(value) ? value : null;
}

export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const dateLong = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" });
const dateShort = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const dateDM = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

/** Formata uma data ISO (AAAA-MM-DD) como "29 de outubro". */
export function formatDateLong(iso: string): string {
  return dateLong.format(new Date(`${iso}T00:00:00Z`));
}

/** Formata uma data ISO como "29/10/2026". */
export function formatDateBR(iso: string): string {
  return dateShort.format(new Date(`${iso}T00:00:00Z`));
}

export function formatDayMonth(iso: string): string {
  return dateDM.format(new Date(`${iso}T00:00:00Z`));
}

export function pluralize(n: number, singular: string, plural: string): string {
  return `${formatInt(n)} ${n === 1 ? singular : plural}`;
}
