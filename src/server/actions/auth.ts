"use server";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAPIError } from "better-auth/api";
import type { ActionResult, ActionState } from "@/lib/action-types";
import { zBool } from "@/lib/validation";
import { auth } from "../auth";
import { db } from "../db";
import { parseInput, safeAction, UserFacingError } from "../action-utils";
import { consumeRateLimit } from "../rate-limit";
import { recordConsents } from "../services/account";
import { MOTION_COOKIE, THEME_COOKIE, UI_COOKIE_OPTIONS, themeFromSetting } from "../ui-prefs";
import { getCurrentUser } from "../session";

const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254);
const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(128, "A senha pode ter no máximo 128 caracteres.");

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome ou apelido.").max(60, "Use no máximo 60 caracteres."),
  email: emailSchema,
  password: passwordSchema,
  acceptPrivacy: zBool.refine((v) => v, "É preciso aceitar a política de privacidade."),
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
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionResult> {
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
      await recordConsents(userId, ["PRIVACY_POLICY", "HEALTH_DATA"]);
      await applyUiCookies(userId);
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

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionResult> {
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
export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionResult> {
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
