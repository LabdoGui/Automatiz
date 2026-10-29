import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { localDate, type ISODate } from "@/domain/dates";
import { auth } from "./auth";
import { db } from "./db";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

/** Lê a sessão uma única vez por requisição. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}

/** Exige usuário autenticado (páginas e Server Actions). */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  return user;
}

export const getProfileAndSettings = cache(async (userId: string) => {
  const [profile, settings] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.userSettings.findUnique({ where: { userId } }),
  ]);
  return { profile, settings };
});

/** Exige usuário com onboarding concluído; caso contrário, envia ao onboarding. */
export async function requireOnboardedUser() {
  const user = await requireUser();
  const { profile, settings } = await getProfileAndSettings(user.id);
  if (!profile?.onboardingCompletedAt) redirect("/onboarding");
  return { user, profile, settings };
}

export function userTimezone(settings: { timezone: string } | null | undefined): string {
  return settings?.timezone ?? "America/Sao_Paulo";
}

/** Fuso e data de hoje do usuário. */
export function clockFor(settings: { timezone: string } | null | undefined): { tz: string; today: ISODate } {
  const tz = userTimezone(settings);
  return { tz, today: localDate(new Date(), tz) };
}
