"use server";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAPIError } from "better-auth/api";
import type { ActionResult } from "@/lib/action-types";
import { zBool } from "@/lib/validation";
import { auth } from "../auth";
import { emailSettings } from "../email/send";
import { db } from "../db";
import { parseInput, safeAction, UserFacingError } from "../action-utils";
import { consumeRateLimit } from "../rate-limit";
import { recordConsents } from "../services/account";
import { CELEBRATE_COOKIE, MOTION_COOKIE, THEME_COOKIE, UI_COOKIE_OPTIONS, themeFromSetting } from "../ui-prefs";
import { getCurrentUser, requireUser } from "../session";

const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254);
const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(128, "A senha pode ter no máximo 128 caracteres.");

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome ou apelido.").max(60, "Use no máximo 60 caracteres."),
  email: emailSchema,
  password: passwordSchema,
  acceptPrivacy: zBool.refine((v) => v, "É preciso aceitar os termos de uso e a política de privacidade."),
  acceptHealth: zBool.refine((v) => v, "É preciso consentir com o tratamento de dados de saúde e hábitos."),
});

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha.").max(128),
});

async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

function hashEmail(email: string) {
  return createHash("sha256").update(email).digest("hex").slice(0, 24);
}

function safeRedirectPath(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/api") ? path : fallback;
}

async function applyUiCookies(userId: string) {
  const settings = await db.userSettings.findUnique({ where: { userId } });
  const store = await cookies();
  store.set(THEME_COOKIE, themeFromSetting(settings?.theme ?? "DARK"), UI_COOKIE_OPTIONS);
  store.set(MOTION_COOKIE, settings?.animations === false ? "off" : "on", UI_COOKIE_OPTIONS);
  store.set(CELEBRATE_COOKIE, settings?.celebrations === false ? "off" : "on", UI_COOKIE_OPTIONS);
}

export async function signUpAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  let ok = false;
  const result = await safeAction(async () => {
    const parsed = parseInput(signUpSchema, formData);
    if (!parsed.ok) return parsed.result;
    const { name, email, password } = parsed.data;
    await consumeRateLimit(`signup:${await clientKey()}`, 10, 60 * 10);
    try {
      const res = await auth.api.signUpEmail({ body: { name, email, password }, headers: await headers() });
      const userId = res.user.id;
      await db.userSettings.create({ data: { userId } });
      await recordConsents(userId, ["PRIVACY_POLICY", "HEALTH_DATA", "TERMS"]);
      await applyUiCookies(userId);
      if (emailSettings().configured) {
        // A conta não depende do e-mail: falha no envio não bloqueia o cadastro.
        await auth.api.sendVerificationEmail({ body: { email, callbackURL: "/perfil?email=verificado" } }).catch(() => {
          console.error("[viva:auth] e-mail de verificação não enviado no cadastro");
        });
      }
    } catch (error) {
      if (isAPIError(error)) {
        const code = (error.body as { code?: string } | undefined)?.code ?? "";
        if (code.startsWith("USER_ALREADY_EXISTS")) {
          return { ok: false, error: "Já existe uma conta com este e-mail.", fieldErrors: { email: ["Já existe uma conta com este e-mail."] } };
        }
        if (code.startsWith("PASSWORD_TOO")) {
          return { ok: false, error: "Senha fora do tamanho permitido.", fieldErrors: { password: ["Use entre 8 e 128 caracteres."] } };
        }
        throw new UserFacingError("Não foi possível criar a conta agora. Tente novamente.");
      }
      throw error;
    }
    ok = true;
    return { ok: true };
  });
  if (ok) redirect("/onboarding");
  return result;
}

export async function signInAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  let target: string | null = null;
  const result = await safeAction(async () => {
    const parsed = parseInput(signInSchema, formData);
    if (!parsed.ok) return parsed.result;
    const { email, password } = parsed.data;
    await consumeRateLimit(`signin-ip:${await clientKey()}`, 20, 60);
    await consumeRateLimit(`signin-email:${hashEmail(email)}`, 8, 60 * 5);
    try {
      const res = await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
      await applyUiCookies(res.user.id);
    } catch (error) {
      if (isAPIError(error)) return { ok: false, error: "E-mail ou senha incorretos." };
      throw error;
    }
    target = safeRedirectPath(formData.get("voltar"), "/inicio");
    return { ok: true };
  });
  if (target) redirect(target);
  return result;
}

export async function signOutAction(): Promise<void> {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Sessão já expirada: segue para a tela inicial.
  }
  redirect("/");
}

const deleteSchema = z.object({
  password: z.string().min(1, "Confirme sua senha.").max(128),
  confirmText: z.string().refine((v) => v.trim().toUpperCase() === "EXCLUIR", "Digite EXCLUIR para confirmar."),
});

/** Exclusão definitiva da conta e de todos os dados (cascata no banco). */
export async function deleteAccountAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  let deleted = false;
  const result = await safeAction(async () => {
    const user = await getCurrentUser();
    if (!user) throw new UserFacingError("Sessão expirada. Entre novamente.");
    const parsed = parseInput(deleteSchema, formData);
    if (!parsed.ok) return parsed.result;
    await consumeRateLimit(`delete:${user.id}`, 5, 60 * 10);
    try {
      await auth.api.deleteUser({ body: { password: parsed.data.password }, headers: await headers() });
    } catch (error) {
      if (isAPIError(error)) return { ok: false, error: "Senha incorreta.", fieldErrors: { password: ["Senha incorreta."] } };
      throw error;
    }
    deleted = true;
    return { ok: true };
  });
  if (deleted) redirect("/?conta=excluida");
  return result;
}

// ─────────────────────────────────────────────────────────────
// Recuperação e troca de senha, verificação de e-mail
// ─────────────────────────────────────────────────────────────

export async function requestPasswordResetAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  let sent = false;
  const result = await safeAction(async () => {
    if (!emailSettings().configured) throw new UserFacingError("A recuperação por e-mail não está disponível nesta instalação.");
    const parsed = parseInput(z.object({ email: emailSchema }), formData);
    if (!parsed.ok) return parsed.result;
    await consumeRateLimit(`reset-ip:${await clientKey()}`, 10, 60 * 15);
    await consumeRateLimit(`reset-email:${hashEmail(parsed.data.email)}`, 3, 60 * 60);
    // Resposta idêntica exista ou não a conta (evita descobrir e-mails cadastrados).
    await auth.api.requestPasswordReset({ body: { email: parsed.data.email } }).catch((error: unknown) => {
      if (!isAPIError(error)) throw error;
    });
    sent = true;
    return { ok: true };
  });
  if (sent) redirect("/esqueci-senha?enviado=1");
  return result;
}

const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string().max(128) })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "As senhas não conferem." });

export async function resetPasswordAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  let done = false;
  const result = await safeAction(async () => {
    const parsed = parseInput(newPasswordSchema.and(z.object({ token: z.string().min(10).max(200) })), formData);
    if (!parsed.ok) return parsed.result;
    await consumeRateLimit(`reset-submit:${await clientKey()}`, 10, 60 * 15);
    try {
      await auth.api.resetPassword({ body: { newPassword: parsed.data.password, token: parsed.data.token } });
    } catch (error) {
      if (isAPIError(error)) throw new UserFacingError("Este link é inválido ou já expirou. Peça um novo link de redefinição.");
      throw error;
    }
    done = true;
    return { ok: true };
  });
  if (done) redirect("/entrar?senha=redefinida");
  return result;
}

export async function changePasswordAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser();
    const parsed = parseInput(newPasswordSchema.and(z.object({ currentPassword: z.string().min(1, "Informe a senha atual.").max(128) })), formData);
    if (!parsed.ok) return parsed.result;
    await consumeRateLimit(`change-password:${user.id}`, 5, 60 * 15);
    try {
      await auth.api.changePassword({
        body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.password, revokeOtherSessions: true },
        headers: await headers(),
      });
    } catch (error) {
      if (isAPIError(error)) {
        return { ok: false, error: "Senha atual incorreta.", fieldErrors: { currentPassword: ["Senha atual incorreta."] } };
      }
      throw error;
    }
    return { ok: true, message: "Senha alterada. As sessões em outros aparelhos foram encerradas." };
  });
}

export async function resendVerificationAction(_prev: unknown, _formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser();
    if (!emailSettings().configured) throw new UserFacingError("O envio de e-mails não está configurado nesta instalação.");
    if (user.emailVerified) return { ok: true, message: "Seu e-mail já está confirmado." };
    await consumeRateLimit(`verify-email:${user.id}`, 3, 60 * 60);
    try {
      await auth.api.sendVerificationEmail({ body: { email: user.email, callbackURL: "/perfil?email=verificado" }, headers: await headers() });
    } catch (error) {
      if (isAPIError(error)) throw new UserFacingError("Não foi possível enviar a confirmação agora. Tente mais tarde.");
      throw error;
    }
    return { ok: true, message: `Enviamos um link de confirmação para ${user.email}.` };
  });
}
