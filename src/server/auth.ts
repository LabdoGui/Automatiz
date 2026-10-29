import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";

const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET é obrigatório em produção.");
}

export const auth = betterAuth({
  appName: "VIVA",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  session: {
    // 30 dias, renovada a cada 24 h de uso
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  user: {
    deleteUser: { enabled: true },
  },
  rateLimit: {
    enabled: process.env.VIVA_DISABLE_AUTH_RATE_LIMIT !== "1",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60 * 10, max: 10 },
    },
  },
  telemetry: { enabled: false },
  advanced: {
    useSecureCookies: isProduction,
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
