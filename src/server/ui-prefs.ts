/**
 * Preferências visuais espelhadas em cookie (não sensíveis) para renderizar
 * o tema certo no servidor, sem "piscar" ao carregar. A fonte de verdade
 * continua sendo a tabela user_settings.
 */

export type UiTheme = "dark" | "light" | "system";
export type UiMotion = "on" | "off";

export const THEME_COOKIE = "viva-theme";
export const MOTION_COOKIE = "viva-motion";
export const CELEBRATE_COOKIE = "viva-celebrate";

interface CookieReader {
  get(name: string): { value: string } | undefined;
}

export function readUiPrefs(store: CookieReader): { theme: UiTheme; motion: UiMotion; celebrate: boolean } {
  const t = store.get(THEME_COOKIE)?.value;
  const m = store.get(MOTION_COOKIE)?.value;
  return {
    theme: t === "light" || t === "system" ? t : "dark",
    motion: m === "off" ? "off" : "on",
    celebrate: store.get(CELEBRATE_COOKIE)?.value !== "off",
  };
}

export function themeFromSetting(theme: "DARK" | "LIGHT" | "SYSTEM"): UiTheme {
  return theme === "LIGHT" ? "light" : theme === "SYSTEM" ? "system" : "dark";
}

export const UI_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
};
