import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Schema do PostgreSQL indicado em `?schema=` na URL (o mesmo parâmetro que o
 * `prisma migrate` usa). Sem ele, o padrão é `public`.
 */
export function schemaFromUrl(connectionString: string): string | undefined {
  try {
    return new URL(connectionString).searchParams.get("schema")?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Cria um PrismaClient com o adaptador node-postgres. Usado pelo app, seeds e testes. */
export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL não está configurada. Veja o arquivo .env.example.");
  }
  const schema = schemaFromUrl(connectionString);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }, schema ? { schema } : undefined) });
}
