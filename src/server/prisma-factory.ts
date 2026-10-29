import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Cria um PrismaClient com o adaptador node-postgres. Usado pelo app, seeds e testes. */
export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL não está configurada. Veja o arquivo .env.example.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
