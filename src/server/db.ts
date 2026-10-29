import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "./prisma-factory";

const globalForPrisma = globalThis as unknown as { vivaPrisma?: PrismaClient };

/** Cliente Prisma único por processo (evita múltiplas conexões em desenvolvimento). */
export const db: PrismaClient = globalForPrisma.vivaPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.vivaPrisma = db;
