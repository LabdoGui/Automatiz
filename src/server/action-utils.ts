import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { ActionResult } from "@/lib/action-types";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation";
import { RateLimitError } from "./rate-limit";

/** Erro com mensagem segura para exibir ao usuário. */
export class UserFacingError extends Error {}

export class NotFoundError extends UserFacingError {
  constructor(what = "Registro") {
    super(`${what} não encontrado.`);
  }
}

/**
 * Executa uma Server Action com tratamento uniforme de erros.
 * Mensagens internas nunca chegam ao cliente e nada de dado pessoal é registrado.
 */
export async function safeAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof UserFacingError || error instanceof RateLimitError) {
      return { ok: false, error: error.message };
    }
    const name = error instanceof Error ? error.name : "UnknownError";
    const code = (error as { code?: string })?.code;
    console.error(`[viva:action] ${name}${code ? ` (${code})` : ""}`);
    return { ok: false, error: "Não foi possível concluir agora. Tente novamente em instantes." };
  }
}

export type Parsed<S extends z.ZodType> = { ok: true; data: z.infer<S> } | { ok: false; result: ActionResult<never> };

export function parseInput<S extends z.ZodType>(schema: S, input: FormData | Record<string, unknown>): Parsed<S> {
  const raw = input instanceof FormData ? formDataToObject(input) : input;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      result: { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrorsOf(parsed.error) },
    };
  }
  return { ok: true, data: parsed.data };
}
