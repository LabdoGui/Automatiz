import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { UserFacingError } from "../action-utils";

/**
 * Integração com a API do Claude (Anthropic) — somente no servidor.
 * A chave fica em ANTHROPIC_API_KEY e nunca chega ao navegador.
 * Sem chave configurada, o VIVA não simula respostas: a conversa com IA
 * simplesmente não é oferecida.
 */

export const DEFAULT_AI_MODEL = "claude-opus-5-5";
const DEFAULT_MAX_PER_HOUR = 20;
const HISTORY_TURNS = 8;
const REQUEST_TIMEOUT_MS = 120_000;

/** Modelos que aceitam o fallback de recusa no servidor (`fallbacks: "default"`). */
const SERVER_FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export function aiSettings() {
  const max = Number(process.env.VIVA_AI_MAX_PER_HOUR);
  return {
    configured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    model: process.env.VIVA_AI_MODEL?.trim() || DEFAULT_AI_MODEL,
    maxPerHour: Number.isInteger(max) && max > 0 ? Math.min(max, 500) : DEFAULT_MAX_PER_HOUR,
  };
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  return client;
}

const SYSTEM_PROMPT = `Você é o assistente do VIVA, um aplicativo brasileiro de planejamento alimentar, treino, compras e hábitos. Responda em português do Brasil, de forma curta e prática (até cerca de 200 palavras), em texto simples. Use listas com "- " quando ajudar; não use títulos, tabelas nem negrito. Comece a resposta visível logo.

Limites e cuidados:
- Você não é nutricionista, médico nem profissional de educação física. Não faça diagnósticos e não prescreva dietas, calorias, macronutrientes, suplementos ou medicamentos. Diante de dor, lesão, sintomas, gestação, doenças, uso de medicamentos ou sinais de transtorno alimentar, oriente procurar um profissional de saúde.
- Alergias informadas são críticas: nunca sugira alimentos que contenham o alergênico. Para produtos industrializados, lembre de conferir o rótulo, porque podem conter traços.
- Não invente preços atuais nem valores nutricionais exatos. Se der uma estimativa, diga que é aproximada e sugira conferir na base de alimentos do VIVA (Tabela TACO) ou nos preços que a pessoa cadastrou.
- Não use linguagem de culpa, compensação ou punição sobre comida, corpo, peso ou descanso. Não incentive restrição severa, jejum prolongado nem treino excessivo.
- Em treino, priorize técnica e segurança; progressões de carga devem ser pequenas e só com boa execução.
- Se a pergunta fugir de alimentação, treino, compras de mercado ou rotina saudável, diga com gentileza que você só ajuda com esses temas.`;

export type AiTurn = { role: "user" | "assistant"; content: string };
export type AiReply = { kind: "answer"; text: string; truncated: boolean } | { kind: "refusal" };

export class AiUnavailableError extends UserFacingError {}

function toMessages(history: readonly AiTurn[], question: string): Anthropic.Beta.Messages.BetaMessageParam[] {
  const recent = history.slice(-HISTORY_TURNS);
  while (recent.length && recent[0].role !== "user") recent.shift();
  return [...recent.map((t) => ({ role: t.role, content: t.content })), { role: "user", content: question }];
}

function logFailure(kind: string, status?: number) {
  // Sem conteúdo da conversa nos logs (LGPD): só o tipo e o status.
  console.error(`[viva:ai] ${kind}${status ? ` status=${status}` : ""}`);
}

export async function askClaude(params: { history: readonly AiTurn[]; question: string; context: readonly string[] }): Promise<AiReply> {
  const { model } = aiSettings();
  if (!aiSettings().configured) throw new AiUnavailableError("Nenhum provedor de IA está configurado nesta instalação.");

  const system: Anthropic.Beta.Messages.BetaTextBlockParam[] = [{ type: "text", text: SYSTEM_PROMPT }];
  if (params.context.length) {
    system.push({
      type: "text",
      text: `Contexto informado pela pessoa no VIVA (use para personalizar e respeitar restrições):\n${params.context.map((l) => `- ${l}`).join("\n")}`,
    });
  }

  let response: Anthropic.Beta.Messages.BetaMessage;
  try {
    response = await getClient().beta.messages.create({
      model,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      system,
      messages: toMessages(params.history, params.question),
      ...(SERVER_FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      logFailure("auth", error.status);
      throw new AiUnavailableError("O assistente com IA está indisponível por um problema de configuração do servidor.");
    }
    if (error instanceof Anthropic.NotFoundError || error instanceof Anthropic.BadRequestError) {
      logFailure("request", error.status);
      throw new AiUnavailableError("O assistente com IA não aceitou esta pergunta. Tente reformular de forma mais curta.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      logFailure("rate_limit", error.status);
      throw new AiUnavailableError("O provedor de IA está com muitas solicitações. Tente novamente em alguns minutos.");
    }
    if (error instanceof Anthropic.APIConnectionError) {
      logFailure(error instanceof Anthropic.APIConnectionTimeoutError ? "timeout" : "connection");
      throw new AiUnavailableError("Não foi possível falar com o provedor de IA agora. Tente novamente em instantes.");
    }
    if (error instanceof Anthropic.APIError) {
      logFailure("api", error.status);
      throw new AiUnavailableError("O provedor de IA está instável no momento. Tente novamente mais tarde.");
    }
    throw error;
  }

  if (response.stop_reason === "refusal") return { kind: "refusal" };
  const text = response.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
  if (!text) {
    logFailure(`empty:${response.stop_reason ?? "unknown"}`);
    throw new AiUnavailableError("O assistente com IA não conseguiu formular uma resposta. Tente perguntar de outro jeito.");
  }
  return { kind: "answer", text, truncated: response.stop_reason === "max_tokens" };
}
