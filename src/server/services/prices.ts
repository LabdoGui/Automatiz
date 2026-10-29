import "server-only";
import type { PriceSource, Prisma } from "@/generated/prisma/client";
import { packageGrams, pricePerKgCents, type PackageSpec } from "@/domain/pricing/pricing";
import { toDbDate, type ISODate } from "@/domain/dates";
import { parseBRLToCents } from "@/domain/format";
import { normalizeText } from "@/domain/restrictions/engine";
import { db } from "../db";
import { UserFacingError } from "../action-utils";

export const PRODUCT_SELECT = {
  id: true,
  catalogKey: true,
  name: true,
  brand: true,
  foodId: true,
  category: true,
  packageSize: true,
  packageUnit: true,
  soldByWeight: true,
  densityGPerMl: true,
  unitWeightG: true,
  isDefault: true,
  ownerId: true,
} satisfies Prisma.ProductSelect;

export type ProductRecord = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

export function specOf(p: Pick<ProductRecord, "packageSize" | "packageUnit" | "soldByWeight" | "densityGPerMl" | "unitWeightG">): PackageSpec {
  return {
    packageSize: p.packageSize,
    packageUnit: p.packageUnit,
    soldByWeight: p.soldByWeight,
    densityGPerMl: p.densityGPerMl,
    unitWeightG: p.unitWeightG,
  };
}

export const PRICE_SOURCE_LABEL: Record<PriceSource, string> = {
  USER: "Informado por você",
  PAID: "Pago por você",
  IMPORT: "Importado de arquivo",
  DEMO: "Exemplo de demonstração",
  INTEGRATION: "Confirmado pela integração",
};

export function visibleProductsWhere(userId: string): Prisma.ProductWhereInput {
  return { OR: [{ ownerId: null }, { ownerId: userId }] };
}

export interface LatestPrice {
  id: string;
  productId: string;
  priceCents: number;
  storeName: string | null;
  observedAt: Date;
  source: PriceSource;
}

/** Preço mais recente de cada produto registrado pelo usuário. */
export async function latestPrices(userId: string): Promise<Map<string, LatestPrice>> {
  const rows = await db.$queryRaw<LatestPrice[]>`
    SELECT DISTINCT ON ("productId") id, "productId", "priceCents", "storeName", "observedAt", source
    FROM "price_record" WHERE "userId" = ${userId}
    ORDER BY "productId", "observedAt" DESC, "createdAt" DESC`;
  return new Map(rows.map((r) => [r.productId, r]));
}

export interface FoodPrice {
  product: ProductRecord;
  price: LatestPrice;
  /** centavos por grama do alimento comprado */
  perGramCents: number;
}

/**
 * Para cada alimento comprado, escolhe o produto com preço mais recente do
 * usuário e calcula o custo por grama. Alimentos sem preço não entram.
 */
export async function priceIndexByFood(userId: string): Promise<Map<string, FoodPrice>> {
  const prices = await latestPrices(userId);
  if (prices.size === 0) return new Map();
  const products = await db.product.findMany({
    where: { id: { in: [...prices.keys()] }, ...visibleProductsWhere(userId) },
    select: PRODUCT_SELECT,
  });
  const index = new Map<string, FoodPrice>();
  for (const product of products) {
    const price = prices.get(product.id)!;
    const spec = specOf(product);
    const grams = product.soldByWeight ? 1000 : packageGrams(spec);
    if (!grams) continue;
    const perGramCents = price.priceCents / grams;
    const current = index.get(product.foodId);
    if (!current || price.observedAt > current.price.observedAt) {
      index.set(product.foodId, { product, price, perGramCents });
    }
  }
  return index;
}

export async function addPrice(
  userId: string,
  data: { productId: string; priceCents: number; storeName: string | null; observedAt: ISODate; source: PriceSource; notes?: string | null },
) {
  const product = await db.product.findFirst({ where: { id: data.productId, ...visibleProductsWhere(userId) }, select: { id: true } });
  if (!product) throw new UserFacingError("Produto não encontrado.");
  if (data.priceCents <= 0) throw new UserFacingError("Informe um preço maior que zero.");
  return db.priceRecord.create({
    data: {
      userId,
      productId: product.id,
      priceCents: data.priceCents,
      storeName: data.storeName,
      observedAt: toDbDate(data.observedAt),
      source: data.source,
      notes: data.notes ?? null,
    },
  });
}

export async function deletePrice(userId: string, priceId: string) {
  const res = await db.priceRecord.deleteMany({ where: { id: priceId, userId } });
  if (res.count === 0) throw new UserFacingError("Preço não encontrado.");
}

export async function priceHistory(userId: string, productId: string) {
  return db.priceRecord.findMany({
    where: { userId, productId },
    orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
    take: 30,
  });
}

export async function createCustomProduct(
  userId: string,
  data: {
    name: string;
    brand: string | null;
    foodId: string;
    packageSize: number;
    packageUnit: "G" | "ML" | "UNIT";
    soldByWeight: boolean;
    unitWeightG: number | null;
    densityGPerMl: number | null;
  },
) {
  const food = await db.food.findFirst({ where: { id: data.foodId, OR: [{ ownerId: null }, { ownerId: userId }] }, select: { id: true, category: true } });
  if (!food) throw new UserFacingError("Alimento não encontrado.");
  if (data.packageUnit === "UNIT" && !data.unitWeightG && !data.soldByWeight) {
    throw new UserFacingError("Para embalagens em unidades, informe o peso aproximado de cada unidade.");
  }
  const count = await db.product.count({ where: { ownerId: userId } });
  if (count >= 300) throw new UserFacingError("Limite de produtos personalizados atingido.");
  return db.product.create({
    data: { ...data, ownerId: userId, category: food.category, isDefault: false },
    select: PRODUCT_SELECT,
  });
}

export function comparablePricePerKg(product: ProductRecord, priceCents: number): number | null {
  return pricePerKgCents(specOf(product), priceCents);
}

// ─────────────────────────────────────────────────────────────
// Importação de preços por arquivo CSV
// ─────────────────────────────────────────────────────────────

export const CSV_TEMPLATE = "produto;preco;loja;data\nArroz branco tipo 1 — pacote 5 kg;27,90;Mercado do bairro;29/10/2026\n";

/** Parser CSV simples (separador ; ou ,; aspas duplas). */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

function parseBrDate(value: string): ISODate | null {
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toISOString().slice(0, 10) === iso ? iso : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

export interface ImportReport {
  imported: number;
  errors: { line: number; message: string }[];
}

export async function importPricesCsv(userId: string, text: string, today: ISODate): Promise<ImportReport> {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new UserFacingError("O arquivo está vazio.");
  const header = rows[0].map((h) => normalizeText(h));
  const hasHeader = header.includes("produto") || header.includes("preco");
  const col = (name: string, fallback: number) => (hasHeader ? header.indexOf(name) : fallback);
  const iProduct = col("produto", 0);
  const iPrice = col("preco", 1);
  const iStore = col("loja", 2);
  const iDate = col("data", 3);
  if (iProduct < 0 || iPrice < 0) throw new UserFacingError("O arquivo precisa das colunas produto e preco.");
  const body = hasHeader ? rows.slice(1) : rows;
  if (body.length > 500) throw new UserFacingError("Importe no máximo 500 linhas por vez.");

  const products = await db.product.findMany({ where: visibleProductsWhere(userId), select: { id: true, name: true, catalogKey: true } });
  const byName = new Map<string, string>();
  for (const p of products) {
    byName.set(normalizeText(p.name), p.id);
    if (p.catalogKey) byName.set(normalizeText(p.catalogKey), p.id);
  }

  const report: ImportReport = { imported: 0, errors: [] };
  const data: Prisma.PriceRecordCreateManyInput[] = [];
  body.forEach((r, idx) => {
    const line = idx + (hasHeader ? 2 : 1);
    const productId = byName.get(normalizeText(r[iProduct] ?? ""));
    if (!productId) return report.errors.push({ line, message: `Produto não encontrado: "${(r[iProduct] ?? "").slice(0, 60)}"` });
    const cents = parseBRLToCents(r[iPrice] ?? "");
    if (cents === null || cents <= 0) return report.errors.push({ line, message: "Preço inválido." });
    const dateRaw = iDate >= 0 ? (r[iDate] ?? "") : "";
    const date = dateRaw ? parseBrDate(dateRaw) : today;
    if (!date) return report.errors.push({ line, message: "Data inválida (use DD/MM/AAAA)." });
    if (date > today) return report.errors.push({ line, message: "A data não pode estar no futuro." });
    data.push({
      userId,
      productId,
      priceCents: cents,
      storeName: iStore >= 0 ? (r[iStore] || null)?.slice(0, 80) ?? null : null,
      observedAt: toDbDate(date),
      source: "IMPORT",
    });
  });
  if (data.length > 0) {
    await db.priceRecord.createMany({ data });
    report.imported = data.length;
  }
  return report;
}
