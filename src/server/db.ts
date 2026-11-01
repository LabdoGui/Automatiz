import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "./prisma-factory";

const globalForPrisma = globalThis as unknown as { vivaPrisma?: PrismaClient };

function client(): PrismaClient {
  // Criado no primeiro uso: o build (que importa os módulos) não precisa de DATABASE_URL.
  if (!globalForPrisma.vivaPrisma) globalForPrisma.vivaPrisma = createPrismaClient();
  return globalForPrisma.vivaPrisma;
}

/** Cliente Prisma único por processo, criado sob demanda. */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const c = client();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
