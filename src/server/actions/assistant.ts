"use server";

import type { ActionResult } from "@/lib/action-types";
import { safeAction } from "../action-utils";
import { requireUser } from "../session";
import { clearAiHistory } from "../services/assistant";

// A pergunta à IA usa streaming: ver src/app/api/assistente/route.ts.

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
