import { z } from "zod";
import { buildAssistantContext } from "@/domain/assistant/context";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { UserFacingError } from "@/server/action-utils";
import { consumeRateLimit, RateLimitError } from "@/server/rate-limit";
import { aiSettings, streamClaude } from "@/server/ai/claude";
import { aiHistory, assistantContextInput, saveAiExchange } from "@/server/services/assistant";

/**
 * Conversa com IA em streaming. Resposta em NDJSON, uma linha por evento:
 * {"type":"delta","text"} · {"type":"done","truncated"} · {"type":"refusal","message"} · {"type":"error","message"}
 */
const bodySchema = z.object({
  question: z.string().trim().min(3, "Escreva sua pergunta (pelo menos 3 caracteres).").max(1000, "Use no máximo 1000 caracteres."),
  includeContext: z.boolean(),
});

const REFUSAL = "O assistente com IA não pode responder a essa pergunta. Tente reformular ou use as ferramentas do VIVA.";

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Aceita apenas chamadas do próprio site (proteção contra CSRF). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("host");
  const allowed = [host && new URL(origin).host === host, process.env.BETTER_AUTH_URL && new URL(process.env.BETTER_AUTH_URL).origin === origin];
  return allowed.some(Boolean);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não permitida.");
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return jsonError(401, "Entre na sua conta para usar o assistente.");
  const userId = session.user.id;

  const config = aiSettings();
  if (!config.configured) return jsonError(503, "Nenhum provedor de IA está configurado nesta instalação.");
  const settings = await db.userSettings.findUnique({ where: { userId }, select: { assistantAiOptIn: true } });
  if (!settings?.assistantAiOptIn) return jsonError(403, "Ative o assistente com IA antes de enviar perguntas.");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Pergunta inválida.");

  try {
    await consumeRateLimit(`ai:${userId}`, config.maxPerHour, 3600);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return jsonError(429, `Você chegou ao limite de ${config.maxPerHour} perguntas por hora ao assistente com IA. As ferramentas do VIVA continuam disponíveis.`);
    }
    throw error;
  }

  const [history, contextInput] = await Promise.all([
    aiHistory(userId, 8),
    parsed.data.includeContext ? assistantContextInput(userId) : Promise.resolve(null),
  ]);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const reply = await streamClaude(
          {
            history: history.map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: m.content })),
            question: parsed.data.question,
            context: contextInput ? buildAssistantContext(contextInput) : [],
          },
          (text) => send({ type: "delta", text }),
          request.signal,
        );
        if (reply.kind === "refusal") {
          send({ type: "refusal", message: REFUSAL });
        } else {
          const answer = reply.truncated ? `${reply.text}\n\n(Resposta interrompida por ser longa demais.)` : reply.text;
          await saveAiExchange(userId, parsed.data.question, answer);
          send({ type: "done", truncated: reply.truncated });
        }
      } catch (error) {
        if (request.signal.aborted) return controller.close();
        send({
          type: "error",
          message: error instanceof UserFacingError ? error.message : "Não foi possível concluir agora. Tente novamente em instantes.",
        });
        if (!(error instanceof UserFacingError)) console.error("[viva:ai] falha inesperada no streaming");
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
