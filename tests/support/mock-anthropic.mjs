// Servidor HTTP mínimo que imita POST /v1/messages da API da Anthropic, para
// testar a integração (sucesso, recusa, erros) sem chave real e sem custo.
// Uso: node tests/support/mock-anthropic.mjs <porta> [arquivo-de-log]
import { createServer } from "node:http";
import { appendFileSync } from "node:fs";

const port = Number(process.argv[2] ?? 4010);
const logFile = process.argv[3];

export function startMock(listenPort = port, onRequest) {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = body ? JSON.parse(body) : {};
      const record = { path: req.url, headers: { beta: req.headers["anthropic-beta"] ?? null, credential: req.headers["x-api-key"] || req.headers.authorization ? "present" : "absent" }, body: json };
      onRequest?.(record);
      if (logFile) appendFileSync(logFile, JSON.stringify(record) + "\n");
      const last = json.messages?.at(-1)?.content ?? "";
      const text = typeof last === "string" ? last : JSON.stringify(last);
      const send = (status, payload) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
      };
      if (text.includes("erro500")) return send(500, { type: "error", error: { type: "api_error", message: "mock" } });
      if (text.includes("erro429")) return send(429, { type: "error", error: { type: "rate_limit_error", message: "mock" } });
      if (text.includes("erro401")) return send(401, { type: "error", error: { type: "authentication_error", message: "mock" } });
      const base = { id: "msg_mock", type: "message", role: "assistant", model: json.model, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } };
      const refusal = text.includes("recusa");
      const hasContext = (json.system ?? []).some((b) => b.text?.includes("Contexto informado"));
      const answer = `Resposta simulada pelo servidor de teste (${hasContext ? "com" : "sem"} contexto).`;
      if (json.stream) {
        // Mesmo formato de eventos SSE da API de mensagens.
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
        const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
        ev("message_start", { message: { ...base, content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 1 } } });
        if (!refusal) {
          ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
          for (const piece of answer.match(/.{1,12}/g)) ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: piece } });
          ev("content_block_stop", { index: 0 });
        }
        ev("message_delta", {
          delta: { stop_reason: refusal ? "refusal" : "end_turn", stop_sequence: null, ...(refusal ? { stop_details: { type: "refusal", category: null, explanation: null } } : {}) },
          usage: { output_tokens: 10 },
        });
        ev("message_stop", {});
        return res.end();
      }
      if (refusal) return send(200, { ...base, content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: null, explanation: null } });
      return send(200, { ...base, content: [{ type: "text", text: answer }], stop_reason: "end_turn" });
    });
  });
  server.listen(listenPort, "127.0.0.1");
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) startMock();
