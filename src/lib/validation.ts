import { z } from "zod";
import { isISODate, isValidTime } from "@/domain/dates";
import { parseBRLToCents, parseDecimal } from "@/domain/format";

z.config(z.locales.ptBR());

/** Converte FormData em objeto simples; campos repetidos viram arrays. */
export function formDataToObject(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== "string") continue;
    if (key.startsWith("$ACTION")) continue;
    const current = out[key];
    if (current === undefined) out[key] = value;
    else out[key] = Array.isArray(current) ? [...current, value] : [current, value];
  }
  return out;
}

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const zText = (max = 120) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`);
export const zRequiredText = (label: string, max = 120) =>
  z.string().trim().min(1, `Informe ${label}.`).max(max, `Use no máximo ${max} caracteres.`);
export const zOptionalText = (max = 500) => z.preprocess(emptyToUndefined, zText(max).optional());

export const zInt = (min: number, max: number, label = "o valor") =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : Number(v.replace(",", "."))) : v),
    z
      .number({ error: (iss) => (iss.input === undefined ? `Informe ${label}.` : `Valor inválido para ${label}.`) })
      .int(`Use um número inteiro para ${label}.`)
      .min(min, `O mínimo para ${label} é ${min}.`)
      .max(max, `O máximo para ${label} é ${max}.`),
  );

export const zOptionalInt = (min: number, max: number, label = "o valor") =>
  z.preprocess(emptyToUndefined, zInt(min, max, label).optional());

export const zDecimal = (min: number, max: number, label = "o valor") =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : (parseDecimal(v) ?? Number.NaN)) : v),
    z
      .number({ error: (iss) => (iss.input === undefined ? `Informe ${label}.` : `Valor inválido para ${label}.`) })
      .refine((n) => Number.isFinite(n), `Valor inválido para ${label}.`)
      .refine((n) => n >= min, `O mínimo para ${label} é ${min}.`)
      .refine((n) => n <= max, `O máximo para ${label} é ${max}.`),
  );

export const zOptionalDecimal = (min: number, max: number, label = "o valor") =>
  z.preprocess(emptyToUndefined, zDecimal(min, max, label).optional());

/** Valor em reais digitado ("12,90") → centavos. */
export const zMoneyCents = (label = "o valor", maxCents = 10_000_000) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : (parseBRLToCents(v) ?? Number.NaN)) : v),
    z
      .number({
        error: (iss) => (iss.input === undefined ? `Informe ${label}.` : `Valor inválido para ${label}. Use o formato 12,90.`),
      })
      .int()
      .refine((n) => n >= 0, `${label} não pode ser negativo.`)
      .refine((n) => n <= maxCents, `${label} parece alto demais.`),
  );

export const zOptionalMoneyCents = (label = "o valor") => z.preprocess(emptyToUndefined, zMoneyCents(label).optional());

export const zTime = z.string().refine(isValidTime, "Use o formato HH:MM.");
export const zISODate = z.string().refine(isISODate, "Data inválida.");
export const zId = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, "Identificador inválido.");

export const zBool = z.preprocess((v) => v === "on" || v === "true" || v === true || v === "1", z.boolean());

export const zStringArray = (max = 50, itemMax = 60) =>
  z.preprocess(
    (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]),
    z.array(z.string().trim().min(1).max(itemMax)).max(max),
  );

export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const flat = z.flattenError(error);
  return flat.fieldErrors as Record<string, string[]>;
}
