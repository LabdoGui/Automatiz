"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildAssistantContext } from "@/domain/assistant/context";
import type { ActionResult } from "@/lib/action-types";
import { zBool } from "@/lib/validation";
import { db } from "../db";
import { parseInput, safeAction, UserFacingError } from "../action-utils";
import { consumeRateLimit, RateLimitError } from "../rate-limit";
import { requireUser } from "../session";
import { aiSettings, askClaude } from "../ai/claude";
import { aiHistory, assistantContextInput, clearAiHistory, saveAiExchange } from "../services/assistant";

const askSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, "Escreva sua pergunta (pelo menos 3 caracteres).")
    .max(1000, "Use no máximo 1000 caracteres."),
  includeContext: zBool,
});

export async function askAiAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser();
    const config = aiSettings();
    if (!config.configured) throw new UserFacingError("Nenhum provedor de IA está configurado nesta instalação.");
    const settings = await db.userSettings.findUnique({ where: { userId: user.id }, select: { assistantAiOptIn: true } });
    if (!settings?.assistantAiOptIn) throw new UserFacingError("Ative o assistente com IA antes de enviar perguntas.");

    const parsed = parseInput(askSchema, formData);
    if (!parsed.ok) return parsed.result;

    try {
      await consumeRateLimit(`ai:${user.id}`, config.maxPerHour, 3600);
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw new UserFacingError(
          `Você chegou ao limite de ${config.maxPerHour} perguntas por hora ao assistente com IA. As ferramentas do VIVA continuam disponíveis.`,
        );
      }
      throw error;
    }

    const [history, contextInput] = await Promise.all([
      aiHistory(user.id, 8),
      parsed.data.includeContext ? assistantContextInput(user.id) : Promise.resolve(null),
    ]);
    const reply = await askClaude({
      history: history.map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: m.content })),
      question: parsed.data.question,
      context: contextInput ? buildAssistantContext(contextInput) : [],
    });
    if (reply.kind === "refusal") {
      return { ok: false, error: "O assistente com IA não pode responder a essa pergunta. Tente reformular ou use as ferramentas do VIVA." };
    }
    const answer = reply.truncated ? `${reply.text}\n\n(Resposta interrompida por ser longa demais.)` : reply.text;
    await saveAiExchange(user.id, parsed.data.question, answer);
    revalidatePath("/assistente");
    return { ok: true };
  });
}

/**
 * Sem revalidatePath: o diálogo que dispara a ação desaparece quando a conversa
 * fica vazia, então a navegação (feita pelo formulário) traz a página atualizada.
 */
export async function clearAiHistoryAction(_prev: unknown, _formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  return safeAction<{ redirectTo: string }>(async () => {
    const user = await requireUser();
    const count = await clearAiHistory(user.id);
    return {
      ok: true,
      message: count ? "Conversa apagada." : "Não havia mensagens para apagar.",
      data: { redirectTo: "/assistente?conversa=apagada#ia" },
    };
  });
}
