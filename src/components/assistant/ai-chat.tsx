"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "../ui/button";
import { TextAreaField } from "../forms/fields";
import { Toggle } from "../forms/choices";

export interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
}

type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; truncated: boolean }
  | { type: "refusal"; message: string }
  | { type: "error"; message: string };

/**
 * Conversa com IA: a resposta aparece enquanto é gerada (streaming).
 * Ao terminar, a página é atualizada com o histórico salvo no servidor.
 */
export function AiChat({
  initialMessages,
  contextLines,
  maxPerHour,
}: {
  initialMessages: ChatMessage[];
  contextLines: string[];
  maxPerHour: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [messages, setMessages] = useState(initialMessages);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingQuestion) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const question = String(data.get("question") ?? "").trim();
    if (question.length < 3) {
      setError("Escreva sua pergunta (pelo menos 3 caracteres).");
      return;
    }
    setError(null);
    setPartial("");
    setPendingQuestion(question);
    setStatus("Gerando resposta…");

    const fail = (message: string) => {
      setError(message);
      setPendingQuestion(null);
      setPartial("");
      setStatus("");
    };

    let response: Response;
    try {
      response = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, includeContext: data.get("includeContext") === "on" }),
      });
    } catch {
      return fail("Sem conexão com o servidor. Verifique a internet e tente de novo.");
    }
    if (!response.ok || !response.body) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      return fail(body?.error ?? "Não foi possível enviar a pergunta agora.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let finished: StreamEvent | null = null;
    while (!finished) {
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const ev = JSON.parse(line) as StreamEvent;
        if (ev.type === "delta") {
          text += ev.text;
          setPartial(text);
        } else {
          finished = ev;
        }
      }
    }

    if (!finished) return fail("A conexão caiu antes do fim da resposta. Tente novamente.");
    if (finished.type === "refusal" || finished.type === "error") return fail(finished.message);

    setMessages((prev) => [
      ...prev,
      { id: `local-q-${prev.length}`, role: "USER", content: question },
      { id: `local-a-${prev.length}`, role: "ASSISTANT", content: text.trim() },
    ]);
    setPendingQuestion(null);
    setPartial("");
    setStatus("Resposta da IA recebida.");
    formRef.current?.reset();
    router.refresh();
  }

  const busy = pendingQuestion !== null;

  return (
    <div className="flex flex-col gap-5">
      {messages.length === 0 && !busy ? (
        <p className="text-sm text-ink-2">
          Pergunte sobre receitas, trocas, organização da semana, compras ou técnica de exercícios. Para números exatos (nutrientes, preços), as
          ferramentas acima usam dados reais.
        </p>
      ) : (
        <ol className="flex flex-col gap-4" aria-label="Mensagens da conversa" aria-busy={busy}>
          {messages.map((m) => (m.role === "USER" ? <UserBubble key={m.id} text={m.content} /> : <AiBubble key={m.id} text={m.content} />))}
          {busy && (
            <>
              <UserBubble text={pendingQuestion} />
              <AiBubble text={partial} streaming />
            </>
          )}
        </ol>
      )}
      <p role="status" className="sr-only">
        {status}
      </p>

      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3 rounded-[2rem] border border-line p-4 sm:p-5" noValidate>
        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger-text">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>{error}</p>
          </div>
        )}
        <TextAreaField name="question" label="Sua pergunta" maxLength={1000} required placeholder="Ex.: Que lanche rápido posso levar para o trabalho?" />
        <div className="rounded-2xl border border-line px-4">
          <Toggle
            name="includeContext"
            label="Incluir meu contexto"
            description={contextLines.length ? "Ajuda a IA a respeitar suas restrições." : "Seu perfil ainda não tem dados de contexto."}
            defaultChecked={contextLines.length > 0}
          />
        </div>
        {contextLines.length > 0 && (
          <details className="text-xs text-ink-2">
            <summary className="cursor-pointer font-semibold">O que será enviado como contexto</summary>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              {contextLines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </details>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-3">Até {maxPerHour} perguntas por hora. Respostas de IA podem conter erros.</p>
          <Button type="submit" disabled={busy} aria-disabled={busy}>
            <Sparkles className="h-4 w-4" aria-hidden /> {busy ? "Gerando…" : "Perguntar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <li className="ml-auto max-w-[85%] rounded-[1.5rem] rounded-br-md bg-surface-2 px-4 py-3 text-sm">
      <p className="sr-only">Você:</p>
      <p className="whitespace-pre-wrap">{text}</p>
    </li>
  );
}

function AiBubble({ text, streaming = false }: { text: string; streaming?: boolean }) {
  return (
    <li className="max-w-[92%] rounded-[1.5rem] rounded-bl-md border border-line bg-surface px-4 py-3 text-sm">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-sky-text">
        <Sparkles className="h-3.5 w-3.5" aria-hidden /> Resposta gerada por IA (Claude)
      </p>
      <p className="whitespace-pre-wrap leading-relaxed">
        {text}
        {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-ink-3 align-text-bottom" aria-hidden />}
        {streaming && !text && <span className="text-ink-3">Pensando…</span>}
      </p>
    </li>
  );
}
