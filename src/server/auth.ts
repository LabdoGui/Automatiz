import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { appUrl, emailSettings, maskEmail, sendEmail } from "./email/send";
import { resetPasswordEmail, verifyEmailEmail } from "./email/templates";

const isProduction = process.env.NODE_ENV === "production";
const emailEnabled = emailSettings().configured;
export const RESET_TOKEN_MINUTES = 60;

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
    resetPasswordTokenExpiresIn: RESET_TOKEN_MINUTES * 60,
    // Redefinir a senha encerra as sessões abertas em outros aparelhos.
    revokeSessionsOnPasswordReset: true,
    ...(emailEnabled
      ? {
          sendResetPassword: async ({ user, token }: { user: { email: string; name: string }; token: string }) => {
            const url = `${appUrl()}/redefinir-senha?token=${encodeURIComponent(token)}`;
            try {
              await sendEmail(user.email, resetPasswordEmail({ name: user.name, url, validMinutes: RESET_TOKEN_MINUTES }));
            } catch {
              // Não revela se o e-mail existe: a resposta ao usuário é sempre a mesma.
              console.error(`[viva:auth] e-mail de redefinição não enviado para ${maskEmail(user.email)}`);
            }
          },
        }
      : {}),
  },
  ...(emailEnabled
    ? {
        emailVerification: {
          // O envio no cadastro é feito pela action (sem bloquear a criação da conta).
          sendOnSignUp: false,
          autoSignInAfterVerification: false,
          expiresIn: 60 * 60 * 24,
          sendVerificationEmail: async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
            await sendEmail(user.email, verifyEmailEmail({ name: user.name, url }));
          },
        },
      }
    : {}),
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
